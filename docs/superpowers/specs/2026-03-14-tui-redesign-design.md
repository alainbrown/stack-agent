# TUI Redesign: ink-Based Terminal UI with Structured Options

## Overview

Replace the `@clack/prompts` sequential CLI with a full-screen terminal UI built on `ink` (React for CLI). The new UI features a persistent header/footer frame, structured selectable options via a `present_options` tool, character-limited LLM responses, and a bridge pattern connecting the async conversation loop to React's render model.

## Goals

- **Persistent frame** — Header shows stage progress and `◂ Stages` navigation; footer shows accumulated decisions
- **Structured options** — LLM presents choices via `present_options` tool, CLI renders as selectable items with a free-text escape hatch
- **Concise responses** — Character limits enforced via system prompt so content fits the framed UI
- **Clean architecture** — Bridge pattern decouples the conversation loop from the rendering layer

## Non-Goals

- Multi-pane layouts or split views
- Mouse support
- Customizable themes or colors
- Scroll-back through conversation history (auto-scroll only)

---

## Section 1: Component Architecture

The app is a React component tree rendered by `fullscreen-ink`:

```
<App>                          ← fullscreen-ink wrapper, state machine
  <Header />                   ← stage name, progress dots, ◂ Stages button
  <ContentArea>                ← flexGrow=1, fills available space
    <ConversationView />       ← streaming messages from Claude
    <OptionSelect />           ← 2-3 options + free-text (from present_options tool)
    <TextInput />              ← free-text input when no options presented
    <StageListView />          ← replaces content when navigating
    <ReviewView />             ← final confirmation screen
  </ContentArea>
  <Footer />                   ← accumulated decisions, next stage hint
</App>
```

Only one child of `<ContentArea>` is active at a time, controlled by app state:

- `conversation` — streaming text + waiting for input
- `options` — Claude presented options via tool, user picks or types
- `stage_list` — user pressed ◂, browsing stages
- `review` — all stages done, confirm/adjust/cancel

The `StageManager` (from session robustness) drives the state — it is unchanged. Only the rendering layer is replaced.

---

## Section 2: The `present_options` Tool

A new tool added to `conversationToolDefinitions()` that Claude calls instead of writing numbered lists as text:

```typescript
{
  name: 'present_options',
  input_schema: {
    type: 'object',
    properties: {
      options: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },        // max ~30 chars: "Next.js"
            description: { type: 'string' },   // max ~80 chars: "Server components, API routes built in"
            recommended: { type: 'boolean' },   // at most one true
          },
          required: ['label', 'description'],
        },
        minItems: 2,
        maxItems: 3,
      },
    },
    required: ['options'],
  },
}
```

The CLI renders this as a `Select` with the options plus a "Something else..." free-text item at the bottom. The tool result sent back to Claude is either:

- `"User selected: Next.js"` — if they picked an option
- `"User wrote: What about SvelteKit?"` — if they used free text

Claude then responds accordingly — either committing the decision with `set_decision` or answering the question.

The `recommended` flag renders a subtle `(Recommended)` tag next to that option's label. If Claude sets `recommended: true` on multiple options, the UI only renders the tag on the first one.

### Multi-Round Options (Extras Stage)

For stages like `extras` that support multiple decisions, Claude can call `present_options` multiple times. Each round presents a fresh set of options (e.g., "Analytics", "Email", "Monitoring"), and the user's selection triggers `set_decision` with `category: 'extras'` which appends to the array. Claude continues presenting rounds until it calls `summarize_stage` to signal completion. The `maxItems: 3` constraint applies per call, not per stage.

---

## Section 3: System Prompt Changes

The per-stage system prompt is updated to enforce character limits and use `present_options`:

```
Response guidelines:
- When presenting technology choices, call `present_options` with 2-3 options.
  Do NOT write numbered lists in text.
- Option labels: max 30 characters (just the name).
- Option descriptions: max 80 characters (one-line trade-off summary).
- After a user selects an option, confirm in one short sentence (max 60 chars)
  and call set_decision immediately.
- When answering questions, keep responses under 500 characters.
  Most answers should be 1-2 sentences. Only approach 500 chars for
  genuinely complex comparisons.
- Never congratulate or explain why a choice is great.
  Just confirm and move on.
```

Claude's output modes are now:

1. Short text message (confirmation, answer to question)
2. `present_options` tool call (structured choices)
3. `set_decision` / `set_project_info` / `summarize_stage` (state changes)

---

## Section 4: Layout and Rendering

### Header

Single line, always visible:

```
┌─ stack-agent ─── ◂ Stages ─── Frontend ─── ●●○○○○○○○ ─── 2 of 9 ─┐
```

- `◂ Stages` styled as a button (dim normally, highlighted when hovered/active)
- Stage name is bold
- Progress dots: filled (●) for complete/current, empty (○) for pending, dash (–) for skipped
- Responsive — `useScreenSize` adjusts spacing if terminal is narrow

### Footer

Single line, accumulated context:

```
└─ ✓ Project: my-app │ ✓ Frontend: Next.js │ Next: Database ──────────┘
```

