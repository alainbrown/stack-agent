# Session Robustness: Progress Persistence, Resume & Stage Navigation

## Overview

Enhance stack-agent with persistent session state, resume capability, and interactive stage navigation. Users can save progress, resume interrupted sessions, navigate between completed stages to modify decisions, skip to review when ready, and confirm their final stack before scaffolding.

## Goals

- **Never lose progress** — decisions persist to disk after every meaningful state change
- **Resume seamlessly** — users pick up exactly where they left off, with full conversational context
- **Navigate freely** — users move between stages via a checklist UI, modifying past decisions
- **Skip when ready** — jump to review once minimum decisions are met
- **Cascade intelligently** — LLM determines which downstream decisions are invalidated by a change

## Non-Goals

- Persisting full raw conversation history (summarized messages are sufficient)
- Automatic session expiry or garbage collection
- Multi-session management (one `.stack-agent.json` per directory)

---

## Section 1: Data Model & Persistence

### File Format

Progress is saved to `.stack-agent.json` in the current working directory.

```typescript
interface SavedSession {
  version: 1
  createdAt: string              // ISO timestamp
  updatedAt: string              // ISO timestamp
  progress: StackProgress        // existing decision state
  stages: StageEntry[]           // ordered stage list with status
  messages: MessageParam[]       // compressed conversation history
}

interface StageEntry {
  id: string                     // e.g., 'project_info', 'frontend', 'database'
  label: string                  // e.g., 'Project Info', 'Frontend'
  status: 'pending' | 'complete' | 'skipped'
  summary?: string               // from summarize_stage, shown on resume and in stage list
  progressKeys: string[]         // which StackProgress fields this stage owns
                                 // e.g., ['frontend'] or ['projectName', 'description']
}
```

### Default Stage Order

The LLM can add or remove stages dynamically, but the initial order is:

```
project_info → frontend → backend → database → auth → payments → ai → deployment → extras
```

### Save Triggers

Progress is saved after any tool execution batch that includes `set_decision`, `set_project_info`, or `summarize_stage`. The save is a synchronous `writeFileSync` of the serialized session.

### Clearing Progress Keys

When a stage is invalidated, its `progressKeys` determine what to clear on `StackProgress`:

- **`string | null` fields** (`projectName`, `description`, category fields like `frontend`): set to `null`
- **`ComponentChoice[]` fields** (`extras`): reset to `[]`

This aligns with the existing `clearDecision` function in `progress.ts`, which handles `ProgressCategory` fields. A new `clearProjectInfo` helper will handle `projectName` and `description`. The `project_info` stage maps to `progressKeys: ['projectName', 'description']`; all other stages map to their single category key (e.g., `progressKeys: ['frontend']`).

### Cleanup

- Delete `.stack-agent.json` after successful scaffold completion
- Delete `.stack-agent.json` when user chooses "start fresh" at the resume prompt

### Error Handling

- **Corrupt session file**: If `.stack-agent.json` fails to parse (invalid JSON, wrong version, missing required fields), treat it as absent — offer "start fresh" with a warning that the previous session could not be restored.
- **Version mismatch**: If `version` does not match the current expected version, treat as corrupt (same behavior as above).
- **Atomic writes**: `save()` writes to `.stack-agent.json.tmp` first, then renames to `.stack-agent.json`. This prevents corruption from partial writes or SIGINT during save.
- **SIGINT handling**: Register a handler that completes any in-progress save before exiting. If no save is in-progress, exit immediately.
- **Save failures**: If `save()` fails (disk full, permissions), log a warning but do not crash. The session continues in-memory; the user loses resume capability but not their current session.

---

## Section 2: Stage Manager Architecture

The `StageManager` is the orchestrator — it owns the stage list, drives transitions, and handles persistence.

```typescript
interface InvalidationResult {
  clear: string[]         // stage IDs whose decisions are now invalid
  add: StageEntry[]       // new stages to introduce
  remove: string[]        // stage IDs no longer relevant
}

// Callback type — the orchestration layer provides this, keeping LLM
// concerns out of StageManager's core logic.
type InvalidationFn = (
  changedId: string,
  oldValue: ComponentChoice | null,
  newValue: ComponentChoice | null,
  progress: StackProgress,
  stages: StageEntry[],
) => Promise<InvalidationResult>

class StageManager {
  private session: SavedSession
  private filePath: string                  // path to .stack-agent.json
  private onInvalidate?: InvalidationFn     // injected by orchestration layer

  // Lifecycle
  static start(cwd: string, onInvalidate?: InvalidationFn): StageManager
  static resume(cwd: string, onInvalidate?: InvalidationFn): StageManager
  static detect(cwd: string): SavedSession | null   // check if file exists

  // Stage navigation
  currentStage(): StageEntry | null       // first non-complete, non-skipped
  completeStage(id: string, summary: string): void
  skipStage(id: string): void
  navigateTo(id: string): void            // user selected from stage list
                                          // preserves old decision until new one confirmed

  // Dynamic stages (LLM-driven)
  addStage(entry: StageEntry, afterId: string): void
  removeStage(id: string): void

  // Cascading invalidation
  async invalidateAfter(changedId: string): Promise<void>
  // Calls this.onInvalidate (if provided) to determine which downstream
  // stages are affected. Clears progress keys + resets status for affected stages.

  // Persistence
  save(): void                            // atomic write to .stack-agent.json
  cleanup(): void                         // delete the file

  // Accessors
  get progress(): StackProgress
  get messages(): MessageParam[]
  get stages(): StageEntry[]
}
```

