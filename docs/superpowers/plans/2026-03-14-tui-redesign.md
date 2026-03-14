# TUI Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `@clack/prompts` with an `ink`-based fullscreen TUI featuring persistent header/footer frame, structured selectable options via `present_options` tool, and character-limited LLM responses.

**Architecture:** `fullscreen-ink` renders a React component tree (`<App>` → `<Header>`, `<ContentArea>`, `<Footer>`). A `ConversationBridge` connects the async conversation loop to React's render model via promise-based message passing. The `present_options` tool sends structured choices to the UI instead of text-based numbered lists. The `StageManager` and all persistence logic are untouched.

**Tech Stack:** TypeScript, ink, @inkjs/ui, fullscreen-ink, React, vitest

**Spec:** `docs/superpowers/specs/2026-03-14-tui-redesign-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/cli/bridge.ts` | Create | `ConversationBridge` interface and implementation |
| `src/cli/app.tsx` | Create | Root `<App>` component — state machine, bridge setup, orchestration |
| `src/cli/components/header.tsx` | Create | Stage name, progress dots, ◂ Stages |
| `src/cli/components/footer.tsx` | Create | Accumulated decisions, next stage |
| `src/cli/components/conversation.tsx` | Create | Streaming text display with line truncation |
| `src/cli/components/option-select.tsx` | Create | Select + free-text input for present_options |
| `src/cli/components/stage-list.tsx` | Create | Stage navigation Select |
| `src/cli/components/review.tsx` | Create | Final confirmation screen |
| `src/cli/mockup.tsx` | Create | Interactive mockup with fake data for UX refinement |
| `src/cli/chat.ts` | Modify | Gut to renderMarkdown + renderPostScaffold only |
| `src/agent/tools.ts` | Modify | Add `present_options` tool definition |
| `src/agent/system-prompt.ts` | Modify | Add character limits and present_options instructions |
| `src/agent/loop.ts` | Modify | Replace stdout/getUserInput with bridge methods |
| `src/index.ts` | Modify | Replace clack with ink fullscreen render |
| `tsconfig.json` | Modify | Add `"jsx": "react-jsx"` |
| `tsup.config.ts` | Modify | Add `.tsx` entry point handling |
| `package.json` | Modify | Add ink/react deps, remove @clack/prompts |
| `tests/agent/tools.test.ts` | Modify | Add present_options tests |
| `tests/agent/system-prompt.test.ts` | Modify | Update prompt assertions |
| `tests/agent/loop.test.ts` | Modify | Mock bridge instead of getUserInput |
| `tests/cli/bridge.test.ts` | Create | Bridge promise resolution tests |

---

## Chunk 1: Foundation — Dependencies, Config, Bridge

### Task 1: Install Dependencies and Configure JSX

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `tsup.config.ts`

- [ ] **Step 1: Install new dependencies**

```bash
npm install ink @inkjs/ui fullscreen-ink react
npm install --save-dev @types/react
```

- [ ] **Step 2: Remove @clack/prompts**

```bash
npm uninstall @clack/prompts
npm uninstall @types/marked-terminal
```

Note: Do NOT remove `@clack/prompts` yet — other files still import it. We'll remove the dependency in a later task after all references are gone. Skip this step for now.

- [ ] **Step 3: Add JSX config to tsconfig.json**

Add `"jsx": "react-jsx"` to `compilerOptions` in `tsconfig.json`.

- [ ] **Step 4: Update tsup.config.ts for TSX**

The current entry is `['src/index.ts']`. Change to `['src/index.tsx']` since index.ts will become index.tsx (it will render React). Actually, keep it as `src/index.ts` — the entry point can import `.tsx` files without itself being TSX. No change needed.

- [ ] **Step 5: Verify build still works**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json
git commit -m "chore: add ink, react, fullscreen-ink dependencies and JSX config"
```

---

### Task 2: ConversationBridge

**Files:**
- Create: `src/cli/bridge.ts`
- Create: `tests/cli/bridge.test.ts`

- [ ] **Step 1: Write bridge tests**

Create `tests/cli/bridge.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { createBridge } from '../../src/cli/bridge.js'