- Completed decisions as compact chips
- "Next: {stage}" shows what's coming
- Truncates gracefully if too many decisions for terminal width

### Content Area

Fills everything between header and footer:

- **Streaming text** — Claude's messages render as they stream. `<ConversationView>` maintains a full text buffer but only renders the last `(screenHeight - 4)` lines (accounting for header, footer, and padding). New text appended via `onStreamText` triggers a re-render showing the latest content. This provides auto-scroll behavior without a custom scroll implementation
- **Options** — When `present_options` is called, `<OptionSelect>` renders. This is a **custom component** (not a raw `@inkjs/ui` `Select`) that wraps a `Select` with an extra "Something else..." item. When that item is selected via `onChange`, the component switches internal state to render a `TextInput` instead of the select. This is custom behavior layered on top of `@inkjs/ui`, not a built-in capability
- **Stage list** — Replaces content area entirely. Checklist (✓/●/○/–) rendered as a `Select`. Esc or selecting a stage returns to conversation
- **Review** — Shows the full decision summary + confirm/adjust/cancel `Select`
- **Spinner** — During Claude's thinking time (before text starts streaming), shows `@inkjs/ui` `Spinner` in the content area

---

## Section 5: Interaction Flow

### Normal Stage Flow

1. `StageManager.currentStage()` returns the active stage
2. App state → `conversation`, header updates to show stage name
3. `runStageLoop` calls Claude with the per-stage prompt
4. Claude calls `present_options` → app state → `options`, `<OptionSelect>` renders
5. User picks an option or types free text → result sent back to Claude
6. Claude calls `set_decision` + `summarize_stage` → stage complete
7. Footer updates with new decision, `StageManager` advances, loop repeats

### Left Arrow Navigation