The `InvalidationFn` is provided by `index.ts` which has access to the LLM client. This keeps `StageManager` testable without LLM dependencies — in tests, provide a mock function or omit it entirely.

### Orchestration Flow (index.ts)

```
1. Check StageManager.detect(cwd)
2. If found → show summary, ask resume/fresh
3. StageManager.start() or StageManager.resume()
4. Loop:
   a. stage = manager.currentStage()
   b. If null → show review screen
   c. Run per-stage conversation loop for stage
   d. On left-arrow → show stage list, handle selection
   e. On stage complete → manager.completeStage(), loop
5. Review: confirm → scaffold, cancel → exit, left-arrow → back to loop
```

### Key Principle

The `StageManager` never talks to Claude directly. The LLM call for invalidation is injected via `InvalidationFn`, keeping the class testable and free of LLM client dependencies. It manages state and flow; the conversation loop manages the LLM interaction.

---

## Section 3: Navigation & UI

### Input Handling

Modify `getUserInput` to detect left arrow keypress and return a discriminated union:

```typescript
type InputResult =
  | { kind: 'text', value: string }
  | { kind: 'cancel' }
  | { kind: 'navigate' }     // left arrow pressed
```

**Implementation approach:** Since `@clack/prompts` text input captures all keystrokes internally, we use a two-phase input handler: before activating the clack text prompt, briefly listen on `process.stdin` in raw mode for the left-arrow escape sequence (`\x1b[D`). If detected, return `{ kind: 'navigate' }` without ever entering the text prompt. If any other key is pressed, stop raw listening and delegate to clack's `text()` prompt with the initial keystroke buffered. This avoids forking clack while keeping the UX seamless.

### Stage List UI

Rendered using `@clack/prompts` select when the user presses left arrow:

```
┌  Stack Progress
│
│  ✓ Project Info    — "my-app: a task management SaaS"
│  ✓ Frontend        — Next.js
│  ✓ Database        — Postgres + Drizzle
│  ● Auth            ← current stage
│  ○ Payments
│  ○ Deployment
│  ─────────────────
│  ★ Review & Build  (3 required decisions remaining)
│
└  ↑/↓ navigate · enter select · esc return
```

- **✓** completed — selectable, takes you back to modify that decision
- **●** current — selectable, returns to where you were
- **○** pending — selectable (allows jumping ahead if the user wants to discuss a later topic first; the stage loop scoping handles this naturally)
- **★** Review & Build — selectable once `isComplete(progress)` returns true

### Review Screen

Shows the full plan (reuses existing `renderPlan`), then offers a select prompt:

```
┌  Your Stack
│
│  (rendered plan with all decisions)
│
◆  Ready to build?
│  ● Confirm & build
│  ○ Go back and adjust
│  ○ Cancel
└
```

- **Confirm & build** → proceed to scaffold phase
- **Go back and adjust** → opens the stage list
- **Cancel** → exit (progress file preserved for next time)

### Hint Text

During the first few conversation interactions, show a subtle hint below the input prompt: `← stage list`. Fade it out after 3-4 interactions to avoid clutter.

---

## Section 4: Per-Stage Conversation Loop

The existing `runConversationLoop` is refactored into a per-stage loop that handles one stage at a time and returns control to the `StageManager`.

### Interface

```typescript
type StageLoopResult =
  | { outcome: 'complete', summary: string }   // stage finished, decision made
  | { outcome: 'skipped' }                      // LLM determined stage not needed
  | { outcome: 'navigate' }                     // user pressed left arrow
  | { outcome: 'cancel' }                       // user cancelled (Ctrl+C / Esc)

async function runStageLoop(
  stage: StageEntry,
  manager: StageManager,
  mcpServers?: Record<string, { url: string; apiKey?: string }>,
): Promise<StageLoopResult>
```

### Stage Completion Detection

The stage loop determines completion by checking tool results after each batch:

- **For `project_info` stage**: Complete when a tool batch includes `set_project_info` followed by `summarize_stage`.
- **For category stages** (`frontend`, `backend`, etc.): Complete when a tool batch includes `set_decision` for this stage's category. The loop checks `toolBlock.input.category === stage.id` after executing the tool.
- **For `extras` stage**: Complete only via `summarize_stage` (since extras can have zero or many decisions). The `extras` stage is the only stage where `set_decision` does not trigger completion — it just appends to the array.
- **For skipping**: If Claude calls `summarize_stage` without having called `set_decision` for this stage in the current or any prior batch, the stage is skipped.

The existing `ConversationToolResult.signal` field is extended:

```typescript
export interface ConversationToolResult {
  progress: StackProgress
  response: string
  signal?: 'present_plan' | 'stage_complete' | 'stage_skipped'
}
```

### The `present_plan` Tool

The `present_plan` tool is **removed** from `conversationToolDefinitions()`. Its purpose (signaling that all decisions are made) is now handled by the `StageManager`: when `currentStage()` returns `null`, the orchestration loop shows the review screen. The tool definition and its handler in `executeConversationTool` are deleted.

### What Changes From the Current Loop

- **Scoped system prompt** — `buildConversationPrompt` receives the current stage ID so Claude knows which topic to focus on, plus the full progress for context (see Per-Stage Prompt Structure below)
- **Exit conditions** — The loop ends based on the stage completion detection rules above
- **Save on progress change** — After processing a tool batch that includes `set_decision` or `set_project_info`, call `manager.save()`
- **Messages stay on the manager** — The loop reads/writes `manager.messages` directly rather than owning its own array, so conversation history persists across stage transitions
- **MCP servers** — `mcpServers` is threaded through from the orchestration layer so documentation lookups continue to work

### Per-Stage Prompt Structure

`buildConversationPrompt(progress, stageId)` produces a system prompt scoped to the active stage:

```
You are a senior software architect helping the user build a new project.

## Current Progress
{serializeProgress(progress)}

## Current Stage: {stageLabel}
You are currently discussing the {stageLabel} stage.
{stage-specific instructions — e.g., "Present 2-3 frontend framework options with trade-offs and your recommendation."}

## Context from Previous Stages
{summaries from completed stages, if any}

## Guidelines
- Focus on {stageLabel}. Do not discuss other undecided stages.
- When the user has made their choice, commit it with set_decision and summarize with summarize_stage.
- If this stage is not relevant to the project, explain why and call summarize_stage to skip it.
```

The stage-specific instructions can be defined as a map in `stages.ts` alongside the default stage definitions.

### What Stays the Same

- Streaming response rendering
- Tool execution logic (`executeConversationTool`)
- The `summarize_stage` compression of earlier messages
- User input collection (now returns `InputResult` with `navigate` support)

---

## Section 5: Cascading Invalidation

When a user navigates back and changes a decision, other decisions may no longer make sense. Rather than hard-coding dependency rules, we delegate to the LLM.

### Trigger

User selects a completed stage from the stage list → `manager.navigateTo(id)`. The old decision value is **preserved** until the stage loop returns with `outcome: 'complete'`. If the user cancels or navigates away before making a new decision, the original decision is restored. Only once a new decision is confirmed does the old value get replaced and `invalidateAfter` fire.

### After the Decision Changes

Once the stage loop completes with the new decision, call `manager.invalidateAfter(changedId)`.

### How `invalidateAfter` Works

```typescript
async invalidateAfter(changedId: string): Promise<void> {
  // Build a short prompt for Claude (non-streaming, separate from conversation):
  //
  //   "The user changed their {changedId} decision from {old} to {new}.
  //    Current decisions: {serialized progress}
  //    Current stages: {stage list}
  //
  //    Respond with JSON:
  //    {
  //      clear: string[]        — stage IDs whose decisions are now invalid
  //      add: StageEntry[]      — new stages to introduce
  //      remove: string[]       — stage IDs no longer relevant
  //    }
  //    Only include stages that are genuinely affected.
  //    If nothing needs to change, return empty arrays."
  //
  // Apply the result: clear progress keys, reset stage statuses,
  // add/remove stages from the list.
}
```

### Few-Shot Examples in the Invalidation Prompt

Include 2-3 examples to calibrate conservatism:

```
Example 1: Changed frontend from Next.js → Astro (backend was "Next.js API routes")
→ { "clear": ["backend"], "add": [], "remove": [] }
Reason: Backend decision was "Next.js API routes" which is tied to Next.js. Astro needs a separate backend.
Note: If backend had been "Express" (independent of frontend), it would NOT be cleared.

Example 2: Changed auth from Clerk → Auth.js
→ { "clear": [], "add": [], "remove": [] }
Reason: Swapping auth providers doesn't affect other decisions.

Example 3: Changed frontend from Next.js → static HTML
→ { "clear": ["backend", "auth", "ai"], "add": [], "remove": ["payments"] }
Reason: Static site fundamentally changes what's viable.
```