describe('ConversationBridge', () => {
  it('waitForInput resolves when resolveInput is called', async () => {
    const bridge = createBridge()
    const promise = bridge.waitForInput()
    bridge.resolveInput({ kind: 'text', value: 'hello' })
    const result = await promise
    expect(result).toEqual({ kind: 'text', value: 'hello' })
  })

  it('waitForInput can be called multiple times sequentially', async () => {
    const bridge = createBridge()

    const p1 = bridge.waitForInput()
    bridge.resolveInput({ kind: 'text', value: 'first' })
    expect(await p1).toEqual({ kind: 'text', value: 'first' })

    const p2 = bridge.waitForInput()
    bridge.resolveInput({ kind: 'cancel' })
    expect(await p2).toEqual({ kind: 'cancel' })
  })

  it('onStreamText calls registered listener', () => {
    const bridge = createBridge()
    const listener = vi.fn()
    bridge.subscribe('streamText', listener)
    bridge.onStreamText('hello ')
    bridge.onStreamText('world')
    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener).toHaveBeenCalledWith('hello ')
    expect(listener).toHaveBeenCalledWith('world')
  })

  it('onPresentOptions calls registered listener', () => {
    const bridge = createBridge()
    const listener = vi.fn()
    bridge.subscribe('presentOptions', listener)
    const options = [{ label: 'Next.js', description: 'Full-stack React' }]
    bridge.onPresentOptions(options)
    expect(listener).toHaveBeenCalledWith(options)
  })

  it('onError calls registered listener', () => {
    const bridge = createBridge()
    const listener = vi.fn()
    bridge.subscribe('error', listener)
    bridge.onError(new Error('API failed'))
    expect(listener).toHaveBeenCalledWith(expect.any(Error))
  })

  it('onSpinnerStart calls registered listener', () => {
    const bridge = createBridge()
    const listener = vi.fn()
    bridge.subscribe('spinnerStart', listener)
    bridge.onSpinnerStart()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('onStreamEnd calls registered listener', () => {
    const bridge = createBridge()
    const listener = vi.fn()
    bridge.subscribe('streamEnd', listener)
    bridge.onStreamEnd('full text')
    expect(listener).toHaveBeenCalledWith('full text')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/cli/bridge.test.ts
```

- [ ] **Step 3: Implement bridge**

Create `src/cli/bridge.ts`:

```typescript
export interface ToolOption {
  label: string
  description: string
  recommended?: boolean
}

export type InputResult =
  | { kind: 'text'; value: string }
  | { kind: 'cancel' }
  | { kind: 'navigate' }
  | { kind: 'select'; value: string }

type BridgeEvent =
  | 'streamText'
  | 'streamEnd'
  | 'presentOptions'
  | 'spinnerStart'
  | 'stageComplete'
  | 'error'

export interface ConversationBridge {
  // Loop → UI
  onStreamText: (delta: string) => void
  onStreamEnd: (fullText: string) => void
  onPresentOptions: (options: ToolOption[]) => void
  onSpinnerStart: () => void
  onStageComplete: (summary: string) => void
  onError: (error: Error) => void

  // UI → Loop
  waitForInput: () => Promise<InputResult>
  resolveInput: (result: InputResult) => void

  // Event subscription for React components
  subscribe: (event: BridgeEvent, listener: (...args: any[]) => void) => () => void
}

export function createBridge(): ConversationBridge {
  const listeners = new Map<BridgeEvent, Set<(...args: any[]) => void>>()

  let pendingResolve: ((result: InputResult) => void) | null = null

  function emit(event: BridgeEvent, ...args: any[]) {
    const set = listeners.get(event)
    if (set) {
      for (const fn of set) fn(...args)
    }
  }

  return {
    onStreamText: (delta) => emit('streamText', delta),
    onStreamEnd: (fullText) => emit('streamEnd', fullText),
    onPresentOptions: (options) => emit('presentOptions', options),
    onSpinnerStart: () => emit('spinnerStart'),
    onStageComplete: (summary) => emit('stageComplete', summary),
    onError: (error) => emit('error', error),

    waitForInput: () => {
      return new Promise<InputResult>((resolve) => {
        pendingResolve = resolve
      })
    },

    resolveInput: (result) => {
      if (pendingResolve) {
        const resolve = pendingResolve
        pendingResolve = null
        resolve(result)
      }
    },

    subscribe: (event, listener) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set())
      }
      listeners.get(event)!.add(listener)
      return () => {
        listeners.get(event)?.delete(listener)
      }
    },
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/cli/bridge.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/cli/bridge.ts tests/cli/bridge.test.ts
git commit -m "feat: add ConversationBridge for loop-to-UI communication"
```

---

### Task 3: Add `present_options` Tool

**Files:**
- Modify: `src/agent/tools.ts`
- Modify: `tests/agent/tools.test.ts`

- [ ] **Step 1: Add present_options to conversationToolDefinitions**

In `src/agent/tools.ts`, add a new tool object to the array returned by `conversationToolDefinitions()`, after `summarize_stage`:

```typescript
    {
      name: 'present_options',
      description: 'Presents technology options for the user to choose from. The UI renders these as selectable items.',
      input_schema: {
        type: 'object',
        properties: {
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: {
                  type: 'string',
                  description: 'Short name of the option (max 30 chars).',
                },
                description: {
                  type: 'string',
                  description: 'One-line description of the option (max 80 chars).',
                },
                recommended: {
                  type: 'boolean',
                  description: 'Whether this is the recommended option. At most one should be true.',
                },
              },
              required: ['label', 'description'],
            },
            minItems: 2,
            maxItems: 3,
          },
        },
        required: ['options'],
      },
    },
```

Note: `present_options` has NO handler in `executeConversationTool`. It is intercepted in the loop. If `executeConversationTool` receives it, return a generic "handled externally" response.

Add to the end of `executeConversationTool`, before the final `return` for unknown tools:

```typescript
  if (name === 'present_options') {
    return {
      progress,
      response: 'Options presented to user.',
    }
  }
```

- [ ] **Step 2: Add tests**

Append to `tests/agent/tools.test.ts`:

```typescript
describe('present_options', () => {
  it('is included in conversation tool definitions', () => {
    const tools = conversationToolDefinitions()
    const names = tools.map((t) => t.name)
    expect(names).toContain('present_options')
  })

  it('returns a fallback response from executeConversationTool', () => {
    const result = executeConversationTool(
      'present_options',
      { options: [{ label: 'Next.js', description: 'Full-stack' }] },
      progress,
      messages,
    )
    expect(result.response).toBe('Options presented to user.')
    expect(result.progress).toBe(progress)
  })
})
```

Also update the tool count test — change from 3 to 4 tools.

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/agent/tools.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/agent/tools.ts tests/agent/tools.test.ts
git commit -m "feat: add present_options tool definition"
```

---

### Task 4: Update System Prompt with Character Limits

**Files:**
- Modify: `src/agent/system-prompt.ts`
- Modify: `tests/agent/system-prompt.test.ts`

- [ ] **Step 1: Update buildConversationPrompt**

In `src/agent/system-prompt.ts`, replace the options/formatting section of the prompt. The current prompt has:

```
For each set of options, number them (1, 2, 3...) so users can respond quickly. Explicitly label your top pick with "(Recommended)" and explain WHY it's the best fit. Be opinionated — you are a senior architect, not a menu.
```

Replace with:

```
Response guidelines:
- When presenting technology choices, call \`present_options\` with 2-3 options. Do NOT write numbered lists in text.
- Option labels: max 30 characters (just the name).
- Option descriptions: max 80 characters (one-line trade-off summary).
- Mark at most one option as recommended.
- After a user selects an option, confirm in one short sentence (max 60 chars) and call set_decision immediately.
- When answering questions, keep responses under 500 characters. Most answers should be 1-2 sentences. Only approach 500 chars for genuinely complex comparisons.
- Never congratulate or explain why a choice is great. Just confirm and move on.
```

- [ ] **Step 2: Update tests**

In `tests/agent/system-prompt.test.ts`, update any assertion that checks for old prompt text (numbered lists, etc.) to check for new text (e.g., `present_options`, character limits).

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/agent/system-prompt.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/agent/system-prompt.ts tests/agent/system-prompt.test.ts
git commit -m "feat: add character limits and present_options instructions to prompt"
```

---

## Chunk 2: ink Components

### Task 5: Header Component

**Files:**
- Create: `src/cli/components/header.tsx`

- [ ] **Step 1: Implement Header**

```tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { StageEntry } from '../../agent/stages.js'

interface HeaderProps {
  appName: string
  currentStage: StageEntry | null
  stages: StageEntry[]
  stageIndex: number
  totalStages: number
}

export function Header({ appName, currentStage, stages, stageIndex, totalStages }: HeaderProps) {
  const dots = stages.map((s) => {
    if (s.status === 'complete') return '●'
    if (s.status === 'skipped') return '–'
    if (s.id === currentStage?.id) return '●'
    return '○'
  }).join('')

  const stageName = currentStage?.label ?? 'Review'

  return (
    <Box borderStyle="single" borderBottom={false} paddingX={1} justifyContent="space-between">
      <Box gap={2}>
        <Text bold color="cyan">{appName}</Text>
        <Text dimColor>◂ Stages</Text>
        <Text bold>{stageName}</Text>
      </Box>
      <Box gap={2}>
        <Text>{dots}</Text>
        <Text dimColor>{stageIndex} of {totalStages}</Text>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit src/cli/components/header.tsx 2>&1 || npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/cli/components/header.tsx
git commit -m "feat: add Header component with stage progress"
```

---

### Task 6: Footer Component

**Files:**
- Create: `src/cli/components/footer.tsx`

- [ ] **Step 1: Implement Footer**

```tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { StageEntry } from '../../agent/stages.js'
import type { StackProgress } from '../../agent/progress.js'

interface FooterProps {
  progress: StackProgress
  stages: StageEntry[]
  terminalWidth: number
}

export function Footer({ progress, stages, terminalWidth }: FooterProps) {
  const decisions: string[] = []

  if (progress.projectName) decisions.push(`Project: ${progress.projectName}`)
  if (progress.frontend) decisions.push(`Frontend: ${progress.frontend.component}`)
  if (progress.backend) decisions.push(`Backend: ${progress.backend.component}`)
  if (progress.database) decisions.push(`DB: ${progress.database.component}`)
  if (progress.auth) decisions.push(`Auth: ${progress.auth.component}`)
  if (progress.payments) decisions.push(`Pay: ${progress.payments.component}`)
  if (progress.ai) decisions.push(`AI: ${progress.ai.component}`)
  if (progress.deployment) decisions.push(`Deploy: ${progress.deployment.component}`)

  const nextStage = stages.find((s) => s.status === 'pending')
  const nextText = nextStage ? `Next: ${nextStage.label}` : ''

  // Truncate decisions to fit terminal width
  const separator = ' │ '
  let display = decisions.map((d) => `✓ ${d}`).join(separator)
  if (nextText) {
    display = display ? `${display}${separator}${nextText}` : nextText
  }

  const maxWidth = terminalWidth - 4 // account for border padding
  if (display.length > maxWidth) {
    display = display.slice(0, maxWidth - 1) + '…'
  }

  return (
    <Box borderStyle="single" borderTop={false} paddingX={1}>
      <Text dimColor>{display}</Text>
    </Box>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/components/footer.tsx
git commit -m "feat: add Footer component with accumulated decisions"
```

---

### Task 7: ConversationView Component

**Files:**
- Create: `src/cli/components/conversation.tsx`

- [ ] **Step 1: Implement ConversationView**

```tsx
import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import { Spinner } from '@inkjs/ui'
import type { ConversationBridge } from '../bridge.js'

interface ConversationViewProps {
  bridge: ConversationBridge
  maxLines: number
}

export function ConversationView({ bridge, maxLines }: ConversationViewProps) {
  const [text, setText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [showSpinner, setShowSpinner] = useState(false)

  useEffect(() => {
    const unsubs = [
      bridge.subscribe('spinnerStart', () => {
        setShowSpinner(true)
        setIsStreaming(false)
        setText('')
      }),
      bridge.subscribe('streamText', (delta: string) => {
        setShowSpinner(false)
        setIsStreaming(true)
        setText((prev) => prev + delta)
      }),
      bridge.subscribe('streamEnd', () => {
        setIsStreaming(false)
      }),
    ]
    return () => unsubs.forEach((fn) => fn())
  }, [bridge])

  if (showSpinner) {
    return (
      <Box paddingX={1}>
        <Spinner label="Thinking..." />
      </Box>
    )
  }

  // Truncate to last maxLines lines
  const lines = text.split('\n')
  const visible = lines.slice(-maxLines)

  return (
    <Box flexDirection="column" paddingX={1}>
      {visible.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
    </Box>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/components/conversation.tsx
git commit -m "feat: add ConversationView with streaming text and line truncation"
```

---

### Task 8: OptionSelect Component

**Files:**
- Create: `src/cli/components/option-select.tsx`

- [ ] **Step 1: Implement OptionSelect**

This is a custom component wrapping `@inkjs/ui` `Select` with a free-text escape hatch.

```tsx
import React, { useState } from 'react'
import { Box, Text } from 'ink'
import { Select, TextInput } from '@inkjs/ui'
import type { ToolOption, InputResult } from '../bridge.js'

interface OptionSelectProps {
  options: ToolOption[]
  onSelect: (result: InputResult) => void
}

export function OptionSelect({ options, onSelect }: OptionSelectProps) {
  const [mode, setMode] = useState<'select' | 'text'>('select')

  if (mode === 'text') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <TextInput
          placeholder="Type your question or suggestion..."
          onSubmit={(value) => {
            onSelect({ kind: 'text', value })
          }}
        />
      </Box>
    )
  }

  // Build select options with recommended tag
  let hasRecommended = false
  const selectOptions = options.map((opt) => {
    let label = opt.label
    if (opt.recommended && !hasRecommended) {
      label += ' (Recommended)'
      hasRecommended = true
    }
    return {
      label,
      value: opt.label,
      description: opt.description,
    }
  })

  // Add free-text option
  selectOptions.push({
    label: 'Something else or ask a question...',
    value: '__freetext__',
    description: '',
  })

  return (
    <Box flexDirection="column" paddingX={1}>
      <Select
        options={selectOptions}
        onChange={(value) => {
          if (value === '__freetext__') {
            setMode('text')
          } else {
            onSelect({ kind: 'select', value })
          }
        }}
      />
    </Box>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/components/option-select.tsx
git commit -m "feat: add OptionSelect component with Select + free-text"
```

---

### Task 9: StageListView Component

**Files:**
- Create: `src/cli/components/stage-list.tsx`

- [ ] **Step 1: Implement StageListView**

```tsx
import React from 'react'
import { Box, Text } from 'ink'
import { Select } from '@inkjs/ui'
import type { StageEntry } from '../../agent/stages.js'
import { isComplete, type StackProgress } from '../../agent/progress.js'

export type StageListResult =
  | { kind: 'select'; stageId: string }
  | { kind: 'review' }
  | { kind: 'cancel' }

interface StageListViewProps {
  stages: StageEntry[]
  currentStageId: string | null
  progress: StackProgress
  onResult: (result: StageListResult) => void
}

export function StageListView({ stages, currentStageId, progress, onResult }: StageListViewProps) {
  const canReview = isComplete(progress)

  const options = stages.map((stage) => {
    let prefix: string
    if (stage.status === 'complete') prefix = '✓'
    else if (stage.status === 'skipped') prefix = '–'
    else if (stage.id === currentStageId) prefix = '●'
    else prefix = '○'

    return {
      label: `${prefix} ${stage.label}`,
      value: stage.id,
      description: stage.summary ?? (stage.id === currentStageId ? 'current' : ''),
    }
  })

  // Add Review & Build
  const remaining = requiredRemaining(progress)
  options.push({
    label: `★ Review & Build`,
    value: '__review__',
    description: canReview ? '' : `${remaining} required decision${remaining !== 1 ? 's' : ''} remaining`,
  })

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold>Stack Progress</Text>
        <Text dimColor>  (Esc to go back)</Text>
      </Box>
      <Select
        options={options}
        onChange={(value) => {
          if (value === '__review__') {
            if (canReview) {
              onResult({ kind: 'review' })
            }
            // If not ready, do nothing (user sees the "remaining" hint)
          } else {
            onResult({ kind: 'select', stageId: value })
          }
        }}
      />
    </Box>
  )
}

function requiredRemaining(progress: StackProgress): number {
  let count = 0
  if (!progress.projectName) count++
  if (!progress.description) count++
  if (!progress.frontend) count++
  if (!progress.database) count++
  if (!progress.deployment) count++
  return count
}
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/components/stage-list.tsx
git commit -m "feat: add StageListView component"
```

---

### Task 10: ReviewView Component

**Files:**
- Create: `src/cli/components/review.tsx`

- [ ] **Step 1: Implement ReviewView**

```tsx
import React from 'react'
import { Box, Text } from 'ink'
import { Select } from '@inkjs/ui'
import { serializeProgress, type StackProgress } from '../../agent/progress.js'

export type ReviewResult = 'confirm' | 'adjust' | 'cancel'

interface ReviewViewProps {
  progress: StackProgress
  onResult: (result: ReviewResult) => void
}

export function ReviewView({ progress, onResult }: ReviewViewProps) {
  const plan = serializeProgress(progress)
  const lines = plan.split('\n')

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold>Your Stack</Text>
      </Box>
      <Box flexDirection="column" marginBottom={1}>
        {lines.map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Box>
      <Select
        options={[
          { label: 'Confirm & build', value: 'confirm' },
          { label: 'Go back and adjust', value: 'adjust' },
          { label: 'Cancel (progress saved)', value: 'cancel' },
        ]}
        onChange={(value) => onResult(value as ReviewResult)}
      />
    </Box>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/components/review.tsx
git commit -m "feat: add ReviewView component"
```

---

## Chunk 2.5: Interactive Mockup for UX Refinement

### Task 11: Interactive Mockup

**Files:**
- Create: `src/cli/mockup.tsx`

This is a standalone fullscreen app with hardcoded fake data. It lets you test the header/footer frame, stage navigation, option selection, review screen, and overall feel — all without any LLM calls. Run it, iterate on the layout, then move to real integration.

- [ ] **Step 1: Create the mockup**

Create `src/cli/mockup.tsx`:

```tsx
import React, { useState } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import { withFullScreen, useScreenSize } from 'fullscreen-ink'
import { Select, TextInput } from '@inkjs/ui'
import { Header } from './components/header.js'
import { Footer } from './components/footer.js'
import { ConversationView } from './components/conversation.js'
import { OptionSelect } from './components/option-select.js'
import { StageListView } from './components/stage-list.js'
import { ReviewView } from './components/review.js'
import { createBridge } from './bridge.js'
import { createProgress, setDecision, type StackProgress } from '../agent/progress.js'
import { DEFAULT_STAGES, type StageEntry } from '../agent/stages.js'

type MockView = 'conversation' | 'options' | 'stage_list' | 'review' | 'input'

// Fake data
const FAKE_OPTIONS = [
  { label: 'Next.js', description: 'Server components, API routes built in', recommended: true },
  { label: 'Vite + React', description: 'Fast builds, maximum flexibility' },
  { label: 'Astro', description: 'Content-first, island architecture' },
]

function MockApp() {
  const app = useApp()
  const { width, height } = useScreenSize()
  const [view, setView] = useState<MockView>('conversation')
  const [inputFocused, setInputFocused] = useState(false)
  const [stages] = useState<StageEntry[]>(() => {
    const s = structuredClone(DEFAULT_STAGES)
    s[0].status = 'complete'
    s[0].summary = 'my-app: a task management SaaS'
    return s
  })
  const [progress] = useState<StackProgress>(() => {
    let p = createProgress()
    p = { ...p, projectName: 'my-app', description: 'a task management SaaS' }
    return p
  })
  const [bridge] = useState(() => createBridge())
  const [messages, setMessages] = useState<string[]>([
    'For a task management SaaS, these frameworks all work well.',
    '',
    '(Options will appear below)',
  ])

  // Simulate streaming text
  React.useEffect(() => {
    for (const msg of messages) {
      bridge.onStreamText(msg + '\n')
    }
    bridge.onStreamEnd(messages.join('\n'))
  }, [])

  // Global left-arrow handler
  useInput((input, key) => {
    if (key.leftArrow && !inputFocused && view !== 'stage_list' && view !== 'review') {
      setView('stage_list')
    }
    if (key.escape) {
      if (view === 'stage_list') {
        setView('conversation')
      } else if (inputFocused) {
        setInputFocused(false)
        setView('conversation')
      }
    }
    if (input === 'q') {
      app.exit()
    }
    // Number keys to switch views for testing
    if (input === '1') { setView('conversation'); setInputFocused(false) }
    if (input === '2') { setView('options'); setInputFocused(true) }
    if (input === '3') { setView('stage_list'); setInputFocused(false) }
    if (input === '4') { setView('review'); setInputFocused(false) }
    if (input === '5') { setView('input'); setInputFocused(true) }
  }, { isActive: !inputFocused })

  const currentStage = stages.find((s) => s.status === 'pending') ?? null
  const stageIndex = stages.filter((s) => s.status === 'complete').length + 1
  const contentHeight = height - 4

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Header
        appName="stack-agent"
        currentStage={currentStage}
        stages={stages}
        stageIndex={stageIndex}
        totalStages={stages.length}
      />

      <Box flexDirection="column" flexGrow={1}>
        {view === 'conversation' && (
          <Box flexDirection="column" paddingX={1}>
            <ConversationView bridge={bridge} maxLines={contentHeight} />
            <Box marginTop={1}>
              <Text dimColor>Keys: 1=conversation 2=options 3=stages 4=review 5=input ←=stages q=quit</Text>
            </Box>
          </Box>
        )}
        {view === 'options' && (
          <OptionSelect
            options={FAKE_OPTIONS}
            onSelect={(result) => {
              setInputFocused(false)
              setView('conversation')
            }}
          />
        )}
        {view === 'input' && (
          <Box flexDirection="column" paddingX={1}>
            <ConversationView bridge={bridge} maxLines={contentHeight - 3} />
            <Box marginTop={1}>
              <TextInput
                placeholder="Type your response..."
                onSubmit={() => {
                  setInputFocused(false)
                  setView('conversation')
                }}
              />
            </Box>
          </Box>
        )}
        {view === 'stage_list' && (
          <StageListView
            stages={stages}
            currentStageId={currentStage?.id ?? null}
            progress={progress}
            onResult={() => setView('conversation')}
          />
        )}
        {view === 'review' && (
          <ReviewView
            progress={progress}
            onResult={() => setView('conversation')}
          />
        )}
      </Box>

      <Footer
        progress={progress}
        stages={stages}
        terminalWidth={width}
      />
    </Box>
  )
}

async function main() {
  const ink = withFullScreen(React.createElement(MockApp))
  await ink.start()
  await ink.waitUntilExit()
  console.log('Mockup exited. Use this to iterate on layout and feel.')
}

main()
```

- [ ] **Step 2: Add a script to package.json**

Add to `scripts` in `package.json`:
```json
"mockup": "tsx src/cli/mockup.tsx"
```

- [ ] **Step 3: Run the mockup**

```bash
npm run mockup
```

Verify:
- Fullscreen frame appears with header (stage name, dots, ◂ Stages) and footer (decisions)
- Press number keys to switch between views (1-5)
- Press left arrow to see stage list
- Press Esc to return from stage list
- Press 2 to see selectable options — arrow through them, select one
- Press 5 to see text input field
- Press 4 to see review screen
- Press q to quit

**This is the UX iteration point.** Adjust component styling, spacing, colors, and layout until it feels right. Then proceed to the real integration.

- [ ] **Step 4: Commit**

```bash
git add src/cli/mockup.tsx package.json
git commit -m "feat: add interactive TUI mockup for UX refinement"
```

---

## Chunk 3: Loop Refactor and App Assembly

### Task 12: Refactor loop.ts to Use Bridge (was Task 11)

**Files:**
- Modify: `src/agent/loop.ts`

- [ ] **Step 1: Update imports**

Replace the chat.ts imports with bridge:

```typescript
// Remove:
import { getUserInput, renderError, createSpinner, writeText, writeLine } from '../cli/chat.js'

// Add:
import type { ConversationBridge } from '../cli/bridge.js'
```

- [ ] **Step 2: Update runStageLoop signature**

Add `bridge` parameter:

```typescript
export async function runStageLoop(
  stage: StageEntry,
  manager: StageManager,
  bridge: ConversationBridge,
  mcpServers?: Record<string, { url: string; apiKey?: string }>,
): Promise<StageLoopResult> {
```

- [ ] **Step 3: Replace stdout writes with bridge calls**

In the `chatStream` callbacks:
- Replace `writeText(delta)` with `bridge.onStreamText(delta)`
- Replace `writeText('\n')` and `writeLine()` calls with `bridge.onStreamText('\n')`
- Add `bridge.onSpinnerStart()` before the `chatStream` call
- Add `bridge.onStreamEnd(fullText)` after streaming completes (collect the full text from contentBlocks)

- [ ] **Step 4: Intercept present_options in tool loop**

In the tool processing loop (the `for (const block of toolUseBlocks)` section), add a special case BEFORE `executeConversationTool`:

```typescript
        if (toolBlock.name === 'present_options') {
          const options = (toolBlock.input.options as Array<{ label: string; description: string; recommended?: boolean }>)
          bridge.onPresentOptions(options)
          const input = await bridge.waitForInput()

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: input.kind === 'select'
              ? `User selected: ${input.value}`
              : input.kind === 'text'
                ? `User wrote: ${input.value}`
                : 'User cancelled.',
          })
          continue
        }
```

- [ ] **Step 5: Replace getUserInput with bridge.waitForInput**

At the end of the loop (the "No tool use — get user input" section):

```typescript
    bridge.onStreamEnd(text)
    const inputResult = await bridge.waitForInput()
```

Replace `inputResult.value` references to handle the `select` kind as well.

- [ ] **Step 6: Update runScaffoldLoop to not depend on chat.ts UI functions**

`runScaffoldLoop` currently uses `renderError` and `createSpinner` from chat.ts. Since the scaffold phase exits fullscreen, these need to use plain console output or a simple inline spinner. Replace:
- `renderError(msg)` → `console.error(msg)`
- `createSpinner()` → a simple object with `start`/`stop` methods that use `process.stdout.write`

```typescript
function createSimpleSpinner() {
  return {
    start: (msg: string) => process.stdout.write(`  ${msg}...`),
    stop: (msg: string) => process.stdout.write(` ${msg}\n`),
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add src/agent/loop.ts
git commit -m "refactor: replace stdout/getUserInput with bridge in loop"
```

---

### Task 13: Update Loop Tests

**Files:**
- Modify: `tests/agent/loop.test.ts`

- [ ] **Step 1: Update mocks**

Replace `getUserInput` mocking with bridge mocking:

```typescript
import { createBridge } from '../../src/cli/bridge.js'

// Create a real bridge and control it from tests
function createTestBridge() {
  const bridge = createBridge()
  return {
    bridge,
    // Queue inputs that will be returned by waitForInput
    queueInput: (result: InputResult) => {
      // Use setTimeout to resolve after the loop calls waitForInput
      const origWait = bridge.waitForInput
      let callCount = 0
      bridge.waitForInput = () => {
        callCount++
        return Promise.resolve(result)
      }
    },
  }
}
```

Update all test calls from `runStageLoop(stage, manager)` to `runStageLoop(stage, manager, bridge)`.

- [ ] **Step 2: Run tests**

```bash
npx vitest run tests/agent/loop.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/agent/loop.test.ts
git commit -m "test: update loop tests for bridge-based input"
```

---

### Task 14: Create App.tsx — Root Component

**Files:**
- Create: `src/cli/app.tsx`

- [ ] **Step 1: Implement App**

This is the root component with state machine, bridge setup, and orchestration:

```tsx
import React, { useState, useEffect, useCallback } from 'react'
import { Box, useApp, useInput } from 'ink'
import { useScreenSize } from 'fullscreen-ink'
import { Header } from './components/header.js'
import { Footer } from './components/footer.js'
import { ConversationView } from './components/conversation.js'
import { OptionSelect } from './components/option-select.js'
import { StageListView } from './components/stage-list.js'
import { ReviewView } from './components/review.js'
import { TextInput } from '@inkjs/ui'
import { createBridge, type ConversationBridge, type InputResult, type ToolOption } from './bridge.js'
import type { StageManager } from '../agent/stage-manager.js'
import type { StageEntry } from '../agent/stages.js'
import type { StackProgress } from '../agent/progress.js'

type AppView = 'conversation' | 'options' | 'stage_list' | 'review' | 'input' | 'error'

interface AppProps {
  manager: StageManager
  runOrchestration: (manager: StageManager, bridge: ConversationBridge, signal: AbortSignal) => Promise<void>
}

export function App({ manager, runOrchestration }: AppProps) {
  const app = useApp()
  const { width, height } = useScreenSize()

  const [view, setView] = useState<AppView>('conversation')
  const [bridge] = useState(() => createBridge())
  const [currentStage, setCurrentStage] = useState<StageEntry | null>(manager.currentStage())
  const [progress, setProgress] = useState<StackProgress>(manager.progress)
  const [options, setOptions] = useState<ToolOption[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [inputFocused, setInputFocused] = useState(false)

  // Subscribe to bridge events
  useEffect(() => {
    const unsubs = [
      bridge.subscribe('presentOptions', (opts: ToolOption[]) => {
        setOptions(opts)
        setView('options')
        setInputFocused(true)
      }),
      bridge.subscribe('stageComplete', () => {
        setCurrentStage(manager.currentStage())
        setProgress({ ...manager.progress })
        if (!manager.currentStage()) {
          setView('review')
        } else {
          setView('conversation')
          setInputFocused(false)
        }
      }),
      bridge.subscribe('streamEnd', () => {
        setView('input')
        setInputFocused(true)
      }),
      bridge.subscribe('spinnerStart', () => {
        setView('conversation')
        setInputFocused(false)
      }),
      bridge.subscribe('error', (err: Error) => {
        setErrorMsg(err.message)
        setView('error')
      }),
    ]
    return () => unsubs.forEach((fn) => fn())
  }, [bridge, manager])

  // Start orchestration loop
  useEffect(() => {
    const controller = new AbortController()
    async function run() {
      try {
        await runOrchestration(manager, bridge, controller.signal)
        app.exit()
      } catch (err) {
        if (!controller.signal.aborted) {
          bridge.onError(err as Error)
        }
      }
    }
    run()
    return () => controller.abort()
  }, [])

  // Global left-arrow handler (only when no child has focus)
  useInput((input, key) => {
    if (key.leftArrow && !inputFocused && view !== 'stage_list' && view !== 'review') {
      setView('stage_list')
    }
    if (key.escape && view === 'stage_list') {
      setView('conversation')
    }
  }, { isActive: !inputFocused || view === 'stage_list' })

  const handleStageSelect = useCallback((result: { kind: string; stageId?: string }) => {
    if (result.kind === 'select' && result.stageId) {
      manager.navigateTo(result.stageId)
      setCurrentStage(manager.currentStage())
      setProgress({ ...manager.progress })
      setView('conversation')
      setInputFocused(false)
      bridge.resolveInput({ kind: 'navigate' })
    } else if (result.kind === 'review') {
      setView('review')
    } else if (result.kind === 'cancel') {
      setView('conversation')
    }
  }, [manager, bridge])

  const handleReview = useCallback((result: string) => {
    if (result === 'confirm') {
      bridge.resolveInput({ kind: 'text', value: '__confirm__' })
    } else if (result === 'adjust') {
      setView('stage_list')
    } else {
      manager.save()
      app.exit()
    }
  }, [manager, bridge, app])

  const handleOptionSelect = useCallback((result: InputResult) => {
    setInputFocused(false)
    setView('conversation')
    bridge.resolveInput(result)
  }, [bridge])

  const handleTextSubmit = useCallback((value: string) => {
    setInputFocused(false)
    setView('conversation')
    bridge.resolveInput({ kind: 'text', value })
  }, [bridge])

  const stages = manager.stages
  const stageIndex = stages.filter((s) => s.status === 'complete').length + 1
  const contentHeight = height - 4 // header + footer + borders

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Header
        appName="stack-agent"
        currentStage={currentStage}
        stages={stages}
        stageIndex={stageIndex}
        totalStages={stages.length}
      />

      <Box flexDirection="column" flexGrow={1}>
        {view === 'conversation' && (
          <ConversationView bridge={bridge} maxLines={contentHeight} />
        )}
        {view === 'input' && (
          <Box flexDirection="column">
            <ConversationView bridge={bridge} maxLines={contentHeight - 2} />
            <Box paddingX={1}>
              <TextInput
                placeholder="Type your response..."
                onSubmit={handleTextSubmit}
              />
            </Box>
          </Box>
        )}
        {view === 'options' && (
          <Box flexDirection="column">
            <ConversationView bridge={bridge} maxLines={contentHeight - 6} />
            <OptionSelect options={options} onSelect={handleOptionSelect} />
          </Box>
        )}
        {view === 'stage_list' && (
          <StageListView
            stages={stages}
            currentStageId={currentStage?.id ?? null}
            progress={progress}
            onResult={handleStageSelect}
          />
        )}
        {view === 'review' && (
          <ReviewView progress={progress} onResult={handleReview} />
        )}
        {view === 'error' && (
          <Box paddingX={1} flexDirection="column">
            <Text color="red" bold>Error: {errorMsg}</Text>
            <Text dimColor>Press Ctrl+C to exit</Text>
          </Box>
        )}
      </Box>

      <Footer
        progress={progress}
        stages={stages}
        terminalWidth={width}
      />
    </Box>
  )
}
```

Note: This is a starting point. The exact state transitions may need tuning during integration. The key architecture — bridge events driving React state, which drives view switches — is correct.

- [ ] **Step 2: Commit**

```bash
git add src/cli/app.tsx
git commit -m "feat: add root App component with state machine and bridge"
```

---

### Task 15: Rewrite index.ts

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Replace clack-based orchestration with ink**

The new `index.ts` needs to:
1. Handle resume prompt BEFORE entering fullscreen (since resume is a one-shot prompt)
2. Start fullscreen with the `<App>` component
3. Pass orchestration function that contains the StageManager loop
4. After ink exits, handle scaffold phase in normal stdout

```typescript
import React from 'react'
import { withFullScreen } from 'fullscreen-ink'
import { App } from './cli/app.js'
import { StageManager } from './agent/stage-manager.js'
import { serializeProgress } from './agent/progress.js'
import { chat } from './llm/client.js'
import { runStageLoop, runScaffoldLoop } from './agent/loop.js'
import { renderPostScaffold } from './cli/chat.js'
import { checkDeployReadiness } from './deploy/readiness.js'
import type { ConversationBridge } from './cli/bridge.js'
import type { InvalidationFn } from './agent/stages.js'

// ... keep INVALIDATION_PROMPT and createInvalidationFn unchanged ...

async function runOrchestration(
  manager: StageManager,
  bridge: ConversationBridge,
  signal: AbortSignal,
): Promise<void> {
  while (!signal.aborted) {
    const stage = manager.currentStage()

    if (!stage) {
      // All stages done — signal review
      bridge.onStageComplete('all')
      const input = await bridge.waitForInput()
      if (input.kind === 'text' && input.value === '__confirm__') {
        break // proceed to scaffold
      }
      // Otherwise loop continues (user adjusted and came back)
      continue
    }

    const result = await runStageLoop(stage, manager, bridge)

    switch (result.outcome) {
      case 'complete': {
        const wasNavigation = manager.isNavigating()
        const oldValue = manager.getPendingOldValue()
        manager.completeStage(stage.id, result.summary)
        manager.save()
        bridge.onStageComplete(result.summary)

        if (wasNavigation) {
          await manager.invalidateAfter(stage.id, oldValue)
          manager.save()
        }
        break
      }
      case 'skipped':
        manager.skipStage(stage.id)
        manager.save()
        bridge.onStageComplete('skipped')
        break
      case 'navigate':
        // Navigation is handled by the App component directly
        break
      case 'cancel':
        manager.save()
        return
    }
  }
}

async function main() {
  const cwd = process.cwd()
  const invalidationFn = createInvalidationFn()

  // Handle resume BEFORE fullscreen
  let manager: StageManager
  const existingSession = StageManager.detect(cwd)

  if (existingSession) {
    // Use simple console prompts for resume (before fullscreen)
    console.log(`\nFound saved progress for "${existingSession.progress.projectName ?? 'unnamed'}"`)
    console.log('Run with --fresh to start over, or press Enter to resume.\n')
    // For simplicity, auto-resume. --fresh flag handling can be added later.
    const resumed = StageManager.resume(cwd, invalidationFn)
    if (!resumed) {
      console.log('Could not restore session. Starting fresh.')
      manager = StageManager.start(cwd, invalidationFn)
    } else {
      manager = resumed
    }
  } else {
    manager = StageManager.start(cwd, invalidationFn)
  }

  // Phase 1: Fullscreen conversation
  const ink = withFullScreen(
    React.createElement(App, { manager, runOrchestration })
  )
  await ink.start()
  await ink.waitUntilExit()

  // Phase 2: Scaffold (normal stdout)
  if (manager.currentStage() === null) {
    console.log('\nScaffolding your project...\n')
    const success = await runScaffoldLoop(manager.progress)

    if (success) {
      const readiness = manager.progress.deployment
        ? checkDeployReadiness(manager.progress.deployment.component)
        : null
      renderPostScaffold(manager.progress.projectName!, readiness)
      manager.cleanup()
      console.log('\nHappy building!\n')
    } else {
      console.error('\nScaffolding encountered errors. Check the output above.\n')
    }
  }
}

const command = process.argv[2]

if (command === '--fresh') {
  const cwd = process.cwd()
  const tempManager = StageManager.resume(cwd)
  tempManager?.cleanup()
  console.log('Session cleared. Starting fresh.')
  // Fall through to normal init
}

if (!command || command === 'init' || command === '--fresh') {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
} else {
  console.error(`Unknown command: ${command}`)
  console.error('Usage: stack-agent [init] [--fresh]')
  process.exit(1)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat: rewrite index.ts with ink fullscreen app"
```

---

### Task 16: Gut chat.ts

**Files:**
- Modify: `src/cli/chat.ts`

- [ ] **Step 1: Strip to essentials**

Replace `src/cli/chat.ts` with just the markdown utility and post-scaffold rendering (used after fullscreen exits):

```typescript
import { Marked } from 'marked'
import { markedTerminal } from 'marked-terminal'
import type { ReadinessResult } from '../deploy/readiness.js'

// @ts-expect-error — marked-terminal types lag behind marked major versions
const marked = new Marked(markedTerminal())

export function renderMarkdown(text: string): string {
  return (marked.parse(text) as string).trimEnd()
}

export function renderPostScaffold(
  projectName: string,
  readiness: ReadinessResult | null,
): void {
  const localSteps = [
    `cd ${projectName}`,
    'cp .env.example .env   # fill in your values',
    'npm install',
    'npm run dev',
  ]
  console.log('\nLocal Development')
  console.log('  ' + localSteps.join('\n  '))

  if (readiness === null) return

  const lines: string[] = []
  if (readiness.cliInstalled && readiness.authenticated === true) {
    lines.push('\u2713 Ready to deploy')
    lines.push(`\u2192 ${readiness.deployCmd}`)
  } else if (!readiness.cliInstalled) {
    lines.push(`\u2717 ${readiness.cliName || 'CLI'} not found`)
    if (readiness.installCmd) lines.push(`  Install: ${readiness.installCmd}`)
    if (readiness.authCmd) lines.push(`  Then: ${readiness.authCmd}`)
    lines.push(`  Then: ${readiness.deployCmd}`)
  } else {
    lines.push(`\u2713 ${readiness.cliName} CLI installed`)
    if (readiness.authenticated === false) {
      lines.push(`\u2717 Not authenticated`)
      lines.push(`  Run: ${readiness.authCmd}`)
    } else {
      lines.push('? Authentication status unknown')
      lines.push(`  Try: ${readiness.authCmd}`)
    }
    lines.push(`  Then: ${readiness.deployCmd}`)
  }

  lines.push('')
  if (readiness.envVarCmd) {
    lines.push(`\u2139 Set production env vars with: ${readiness.envVarCmd}`)
  }
  lines.push('\u2139 See README.md \u2192 Deployment for full instructions')

  console.log(`\nDeployment (${readiness.platform})`)
  console.log('  ' + lines.join('\n  '))
}
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/chat.ts
git commit -m "refactor: gut chat.ts to markdown utility and post-scaffold output"
```

---

## Chunk 4: Integration, Testing, Polish

### Task 17: Remove @clack/prompts Dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Uninstall**

```bash
npm uninstall @clack/prompts
```

- [ ] **Step 2: Verify no remaining imports**

```bash
grep -r "@clack/prompts" src/ tests/
```

Expected: No matches. If any remain, remove them.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove @clack/prompts dependency"
```

---

### Task 18: Full Type Check, Test Suite, Build

- [ ] **Step 1: Type check**

```bash
npx tsc --noEmit
```

Fix any errors.

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Fix any failures.

- [ ] **Step 3: Build**

```bash
npm run build
```

Fix any build errors.

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve type, test, and build issues from TUI migration"
```

---

### Task 19: Smoke Test

- [ ] **Step 1: Run the app**

```bash
ANTHROPIC_API_KEY=<key> npm run dev
```

Verify:
- Fullscreen frame appears with header and footer
- Claude presents options as selectable items (not text)
- Selecting an option confirms briefly and moves on
- Left arrow (when not in text input) opens stage list
- Escape returns from stage list
- Completing required stages shows review screen
- Confirm exits fullscreen and scaffolding begins

- [ ] **Step 2: Test resume**

```bash
# Ctrl+C mid-session
ANTHROPIC_API_KEY=<key> npm run dev
# Should auto-resume
```

- [ ] **Step 3: Test --fresh flag**

```bash
ANTHROPIC_API_KEY=<key> npm run dev -- --fresh
# Should start fresh
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: TUI redesign complete — ink framework, structured options, persistent frame"
```