1. A global `useInput` handler detects left arrow — but **only when no interactive child component has focus**. When `<OptionSelect>` or `<TextInput>` is active (tracked via a `focusState` in `<App>`), the global handler is disabled (`useInput`'s `isActive` option is set to `false`). This prevents left arrow from conflicting with cursor movement in text inputs or component-internal navigation.
2. When the global handler fires: app state → `stage_list`, content area swaps to `<StageListView>`
3. User picks a stage → `StageManager.navigateTo()`, app state → `conversation` for that stage
4. User presses Esc → app state returns to wherever they were

While an interactive component has focus, **Escape** is the navigation trigger instead — pressing Escape first defocuses the component (cancels the current input), then a subsequent left arrow (or Escape again) opens the stage list.

### Review

1. `StageManager.currentStage()` returns null (all done)
2. App state → `review`, `<ReviewView>` renders with confirm/adjust/cancel
3. Confirm → proceed to scaffold phase
4. Adjust → app state → `stage_list`
5. Cancel → save and exit

---

## Section 6: Loop Integration with ink

The async conversation loop is bridged to React's render model via a shared promise-based interface:

```typescript
interface ConversationBridge {
  // Loop calls these to update the UI
  onStreamText: (delta: string) => void
  onStreamEnd: (fullText: string) => void
  onPresentOptions: (options: ToolOption[]) => void
  onSpinnerStart: () => void
  onStageComplete: (summary: string) => void
  onError: (error: Error) => void

  // UI calls this to send user input back to the loop
  waitForInput: () => Promise<InputResult>
  resolveInput: (result: InputResult) => void
}
```

The `<App>` component creates this bridge and passes it down via React context. The conversation loop (running in the background) calls `bridge.waitForInput()` which returns a promise. When the user interacts with an ink component (selects an option, submits text, presses left arrow), the component calls `bridge.resolveInput(...)` which resolves the promise and the loop continues.

Streaming text flows the other direction — the loop calls `bridge.onStreamText(delta)` and `<ConversationView>` appends to its displayed text via React state.

This keeps the loop logic mostly unchanged — it still `await`s input and processes tool calls. The only change is where input comes from (ink components instead of `getUserInput`).

### `present_options` Handling in the Loop

The `present_options` tool is the one tool that requires user interaction mid-batch. It is **not** handled by `executeConversationTool` (which remains synchronous for all other tools). Instead, the loop intercepts it as a special case:

```
for each tool_use block in batch:
  if block.name === 'present_options':
    bridge.onPresentOptions(block.input.options)   // UI renders selectable options
    const input = await bridge.waitForInput()       // pause until user picks
    toolResults.push({
      tool_use_id: block.id,
      content: input.kind === 'text'
        ? `User wrote: ${input.value}`
        : `User selected: ${input.value}`
    })
  else:
    result = executeConversationTool(...)           // synchronous as before
    toolResults.push(...)
```

This means `present_options` never appears in `executeConversationTool`. It exists only in `conversationToolDefinitions()` (so Claude knows about it) and is intercepted in the loop.

When `onPresentOptions` is called, the UI transitions to the `options` state, renders the `<OptionSelect>` component, and waits for the user to pick or type. The user's choice calls `bridge.resolveInput(...)` which resolves the `waitForInput()` promise, and the loop resumes processing the remaining tools in the batch.

### Error Propagation

The bridge includes an error callback:

```typescript
onError: (error: Error) => void
```

If the LLM client throws during streaming (network error, rate limit, API key invalid) or an unexpected exception occurs in the loop, the loop calls `bridge.onError(error)`. The `<App>` component handles this by rendering an error message in the content area with options to retry or exit. This prevents the fullscreen app from freezing with a spinner.

### Loop Lifecycle

The conversation loop is started in a `useEffect` inside `<App>`:

```typescript
useEffect(() => {
  const controller = new AbortController()

  async function runLoop() {
    try {
      await runOrchestration(manager, bridge, controller.signal)
    } catch (err) {
      if (!controller.signal.aborted) {
        bridge.onError(err as Error)
      }
    }
  }

  runLoop()
  return () => controller.abort()
}, [])
```

The `runOrchestration` function contains the StageManager-driven loop currently in `index.ts` `main()`. It checks `controller.signal.aborted` before each `await` to support clean cancellation.

When the user exits (Ctrl+C or scaffold complete), `<App>` calls `app.exit()` from ink's `useApp()` hook. The `useEffect` cleanup fires, aborting the controller, which causes any pending `waitForInput()` to reject. The `fullscreen-ink` wrapper handles restoring the terminal's alternate buffer automatically on exit.

---

## Section 7: File Structure

### New Files

```
src/cli/
  app.tsx              ← Root <App> component, state machine, bridge setup
  components/
    header.tsx         ← Stage name, progress dots, ◂ Stages
    footer.tsx         ← Accumulated decisions, next stage
    conversation.tsx   ← Streaming text display
    option-select.tsx  ← present_options rendering (Select + TextInput)
    stage-list.tsx     ← Stage navigation (Select)
    review.tsx         ← Final confirmation screen
  bridge.ts            ← ConversationBridge interface and implementation
```

### Modified Files

```
src/cli/chat.ts        ← Gutted. Keep renderMarkdown only. Remove all UI functions.
src/agent/tools.ts     ← Add present_options tool definition + handler
src/agent/system-prompt.ts  ← Add character limits and present_options instructions
src/agent/loop.ts      ← Replace getUserInput with bridge.waitForInput,
                         replace writeText/writeLine with bridge.onStreamText
src/index.ts           ← Replace @clack/prompts intro/outro with ink render,
                         start fullscreen app
```

### Dependencies

**Add:**
- `ink` — core React renderer for CLI
- `@inkjs/ui` — Select, TextInput, Spinner components
- `fullscreen-ink` — full-screen alternate buffer, useScreenSize
- `react` — required by ink

**Remove:**
- `@clack/prompts` — fully replaced by ink

**Keep:**
- `marked` + `marked-terminal` — still used for markdown rendering in conversation text
- All existing dependencies (Anthropic SDK, zod, etc.)

---

## Section 8: Migration Strategy

### Untouched

- `StageManager` — all state, persistence, navigation, invalidation logic
- `progress.ts` — all types and serialization
- `stages.ts` — all types and defaults
- `scaffold/` — base scaffolding and integration writing
- `deploy/` — readiness checks
- `llm/client.ts` — API client

### Refactored

- `loop.ts` — Replace direct stdout writes and `getUserInput` calls with bridge methods. Core logic (tool execution, message management, summarization) stays the same.
- `tools.ts` — Add `present_options` tool. Existing tools unchanged.
- `system-prompt.ts` — Add character limits and `present_options` instructions. `buildScaffoldPrompt` unchanged.
- `index.ts` — Replace clack-based orchestration with ink app startup. StageManager orchestration logic moves into `app.tsx`.

### Replaced

- `chat.ts` — Stripped to just `renderMarkdown()` utility. All UI functions replaced by ink components.

### Scaffold Phase

The scaffold phase (`runScaffoldLoop`) currently uses `createSpinner` and `renderError` from `chat.ts`. In the ink UI, the app **exits fullscreen mode** before scaffolding begins — `fullscreen-ink` restores the terminal's normal buffer. Scaffold output (spinner, file writes, errors) renders to stdout as plain text, same as the current behavior. This avoids building a `<ScaffoldView>` component for a phase that is non-interactive and already works well.

The sequence is: fullscreen conversation → exit fullscreen → scaffold to stdout → post-scaffold output.

### TypeScript JSX Configuration

Adding `.tsx` files requires `tsconfig.json` changes:
- Add `"jsx": "react-jsx"` to `compilerOptions`
- Ensure `tsup.config.ts` handles `.tsx` entry points

### Test Impact

- `tests/agent/loop.test.ts` — Mocks change from `getUserInput` to `bridge.waitForInput/resolveInput`
- `tests/agent/tools.test.ts` — Add tests for `present_options` tool
- `tests/agent/system-prompt.test.ts` — Update assertions for new prompt text
- `tests/agent/stage-manager.test.ts` — No changes
- New: `tests/cli/` — Component tests for ink components (ink provides a testing utility)
