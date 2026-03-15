# stack-agent — Architecture

## Overview

stack-agent is an AI-powered CLI that helps developers choose and scaffold full-stack applications. It runs as a fullscreen terminal UI (built with ink/React), recommends an entire technology stack based on a project description, lets the user review and refine each decision, then scaffolds the project with integration code.

## Data Flow

```
1. User enters project name + description (hardcoded form, no LLM)
2. One LLM call recommends all stack decisions (frontend, db, auth, etc.)
3. Stage list shows all decisions — user reviews, confirms, or changes
4. User selects Build → scaffold phase runs in-frame with progress
5. Exit fullscreen → print post-scaffold summary to terminal
```

## Architecture

```
index.ts                         Entry point — resume detection, fullscreen setup
  │
  ├── cli/app.tsx                Root ink component — state machine, view routing
  │     ├── components/
  │     │   ├── header.tsx       Stage name, colored progress dots
  │     │   ├── footer.tsx       Context-aware: decisions or navigation hints
  │     │   ├── stage-list.tsx   Color-coded stages with Build option
  │     │   ├── option-select.tsx  Custom selectable options + inline text field
  │     │   ├── conversation.tsx Streaming text display with line truncation
  │     │   ├── scaffold-view.tsx  Step-by-step scaffold progress
  │     │   └── project-info-form.tsx  Name + description text inputs
  │     └── bridge.ts           Promise-based loop↔UI communication
  │
  ├── agent/
  │     ├── loop.ts             Per-stage conversation loop + scaffold loop
  │     ├── stage-manager.ts    Stage state, persistence, navigation, invalidation
  │     ├── stages.ts           StageEntry type, defaults, per-stage instructions
  │     ├── progress.ts         StackProgress type, session serialization
  │     ├── tools.ts            LLM tool definitions (conversation + scaffold)
  │     ├── system-prompt.ts    Per-stage prompts with character limits
  │     └── recommend.ts        One-shot LLM recommendation pass
  │
  ├── llm/client.ts             Anthropic SDK wrapper, streaming, logging
  ├── scaffold/
  │     ├── base.ts             CLI runner (npx create-*)
  │     └── integrate.ts        File writer, dependency merger, env vars
  ├── deploy/readiness.ts       Platform detection, CLI/auth checks
  └── util/logger.ts            Pino-based structured logging
```

## Key Modules

### StageManager (`agent/stage-manager.ts`)

Owns the stage list, persistence, and navigation. Each stage has a status (pending/complete/skipped) and a `confirmed` flag distinguishing user decisions from LLM suggestions.

- **Persistence** — Saves `StackProgress` + stages + messages to `.stack-agent.json` with atomic writes (tmp + rename)
- **Resume** — `StageManager.detect(cwd)` finds existing sessions; `StageManager.resume(cwd)` restores them
- **Navigation** — `navigateTo(id)` stashes the old decision; `restorePendingNavigation()` rolls back if the user cancels
- **Invalidation** — `invalidateAfter(id, oldValue)` delegates to an injected `InvalidationFn` that asks the LLM which downstream decisions are affected by a change

### ConversationBridge (`cli/bridge.ts`)

Connects the async conversation loop to React's render model. The loop calls `bridge.onStreamText(delta)` or `bridge.onPresentOptions(options)` to update the UI. The UI calls `bridge.resolveInput(result)` to send user input back. `bridge.waitForInput()` returns a promise that the loop awaits.

### Per-Stage Loop (`agent/loop.ts`)

`runStageLoop(stage, manager, bridge)` runs a conversation with Claude scoped to one stage. Claude can stream text, call `present_options` (intercepted in the loop, rendered as selectable items), call `set_decision` to commit a choice, and call `summarize_stage` to complete the stage.

`runScaffoldLoop(progress, onProgress)` runs the scaffold phase. Claude calls `run_scaffold` (executes a CLI like create-next-app) and `add_integration` (writes files, installs dependencies). Progress is reported via a callback that the App renders as a step list.

### Recommendation Pass (`agent/recommend.ts`)

After the user enters project info, one LLM call returns a JSON object with recommendations for every category. `applyRecommendations()` maps these onto `StackProgress` and marks stages as complete but not confirmed (yellow in the UI).

## LLM Tools

### Conversation Phase

| Tool | Purpose |
|------|---------|
| `set_decision` | Commit a stack decision (component + reasoning) |
| `set_project_info` | Set project name and description |
| `summarize_stage` | Compress conversation history, signal stage completion |
| `present_options` | Send 2-3 structured options to the UI for selection |

### Scaffold Phase

| Tool | Purpose |
|------|---------|
| `run_scaffold` | Execute a CLI scaffold tool (e.g., `npx create-next-app@latest`) |
| `add_integration` | Write files, merge dependencies, set env vars for an integration |

## Session Format

`.stack-agent.json`:
```json
{
  "version": 1,
  "createdAt": "...",
  "updatedAt": "...",
  "progress": { "projectName": "...", "frontend": {...}, ... },
  "stages": [{ "id": "frontend", "status": "complete", "confirmed": true, ... }],
  "messages": [...]
}
```

## UI States

The App component (`cli/app.tsx`) routes between views:

| View | When | Content |
|------|------|---------|
| `project_info` | First run, no saved session | Name + description form |
| `loading` | After project info submitted | Spinner while LLM recommends |
| `stage_list` | Home — between all actions | Color-coded stages + Build |
| `conversation` | Inside a stage, LLM streaming | Streaming text + spinner |
| `input` | LLM asked a question | Conversation + text input |
| `options` | LLM called present_options | Conversation + selectable list |
| `scaffold` | Build confirmed | Step-by-step progress |
| `error` | Something failed | Error message + Esc to return |

## Logging

Pino-based, writes to stderr. Levels controlled by `LOG_LEVEL` env var.

- **debug** — Full LLM request/response content, raw recommendation text
- **info** — LLM call metadata (stop reason, token usage), parsed recommendations
- **error** — Failures with stack traces