### Guardrail

The LLM can only affect stages *after* the changed stage in the ordered list. Earlier decisions are never invalidated by later ones.

### Cost

This is a single small API call with a focused prompt — no tool use, no streaming, minimal tokens. It only fires when a user changes an existing decision, which should be infrequent.

---

## Section 6: Resume Flow

### Startup Detection

```
1. const saved = StageManager.detect(cwd)
2. If no saved session → StageManager.start(), enter stage loop
3. If saved session found → show summary, ask resume/fresh
```

### Resume UI

```
┌  Found saved progress for "my-app"
│
│  ✓ Frontend        — Next.js
│  ✓ Database        — Postgres + Drizzle
│  ○ Auth, Payments, Deployment
│
│  Last updated: 2 hours ago
│
◆  Resume or start fresh?
└
```

- **Resume** → `StageManager.resume()`, enter stage loop at `currentStage()`
- **Start fresh** → delete file, `StageManager.start()`

### Messages Restoration

On resume, the saved `messages` array is loaded back. Since `summarize_stage` has already compressed completed stages, the context is compact. Claude receives the full message history plus the system prompt with current progress — it picks up naturally.

### Messages Serialization

The Anthropic SDK's `MessageParam` type is a plain object (no class instances, symbols, or functions), so it round-trips through `JSON.stringify`/`JSON.parse` faithfully. As a safety measure, add a size check after serialization — if the session exceeds 500KB, log a warning. In practice, summarized conversations should be well under this threshold.

### Stale Sessions

No automatic expiry. The timestamp is displayed so the user can judge freshness. A week-old session still works — decisions are decisions regardless of age.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/agent/stage-manager.ts` | Create | `StageManager` class — stage list, persistence, navigation, invalidation |
| `src/agent/stages.ts` | Create | Default stage definitions, `StageEntry` type, stage-related constants |
| `src/agent/loop.ts` | Modify | Refactor into `runStageLoop` (per-stage) + keep `runScaffoldLoop` as-is |
| `src/agent/system-prompt.ts` | Modify | Accept current stage ID, scope prompt to active stage |
| `src/agent/progress.ts` | Modify | Add `SavedSession` interface, serialization/deserialization for full session |
| `src/cli/chat.ts` | Modify | `getUserInput` returns `InputResult`, add `renderStageList`, `renderResumePrompt`, `renderReviewScreen` |
| `src/index.ts` | Modify | Resume detection flow, `StageManager`-driven orchestration loop |

## Architecture Diagram

```
index.ts (entry)
  │
  ├── StageManager.detect() → resume prompt
  │
  ├── StageManager (orchestrator)
  │     ├── stages: StageEntry[]
  │     ├── progress: StackProgress
  │     ├── messages: MessageParam[]
  │     ├── save() / cleanup()
  │     ├── navigateTo() → stage list
  │     └── invalidateAfter() → LLM call
  │
  ├── runStageLoop(stage, manager)
  │     ├── buildConversationPrompt(progress, stageId)
  │     ├── chatStream() → Claude
  │     ├── executeConversationTool()
  │     └── returns StageLoopResult
  │
  └── runScaffoldLoop(progress) [unchanged]
```

---

## Testing Strategy

The codebase currently has zero tests. This feature introduces stateful persistence and a state machine, both of which are highly testable without LLM calls.

### Unit Tests (vitest)

| Test Suite | What It Covers |
|------------|----------------|
| `stage-manager.test.ts` | State transitions: `completeStage`, `skipStage`, `navigateTo` (with old-value preservation), `addStage`, `removeStage`, `currentStage` ordering |
| `stage-manager.test.ts` | Persistence: `save`/`resume` round-trip, atomic write behavior, corrupt file handling, version mismatch |
| `stage-manager.test.ts` | Invalidation: mock `InvalidationFn` returns, verify correct stages are cleared/added/removed, verify guardrail (only downstream stages affected) |
| `progress.test.ts` | Existing `clearDecision` + new `clearProjectInfo`, field-type-specific clearing logic |
| `stages.test.ts` | Default stage definitions, `progressKeys` mapping correctness |

### Integration Tests

| Test | What It Covers |
|------|----------------|
| Save/resume lifecycle | Create session → make decisions → save → load from file → verify state matches |
| Navigation round-trip | Complete stages → navigate back → verify old decision preserved → complete with new decision → verify invalidation called |

LLM-dependent behavior (`invalidateAfter` content quality, per-stage prompts) is best validated through manual testing and prompt iteration, not automated tests.
