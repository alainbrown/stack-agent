# create-stack v2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild create-stack as a conversational AI agent that helps developers choose and scaffold full-stack applications through a multi-turn Claude conversation with MCP-backed knowledge, delegating to official framework CLIs and generating integration code.

**Architecture:** Two-phase agent loop — Phase 1 is a multi-turn conversation where Claude uses tool_use to commit stack decisions to structured state. Phase 2 is an autonomous scaffold loop where Claude calls `run_scaffold` and `add_integration` to build the project. MCP servers (Context7) provide current documentation via the Anthropic API's native MCP connector.

**Tech Stack:** TypeScript, `@anthropic-ai/sdk` (beta MCP connector), `@clack/prompts`, Zod, Vitest, `tsx` (dev), `tsup` (build)

**Spec:** `docs/superpowers/specs/2026-03-13-create-stack-v2-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/index.ts` | Entry point — parse args, launch agent |
| `src/agent/progress.ts` | `StackProgress` state management — create, update, serialize |
| `src/agent/tools.ts` | Tool definitions (Zod schemas), tool executor dispatch |
| `src/agent/system-prompt.ts` | Build conversation and scaffold system prompts |
| `src/agent/loop.ts` | Multi-turn conversation loop (Phase 1) and scaffold loop (Phase 2) |
| `src/llm/client.ts` | Anthropic SDK wrapper — `beta.messages.create()` with MCP, tool_use, streaming |
| `src/cli/chat.ts` | Terminal chat interface — render agent messages, capture user input |
| `src/scaffold/base.ts` | Run official scaffold CLIs with validation (allowlist, args) |
| `src/scaffold/integrate.ts` | Write integration files, install deps, manage `.env.example` |
| `tests/agent/progress.test.ts` | Progress state tests |
| `tests/agent/tools.test.ts` | Tool execution tests |
| `tests/agent/system-prompt.test.ts` | System prompt builder tests |
| `tests/scaffold/base.test.ts` | Scaffold validation tests |
| `tests/scaffold/integrate.test.ts` | Integration file writing tests |
| `tests/agent/loop.test.ts` | Agent loop tests (mocked LLM) |

---

## Chunk 1: Clean Slate & Foundation

### Task 1: Delete v1 code and update project

**Files:**
- Delete: `src/` (entire directory)
- Delete: `tests/` (entire directory)
- Delete: `templates/` (entire directory)
- Delete: `modules/` (entire directory)
- Modify: `package.json`

- [ ] **Step 1: Delete v1 source code**

```bash
rm -rf src/ tests/ templates/ modules/
```

- [ ] **Step 2: Create new directory structure**

```bash
mkdir -p src/agent src/llm src/cli src/scaffold tests/agent tests/scaffold
```

- [ ] **Step 3: Update package.json — remove unused deps if any, verify scripts**

The existing `package.json` already has the right deps (`@anthropic-ai/sdk`, `@clack/prompts`, `zod`, etc.) and scripts. No changes needed unless the npm audit shows issues.

- [ ] **Step 4: Create placeholder entry point**

Create `src/index.ts`:

```typescript
console.log('create-stack v2')
```

- [ ] **Step 5: Verify dev and build work**

```bash
npx tsx src/index.ts
# Expected: prints "create-stack v2"

npx tsup
# Expected: builds dist/index.js
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: delete v1 code, prepare for v2 architecture"
```

---

### Task 2: Progress state management

**Files:**
- Create: `src/agent/progress.ts`
- Create: `tests/agent/progress.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/agent/progress.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  createProgress,
  setDecision,
  clearDecision,
  isComplete,
  serializeProgress,
} from '../../src/agent/progress.js'

describe('createProgress', () => {
  it('creates empty progress state', () => {
    const p = createProgress()
    expect(p.projectName).toBeNull()
    expect(p.frontend).toBeNull()
    expect(p.extras).toEqual([])
  })
})

describe('setDecision', () => {
  it('sets a category decision', () => {
    let p = createProgress()
    p = setDecision(p, 'frontend', {
      component: 'nextjs',
      reasoning: 'Best for SSR SaaS',
      scaffoldTool: 'create-next-app',
      scaffoldArgs: ['--typescript', '--tailwind', '--app'],
    })
    expect(p.frontend?.component).toBe('nextjs')
    expect(p.frontend?.scaffoldTool).toBe('create-next-app')
  })

  it('appends to extras instead of overwriting', () => {
    let p = createProgress()
    p = setDecision(p, 'extras', {
      component: 'posthog',
      reasoning: 'Analytics',
    })
    p = setDecision(p, 'extras', {
      component: 'resend',
      reasoning: 'Email',
    })
    expect(p.extras).toHaveLength(2)
    expect(p.extras[0].component).toBe('posthog')
    expect(p.extras[1].component).toBe('resend')
  })

  it('overwrites existing non-extras decision', () => {
    let p = createProgress()
    p = setDecision(p, 'database', {
      component: 'postgres-prisma',
      reasoning: 'First choice',
    })
    p = setDecision(p, 'database', {
      component: 'postgres-drizzle',
      reasoning: 'Changed mind',
    })
    expect(p.database?.component).toBe('postgres-drizzle')
  })
})

describe('clearDecision', () => {
  it('clears a category decision', () => {
    let p = createProgress()
    p = setDecision(p, 'frontend', {
      component: 'nextjs',
      reasoning: 'Best',
    })
    p = clearDecision(p, 'frontend')
    expect(p.frontend).toBeNull()
  })

  it('clears all extras', () => {
    let p = createProgress()
    p = setDecision(p, 'extras', {
      component: 'posthog',
      reasoning: 'Analytics',
    })
    p = clearDecision(p, 'extras')
    expect(p.extras).toEqual([])
  })
})

describe('isComplete', () => {
  it('returns false when required fields are missing', () => {
    const p = createProgress()
    expect(isComplete(p)).toBe(false)
  })

  it('returns true when all required fields are set', () => {
    let p = createProgress()
    p.projectName = 'my-app'
    p.description = 'A SaaS app'
    p = setDecision(p, 'frontend', { component: 'nextjs', reasoning: 'r' })
    p = setDecision(p, 'database', { component: 'postgres', reasoning: 'r' })
    p = setDecision(p, 'deployment', { component: 'vercel', reasoning: 'r' })
    expect(isComplete(p)).toBe(true)
  })
})

describe('serializeProgress', () => {
  it('produces human-readable summary', () => {
    let p = createProgress()
    p.projectName = 'my-app'
    p = setDecision(p, 'frontend', { component: 'nextjs', reasoning: 'SSR' })
    const text = serializeProgress(p)
    expect(text).toContain('my-app')
    expect(text).toContain('nextjs')
    expect(text).toContain('not yet decided')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/agent/progress.test.ts
# Expected: FAIL — cannot find module
```

- [ ] **Step 3: Implement progress module**

Create `src/agent/progress.ts`:

```typescript
export interface ComponentChoice {
  component: string
  reasoning: string
  scaffoldTool?: string
  scaffoldArgs?: string[]
}

export interface StackProgress {
  projectName: string | null
  description: string | null
  frontend: ComponentChoice | null
  backend: ComponentChoice | null
  database: ComponentChoice | null
  auth: ComponentChoice | null
  payments: ComponentChoice | null
  deployment: ComponentChoice | null
  extras: ComponentChoice[]
}

const CATEGORY_KEYS = [
  'frontend', 'backend', 'database', 'auth', 'payments', 'deployment',
] as const

type CategoryKey = (typeof CATEGORY_KEYS)[number]

export function createProgress(): StackProgress {
  return {
    projectName: null,
    description: null,
    frontend: null,
    backend: null,
    database: null,
    auth: null,
    payments: null,
    deployment: null,
    extras: [],
  }
}

export function setDecision(
  progress: StackProgress,
  category: string,
  choice: ComponentChoice,
): StackProgress {
  const next = { ...progress }

  if (category === 'extras') {
    next.extras = [...next.extras, choice]
  } else if (CATEGORY_KEYS.includes(category as CategoryKey)) {
    ;(next as Record<string, unknown>)[category] = choice
  }

  return next
}

export function clearDecision(
  progress: StackProgress,
  category: string,
): StackProgress {
  const next = { ...progress }

  if (category === 'extras') {
    next.extras = []
  } else if (CATEGORY_KEYS.includes(category as CategoryKey)) {
    ;(next as Record<string, unknown>)[category] = null
  }

  return next
}

export function isComplete(progress: StackProgress): boolean {
  return (
    progress.projectName !== null &&
    progress.description !== null &&
    progress.frontend !== null &&
    progress.database !== null &&
    progress.deployment !== null
  )
}

export function serializeProgress(progress: StackProgress): string {
  const lines: string[] = []

  lines.push(`Project: ${progress.projectName ?? 'not yet decided'}`)
  lines.push(`Description: ${progress.description ?? 'not yet decided'}`)

  for (const key of CATEGORY_KEYS) {
    const choice = progress[key]
    if (choice) {
      lines.push(`${key}: ${choice.component} — ${choice.reasoning}`)
    } else {
      lines.push(`${key}: not yet decided`)
    }
  }

  if (progress.extras.length > 0) {
    for (const extra of progress.extras) {
      lines.push(`extra: ${extra.component} — ${extra.reasoning}`)
    }
  }

  return lines.join('\n')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/agent/progress.test.ts
# Expected: all tests pass
```

- [ ] **Step 5: Commit**

```bash
git add src/agent/progress.ts tests/agent/progress.test.ts
git commit -m "feat: add StackProgress state management"
```

---

### Task 3: Tool definitions and executor

**Files:**
- Create: `src/agent/tools.ts`
- Create: `tests/agent/tools.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/agent/tools.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  conversationToolDefinitions,
  scaffoldToolDefinitions,
  executeConversationTool,
} from '../../src/agent/tools.js'
import { createProgress } from '../../src/agent/progress.js'
import type { StackProgress } from '../../src/agent/progress.js'

describe('conversationToolDefinitions', () => {
  it('returns tool definitions for set_decision, summarize_stage, present_plan', () => {
    const tools = conversationToolDefinitions()
    const names = tools.map((t) => t.name)
    expect(names).toContain('set_decision')
    expect(names).toContain('summarize_stage')
    expect(names).toContain('present_plan')
  })

  it('each tool has a valid input_schema', () => {
    const tools = conversationToolDefinitions()
    for (const tool of tools) {
      expect(tool.input_schema).toBeDefined()
      expect(tool.input_schema.type).toBe('object')
    }
  })
})

describe('scaffoldToolDefinitions', () => {
  it('returns tool definitions for run_scaffold and add_integration', () => {
    const tools = scaffoldToolDefinitions()
    const names = tools.map((t) => t.name)
    expect(names).toContain('run_scaffold')
    expect(names).toContain('add_integration')
  })
})

describe('executeConversationTool', () => {
  let progress: StackProgress

  beforeEach(() => {
    progress = createProgress()
  })

  it('handles set_decision', () => {
    const result = executeConversationTool('set_decision', {
      category: 'frontend',
      component: 'nextjs',
      reasoning: 'Best for SSR',
      scaffoldTool: 'create-next-app',
      scaffoldArgs: ['--typescript'],
    }, progress, [])

    expect(result.progress.frontend?.component).toBe('nextjs')
    expect(result.response).toContain('nextjs')
    expect(result.signal).toBeUndefined()
  })

  it('handles present_plan', () => {
    const result = executeConversationTool('present_plan', {}, progress, [])
    expect(result.signal).toBe('present_plan')
  })

  it('handles summarize_stage', () => {
    const messages = [
      { role: 'user' as const, content: 'msg1' },
      { role: 'assistant' as const, content: 'msg2' },
      { role: 'user' as const, content: 'msg3' },
      { role: 'assistant' as const, content: 'msg4' },
    ]
    const result = executeConversationTool('summarize_stage', {
      category: 'frontend',
      summary: 'Decided on Next.js for SSR.',
    }, progress, messages)

    expect(result.response).toContain('summarized')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/agent/tools.test.ts
# Expected: FAIL — cannot find module
```

- [ ] **Step 3: Implement tool definitions and executor**

Create `src/agent/tools.ts`:

```typescript
import type { Tool } from '@anthropic-ai/sdk/resources/messages.js'
import {
  setDecision,
  type StackProgress,
  type ComponentChoice,
} from './progress.js'

export interface ConversationToolResult {
  progress: StackProgress
  response: string
  signal?: 'present_plan'
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export function conversationToolDefinitions(): Tool[] {
  return [
    {
      name: 'set_decision',
      description:
        'Commit a stack decision. Call this after the user confirms a component choice.',
      input_schema: {
        type: 'object' as const,
        properties: {
          category: {
            type: 'string',
            enum: ['frontend', 'backend', 'database', 'auth', 'payments', 'deployment', 'extras'],
            description: 'The stack category',
          },
          component: {
            type: 'string',
            description: 'The chosen component name',
          },
          reasoning: {
            type: 'string',
            description: 'Brief explanation of why this was chosen',
          },
          scaffoldTool: {
            type: 'string',
            description: 'Official scaffold CLI tool name (e.g. create-next-app)',
          },
          scaffoldArgs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Arguments for the scaffold tool',
          },
        },
        required: ['category', 'component', 'reasoning'],
      },
    },
    {
      name: 'summarize_stage',
      description:
        'Summarize a stage conversation when it has gotten long. Replaces detailed turns with a concise summary.',
      input_schema: {
        type: 'object' as const,
        properties: {
          category: {
            type: 'string',
            description: 'The stage category being summarized',
          },
          summary: {
            type: 'string',
            description: 'Concise summary of the stage conversation',
          },
        },
        required: ['category', 'summary'],
      },
    },
    {
      name: 'present_plan',
      description:
        'Signal that all stack decisions are made and present the plan for user review.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
  ]
}

export function scaffoldToolDefinitions(): Tool[] {
  return [
    {
      name: 'run_scaffold',
      description:
        'Execute an official scaffold CLI command (e.g. create-next-app). Must match the approved plan.',
      input_schema: {
        type: 'object' as const,
        properties: {
          tool: {
            type: 'string',
            description: 'The scaffold CLI tool name',
          },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Arguments for the scaffold tool',
          },
        },
        required: ['tool', 'args'],
      },
    },
    {
      name: 'add_integration',
      description:
        'Write integration files, install dependencies, and update .env.example.',
      input_schema: {
        type: 'object' as const,
        properties: {
          files: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description:
              'Files to write. Keys are dest paths relative to project root, values are file contents.',
          },
          dependencies: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'npm dependencies to install (name → version)',
          },
          devDependencies: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'npm devDependencies to install (name → version)',
          },
          envVars: {
            type: 'array',
            items: { type: 'string' },
            description: 'Environment variable names to append to .env.example',
          },
        },
        required: ['files'],
      },
    },
  ]
}

export function executeConversationTool(
  name: string,
  input: Record<string, unknown>,
  progress: StackProgress,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): ConversationToolResult {
  switch (name) {
    case 'set_decision': {
      const choice: ComponentChoice = {
        component: input.component as string,
        reasoning: input.reasoning as string,
        scaffoldTool: input.scaffoldTool as string | undefined,
        scaffoldArgs: input.scaffoldArgs as string[] | undefined,
      }
      const newProgress = setDecision(progress, input.category as string, choice)
      return {
        progress: newProgress,
        response: `Decision committed: ${input.category} → ${input.component}`,
      }
    }

    case 'present_plan':
      return {
        progress,
        response: 'Plan ready for review.',
        signal: 'present_plan',
      }

    case 'summarize_stage':
      return {
        progress,
        response: `Stage "${input.category}" summarized.`,
      }

    default:
      return {
        progress,
        response: `Unknown tool: ${name}`,
      }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/agent/tools.test.ts
# Expected: all tests pass
```

- [ ] **Step 5: Commit**

```bash
git add src/agent/tools.ts tests/agent/tools.test.ts
git commit -m "feat: add tool definitions and conversation tool executor"
```

---

## Chunk 2: System Prompt, LLM Client, CLI Chat

### Task 4: System prompt builder

**Files:**
- Create: `src/agent/system-prompt.ts`
- Create: `tests/agent/system-prompt.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/agent/system-prompt.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  buildConversationPrompt,
  buildScaffoldPrompt,
} from '../../src/agent/system-prompt.js'
import { createProgress, setDecision } from '../../src/agent/progress.js'

describe('buildConversationPrompt', () => {
  it('includes persona instructions', () => {
    const prompt = buildConversationPrompt(createProgress())
    expect(prompt).toContain('senior software architect')
  })

  it('includes current progress state', () => {
    let p = createProgress()
    p.projectName = 'my-app'
    p = setDecision(p, 'frontend', { component: 'nextjs', reasoning: 'SSR' })
    const prompt = buildConversationPrompt(p)
    expect(prompt).toContain('my-app')
    expect(prompt).toContain('nextjs')
    expect(prompt).toContain('not yet decided')
  })

  it('includes stage guidance', () => {
    const prompt = buildConversationPrompt(createProgress())
    expect(prompt).toContain('set_decision')
    expect(prompt).toContain('present_plan')
  })
})

describe('buildScaffoldPrompt', () => {
  it('includes scaffold instructions', () => {
    let p = createProgress()
    p.projectName = 'my-app'
    p = setDecision(p, 'frontend', {
      component: 'nextjs',
      reasoning: 'SSR',
      scaffoldTool: 'create-next-app',
      scaffoldArgs: ['--typescript'],
    })
    const prompt = buildScaffoldPrompt(p)
    expect(prompt).toContain('run_scaffold')
    expect(prompt).toContain('add_integration')
    expect(prompt).toContain('my-app')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/agent/system-prompt.test.ts
# Expected: FAIL — cannot find module
```

- [ ] **Step 3: Implement system prompt builder**

Create `src/agent/system-prompt.ts`:

```typescript
import { serializeProgress, type StackProgress } from './progress.js'

export function buildConversationPrompt(progress: StackProgress): string {
  const progressText = serializeProgress(progress)

  return `You are a senior software architect helping a developer set up a new project. You are conversational, opinionated, and helpful.

## Your Approach

Walk through the stack decisions conversationally. For each component category (frontend, database, auth, etc.):

1. Present 2-3 concrete options with brief trade-off context
2. Include a "something else" option
3. Lead with your recommendation and explain why
4. Be ready to answer questions or discuss trade-offs before the user decides

For payments, also offer "skip for now."

You can skip stages that aren't relevant (e.g., if the frontend framework includes API routes, you may not need a separate backend discussion). You can reorder stages based on the conversation flow.

## Tools

Use \`set_decision\` to commit each decision after the user confirms it. Always include:
- category: the stack area (frontend, backend, database, auth, payments, deployment, extras)
- component: the chosen component name
- reasoning: brief explanation

For the base framework, also include \`scaffoldTool\` and \`scaffoldArgs\` so the scaffold engine knows which official CLI to run.

Use \`summarize_stage\` if a stage conversation gets long (>10 exchanges) to keep context clean.

Call \`present_plan\` when you believe all relevant decisions have been made. This shows the user a summary for final approval.

## Current Progress

${progressText}

## Important

- Start by asking what they're building (free text)
- Set projectName and description early via set_decision with category "frontend" is wrong — just learn them from conversation; they will be set when the user confirms the project name
- Be opinionated but open to pushback
- Explain trade-offs concisely — developers want to understand why, not get a lecture
- If the user asks a question mid-stage, answer it before continuing
- If the user says "go back" or wants to change an earlier decision, acknowledge it (the system will clear that decision)
`
}

export function buildScaffoldPrompt(progress: StackProgress): string {
  const progressText = serializeProgress(progress)

  return `You are setting up a project based on the approved stack plan below. Execute the plan by calling tools.

## Approved Plan

${progressText}

## Instructions

1. First, call \`run_scaffold\` with the base framework's scaffold tool and args to create the project.
2. Then, for each integration (database, auth, payments, etc.), query MCP tools for current setup documentation if available, then call \`add_integration\` to write the integration files, install dependencies, and set up environment variables.
3. Finally, call \`add_integration\` for glue code — provider wrappers, middleware chains, imports, and \`.env.example\`.

## Tools

- \`run_scaffold\`: Run the official scaffold CLI. The tool and args must match the approved plan.
- \`add_integration\`: Write files (keys = dest paths, values = contents), install deps, and add env vars.
- MCP tools: Query current documentation to generate correct, up-to-date integration code.

## Important

- Generate complete, working code — not stubs or placeholders.
- Use current best practices from MCP docs when available.
- Each \`add_integration\` call should be self-contained for one integration or one glue step.
- If something fails, report the error clearly rather than retrying endlessly.
`
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/agent/system-prompt.test.ts
# Expected: all tests pass
```

- [ ] **Step 5: Commit**

```bash
git add src/agent/system-prompt.ts tests/agent/system-prompt.test.ts
git commit -m "feat: add conversation and scaffold system prompt builders"
```

---

### Task 5: Anthropic SDK client with MCP support

**Files:**
- Create: `src/llm/client.ts`

- [ ] **Step 1: Implement client**

Create `src/llm/client.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import type { Tool } from '@anthropic-ai/sdk/resources/messages.js'

let anthropic: Anthropic | null = null

function getClient(): Anthropic {
  if (anthropic) return anthropic

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error(
      'Error: ANTHROPIC_API_KEY environment variable is not set.\n' +
        'Get your API key at https://console.anthropic.com/settings/keys\n' +
        'Then run: export ANTHROPIC_API_KEY=your-key-here'
    )
    process.exit(1)
  }

  anthropic = new Anthropic({ apiKey })
  return anthropic
}

export interface ChatOptions {
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string | object[] }>
  tools: Tool[]
  maxTokens: number
  mcpServers?: Record<string, { url: string; apiKey?: string }>
}

export async function chat(options: ChatOptions) {
  const client = getClient()

  const createParams: Record<string, unknown> = {
    model: 'claude-sonnet-4-6',
    max_tokens: options.maxTokens,
    system: options.system,
    messages: options.messages,
    tools: options.tools,
  }

  // Add MCP servers if configured
  if (options.mcpServers && Object.keys(options.mcpServers).length > 0) {
    const servers: Record<string, unknown> = {}
    for (const [name, config] of Object.entries(options.mcpServers)) {
      servers[name] = {
        type: 'url',
        url: config.url,
        ...(config.apiKey ? { authorization_token: config.apiKey } : {}),
      }
    }
    createParams.mcp_servers = servers

    // Use beta endpoint for MCP
    return client.beta.messages.create(createParams as Parameters<typeof client.beta.messages.create>[0], {
      headers: { 'anthropic-beta': 'mcp-client-2025-11-20' },
    })
  }

  return client.messages.create(createParams as Parameters<typeof client.messages.create>[0])
}
```

No unit tests for this file — it's a thin SDK wrapper. Tested via the agent loop with mocked client.

- [ ] **Step 2: Commit**

```bash
git add src/llm/client.ts
git commit -m "feat: add Anthropic SDK client with MCP connector support"
```

---

### Task 6: CLI chat interface

**Files:**
- Create: `src/cli/chat.ts`

- [ ] **Step 1: Implement chat interface**

Create `src/cli/chat.ts`:

```typescript
import * as p from '@clack/prompts'

export function intro(): void {
  p.intro('create-stack')
}

export function outro(message: string): void {
  p.outro(message)
}

export function renderAgentMessage(text: string): void {
  p.log.message(text)
}

export function renderError(text: string): void {
  p.log.error(text)
}

export function renderWarning(text: string): void {
  p.log.warn(text)
}

export function renderStep(text: string): void {
  p.log.step(text)
}

export async function getUserInput(placeholder?: string): Promise<string | null> {
  const input = await p.text({
    message: '',
    placeholder: placeholder ?? 'Type your response...',
  })

  if (p.isCancel(input)) {
    return null
  }

  return input
}

export function renderPlan(plan: string): void {
  p.log.info(plan)
}

export function createSpinner() {
  return p.spinner()
}
```

No unit tests — requires a TTY. Validated via manual testing.

- [ ] **Step 2: Commit**

```bash
git add src/cli/chat.ts
git commit -m "feat: add CLI chat interface with clack"
```

---

## Chunk 3: Scaffold Engine

### Task 7: Base scaffold runner with validation

**Files:**
- Create: `src/scaffold/base.ts`
- Create: `tests/scaffold/base.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/scaffold/base.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { validateScaffoldTool, validateScaffoldArgs } from '../../src/scaffold/base.js'

describe('validateScaffoldTool', () => {
  it('accepts allowlisted tools', () => {
    expect(() => validateScaffoldTool('create-next-app', 'create-next-app')).not.toThrow()
    expect(() => validateScaffoldTool('create-vite', 'create-vite')).not.toThrow()
  })

  it('rejects tools not in allowlist', () => {
    expect(() => validateScaffoldTool('rm', 'rm')).toThrow(/not allowed/)
  })

  it('rejects tools that dont match approved plan', () => {
    expect(() => validateScaffoldTool('create-vite', 'create-next-app')).toThrow(/does not match/)
  })
})

describe('validateScaffoldArgs', () => {
  it('accepts safe flags for create-next-app', () => {
    expect(() =>
      validateScaffoldArgs('create-next-app', ['--typescript', '--tailwind', '--app'])
    ).not.toThrow()
  })

  it('rejects args with URL schemes', () => {
    expect(() =>
      validateScaffoldArgs('create-next-app', ['--template', 'https://evil.com/setup'])
    ).toThrow(/URL scheme/)
  })

  it('rejects args with shell metacharacters', () => {
    expect(() =>
      validateScaffoldArgs('create-next-app', ['--name; rm -rf /'])
    ).toThrow(/metacharacter/)
  })

  it('rejects args with whitespace', () => {
    expect(() =>
      validateScaffoldArgs('create-next-app', ['--flag with spaces'])
    ).toThrow(/whitespace/)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/scaffold/base.test.ts
# Expected: FAIL — cannot find module
```

- [ ] **Step 3: Implement base scaffold runner**

Create `src/scaffold/base.ts`:

```typescript
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ALLOWED_TOOLS = new Set([
  'create-next-app',
  'create-vite',
  'create-remix',
  'create-svelte',
  'create-astro',
  'nuxi',
])

const SHELL_METACHAR_RE = /[;&|`$(){}[\]<>!#~*?\n\r]/
const URL_SCHEME_RE = /^(https?|git\+|file):/i

export function validateScaffoldTool(tool: string, approvedTool: string): void {
  if (!ALLOWED_TOOLS.has(tool)) {
    throw new Error(`Scaffold tool "${tool}" is not allowed. Permitted: ${[...ALLOWED_TOOLS].join(', ')}`)
  }
  if (tool !== approvedTool) {
    throw new Error(`Scaffold tool "${tool}" does not match approved plan tool "${approvedTool}"`)
  }
}

export function validateScaffoldArgs(tool: string, args: string[]): void {
  for (const arg of args) {
    if (URL_SCHEME_RE.test(arg)) {
      throw new Error(`Scaffold arg "${arg}" contains a URL scheme and is not allowed`)
    }
    if (SHELL_METACHAR_RE.test(arg)) {
      throw new Error(`Scaffold arg "${arg}" contains a shell metacharacter and is not allowed`)
    }
    if (/\s/.test(arg)) {
      throw new Error(`Scaffold arg "${arg}" contains whitespace and is not allowed`)
    }
  }
}

export function runScaffold(
  tool: string,
  args: string[],
  approvedTool: string,
  projectName: string,
  cwd: string,
): string {
  validateScaffoldTool(tool, approvedTool)
  validateScaffoldArgs(tool, args)

  const outputDir = resolve(cwd, projectName)
  if (existsSync(outputDir)) {
    throw new Error(
      `Directory "${projectName}" already exists and is not empty. ` +
        'Choose a different name or delete it first.'
    )
  }

  const fullArgs = [
    `${tool}@latest`,
    projectName,
    ...args,
  ]

  execFileSync('npx', fullArgs, {
    cwd,
    stdio: 'inherit',
  })

  return outputDir
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/scaffold/base.test.ts
# Expected: all tests pass
```

- [ ] **Step 5: Commit**

```bash
git add src/scaffold/base.ts tests/scaffold/base.test.ts
git commit -m "feat: add base scaffold runner with tool and args validation"
```

---

### Task 8: Integration file writer

**Files:**
- Create: `src/scaffold/integrate.ts`
- Create: `tests/scaffold/integrate.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/scaffold/integrate.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeIntegration, validateFilePaths } from '../../src/scaffold/integrate.js'
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('validateFilePaths', () => {
  it('accepts paths within project root', () => {
    expect(() => validateFilePaths('/project', { 'src/auth.ts': 'code' })).not.toThrow()
  })

  it('rejects paths that traverse above project root', () => {
    expect(() => validateFilePaths('/project', { '../../etc/passwd': 'bad' })).toThrow(
      /outside project root/
    )
  })

  it('rejects absolute paths', () => {
    expect(() => validateFilePaths('/project', { '/etc/passwd': 'bad' })).toThrow(
      /outside project root/
    )
  })
})

describe('writeIntegration', () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), 'integrate-'))
    await writeFile(
      join(projectDir, 'package.json'),
      JSON.stringify({ name: 'test', dependencies: {} }, null, 2)
    )
  })

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true })
  })

  it('writes files to project', async () => {
    await writeIntegration(projectDir, {
      files: { 'lib/auth.ts': 'export const auth = true' },
    })

    const content = await readFile(join(projectDir, 'lib', 'auth.ts'), 'utf-8')
    expect(content).toBe('export const auth = true')
  })

  it('merges dependencies into package.json', async () => {
    await writeIntegration(projectDir, {
      files: {},
      dependencies: { '@clerk/nextjs': '^5.0.0' },
    })

    const pkg = JSON.parse(await readFile(join(projectDir, 'package.json'), 'utf-8'))
    expect(pkg.dependencies['@clerk/nextjs']).toBe('^5.0.0')
  })

  it('creates .env.example with env vars', async () => {
    await writeIntegration(projectDir, {
      files: {},
      envVars: ['CLERK_SECRET_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'],
    })

    const env = await readFile(join(projectDir, '.env.example'), 'utf-8')
    expect(env).toContain('CLERK_SECRET_KEY=')
    expect(env).toContain('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=')
  })

  it('appends to existing .env.example', async () => {
    await writeFile(join(projectDir, '.env.example'), 'EXISTING=value\n')

    await writeIntegration(projectDir, {
      files: {},
      envVars: ['NEW_VAR'],
    })

    const env = await readFile(join(projectDir, '.env.example'), 'utf-8')
    expect(env).toContain('EXISTING=value')
    expect(env).toContain('NEW_VAR=')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/scaffold/integrate.test.ts
# Expected: FAIL — cannot find module
```

- [ ] **Step 3: Implement integration writer**

Create `src/scaffold/integrate.ts`:

```typescript
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, resolve, dirname, relative } from 'node:path'

export interface IntegrationInput {
  files: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  envVars?: string[]
}

export function validateFilePaths(
  projectRoot: string,
  files: Record<string, string>,
): void {
  for (const filePath of Object.keys(files)) {
    const resolved = resolve(projectRoot, filePath)
    const rel = relative(projectRoot, resolved)
    if (rel.startsWith('..') || resolve(resolved) !== resolve(projectRoot, rel)) {
      throw new Error(
        `File path "${filePath}" resolves outside project root and is not allowed`
      )
    }
  }
}

export async function writeIntegration(
  projectDir: string,
  input: IntegrationInput,
): Promise<void> {
  // Validate paths
  validateFilePaths(projectDir, input.files)

  // Write files
  for (const [filePath, content] of Object.entries(input.files)) {
    const destPath = join(projectDir, filePath)
    await mkdir(dirname(destPath), { recursive: true })
    await writeFile(destPath, content)
  }

  // Merge dependencies
  if (
    (input.dependencies && Object.keys(input.dependencies).length > 0) ||
    (input.devDependencies && Object.keys(input.devDependencies).length > 0)
  ) {
    const pkgPath = join(projectDir, 'package.json')
    const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))

    if (input.dependencies) {
      pkg.dependencies = { ...pkg.dependencies, ...input.dependencies }
    }
    if (input.devDependencies) {
      pkg.devDependencies = { ...pkg.devDependencies, ...input.devDependencies }
    }

    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  }

  // Append env vars
  if (input.envVars && input.envVars.length > 0) {
    const envPath = join(projectDir, '.env.example')
    let existing = ''
    try {
      existing = await readFile(envPath, 'utf-8')
    } catch {
      // File doesn't exist yet
    }

    const newVars = input.envVars.map((v) => `${v}=`).join('\n')
    const separator = existing && !existing.endsWith('\n') ? '\n' : ''
    await writeFile(envPath, existing + separator + newVars + '\n')
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/scaffold/integrate.test.ts
# Expected: all tests pass
```

- [ ] **Step 5: Commit**

```bash
git add src/scaffold/integrate.ts tests/scaffold/integrate.test.ts
git commit -m "feat: add integration file writer with path validation"
```

---

## Chunk 4: Agent Loop & Entry Point

### Task 9: Agent loop — conversation and scaffold phases

**Files:**
- Create: `src/agent/loop.ts`
- Create: `tests/agent/loop.test.ts`

- [ ] **Step 1: Write failing tests for the conversation loop**

Create `tests/agent/loop.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runConversationLoop } from '../../src/agent/loop.js'

// Mock the llm client
vi.mock('../../src/llm/client.js', () => ({
  chat: vi.fn(),
}))

// Mock the cli chat
vi.mock('../../src/cli/chat.js', () => ({
  renderAgentMessage: vi.fn(),
  getUserInput: vi.fn(),
  renderPlan: vi.fn(),
  renderError: vi.fn(),
  createSpinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}))

import { chat } from '../../src/llm/client.js'
import { getUserInput } from '../../src/cli/chat.js'

const mockChat = vi.mocked(chat)
const mockGetUserInput = vi.mocked(getUserInput)

describe('runConversationLoop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs a simple conversation and returns progress on present_plan', async () => {
    // Turn 1: Claude asks what they're building
    mockChat.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'What are you building?' }],
      stop_reason: 'end_turn',
    } as any)
    mockGetUserInput.mockResolvedValueOnce('A restaurant reservation SaaS')

    // Turn 2: Claude sets frontend decision and calls present_plan
    mockChat.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tu1',
          name: 'set_decision',
          input: {
            category: 'frontend',
            component: 'nextjs',
            reasoning: 'Best for SSR SaaS',
            scaffoldTool: 'create-next-app',
            scaffoldArgs: ['--typescript'],
          },
        },
        {
          type: 'tool_use',
          id: 'tu2',
          name: 'present_plan',
          input: {},
        },
      ],
      stop_reason: 'tool_use',
    } as any)

    const result = await runConversationLoop()

    expect(result.frontend?.component).toBe('nextjs')
    expect(mockChat).toHaveBeenCalledTimes(2)
  })

  it('returns null if user cancels', async () => {
    mockChat.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'What are you building?' }],
      stop_reason: 'end_turn',
    } as any)
    mockGetUserInput.mockResolvedValueOnce(null) // user cancels

    const result = await runConversationLoop()
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/agent/loop.test.ts
# Expected: FAIL — cannot find module
```

- [ ] **Step 3: Implement agent loop**

Create `src/agent/loop.ts`:

```typescript
import { chat } from '../llm/client.js'
import { createProgress, type StackProgress } from './progress.js'
import { buildConversationPrompt, buildScaffoldPrompt } from './system-prompt.js'
import {
  conversationToolDefinitions,
  scaffoldToolDefinitions,
  executeConversationTool,
} from './tools.js'
import {
  renderAgentMessage,
  getUserInput,
  renderPlan,
  renderError,
  createSpinner,
} from '../cli/chat.js'
import { serializeProgress } from './progress.js'
import { runScaffold } from '../scaffold/base.js'
import { writeIntegration } from '../scaffold/integrate.js'

interface Message {
  role: 'user' | 'assistant'
  content: string | object[]
}

export async function runConversationLoop(): Promise<StackProgress | null> {
  let progress = createProgress()
  const messages: Message[] = []
  const tools = conversationToolDefinitions()

  while (true) {
    const systemPrompt = buildConversationPrompt(progress)

    const response = await chat({
      system: systemPrompt,
      messages,
      tools,
      maxTokens: 4096,
    })

    // Process response content blocks
    const assistantContent: object[] = []
    let textOutput = ''
    let exitLoop = false

    for (const block of response.content) {
      if (block.type === 'text') {
        textOutput += block.text
        assistantContent.push(block)
      } else if (block.type === 'tool_use') {
        assistantContent.push(block)

        const result = executeConversationTool(
          block.name,
          block.input as Record<string, unknown>,
          progress,
          [],
        )

        progress = result.progress

        // Append tool result
        messages.push({ role: 'assistant', content: assistantContent.splice(0) })
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: block.id,
              content: result.response,
            },
          ],
        })

        if (result.signal === 'present_plan') {
          exitLoop = true
        }
      }
    }

    if (exitLoop) {
      renderPlan(serializeProgress(progress))
      return progress
    }

    // If there was text output, show it and get user input
    if (textOutput) {
      // Push remaining assistant content if not already pushed
      if (assistantContent.length > 0) {
        messages.push({ role: 'assistant', content: assistantContent })
      }

      renderAgentMessage(textOutput)

      const userInput = await getUserInput()
      if (userInput === null) {
        return null // user cancelled
      }

      messages.push({ role: 'user', content: userInput })
    }
  }
}

export async function runScaffoldLoop(
  progress: StackProgress,
): Promise<boolean> {
  const tools = scaffoldToolDefinitions()
  const systemPrompt = buildScaffoldPrompt(progress)
  const messages: Message[] = []
  const projectName = progress.projectName!
  const cwd = process.cwd()
  const approvedTool = progress.frontend?.scaffoldTool ?? ''

  let toolCallCount = 0
  const MAX_TOOL_CALLS = 30

  const spinner = createSpinner()

  // Initial call
  let response = await chat({
    system: systemPrompt,
    messages,
    tools,
    maxTokens: 16384,
  })

  while (response.stop_reason === 'tool_use') {
    const assistantContent = response.content
    messages.push({ role: 'assistant', content: assistantContent as object[] })

    const toolResults: object[] = []

    for (const block of assistantContent) {
      if (block.type !== 'tool_use') continue

      toolCallCount++
      if (toolCallCount > MAX_TOOL_CALLS) {
        renderError(`Scaffold loop exceeded ${MAX_TOOL_CALLS} tool calls. Stopping.`)
        return false
      }

      try {
        let resultText: string

        if (block.name === 'run_scaffold') {
          const input = block.input as { tool: string; args: string[] }
          spinner.start(`Running ${input.tool}...`)
          const outputDir = runScaffold(input.tool, input.args, approvedTool, projectName, cwd)
          spinner.stop(`Base project created at ${outputDir}`)
          resultText = `Success: project scaffolded at ${outputDir}`
        } else if (block.name === 'add_integration') {
          const input = block.input as {
            files: Record<string, string>
            dependencies?: Record<string, string>
            devDependencies?: Record<string, string>
            envVars?: string[]
          }
          const fileCount = Object.keys(input.files).length
          spinner.start(`Writing ${fileCount} files...`)
          const projectDir = `${cwd}/${projectName}`
          await writeIntegration(projectDir, input)
          spinner.stop(`Integration applied: ${fileCount} files written`)
          resultText = `Success: ${fileCount} files written`
          if (input.dependencies) {
            resultText += `, ${Object.keys(input.dependencies).length} deps added`
          }
          if (input.envVars) {
            resultText += `, ${input.envVars.length} env vars added`
          }
        } else {
          resultText = `Unknown tool: ${block.name}`
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: resultText,
        })
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        spinner.stop(`Error: ${errorMsg}`)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: `Error: ${errorMsg}`,
          is_error: true,
        })
      }
    }

    messages.push({ role: 'user', content: toolResults })

    response = await chat({
      system: systemPrompt,
      messages,
      tools,
      maxTokens: 16384,
    })
  }

  // Final text response from Claude (summary)
  for (const block of response.content) {
    if (block.type === 'text' && block.text) {
      renderAgentMessage(block.text)
    }
  }

  return true
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/agent/loop.test.ts
# Expected: all tests pass
```

- [ ] **Step 5: Commit**

```bash
git add src/agent/loop.ts tests/agent/loop.test.ts
git commit -m "feat: add conversation and scaffold agent loops"
```

---

### Task 10: Entry point and final wiring

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Implement entry point**

Replace `src/index.ts` with:

```typescript
import * as p from '@clack/prompts'
import { intro, outro, renderPlan, renderError } from './cli/chat.js'
import { runConversationLoop, runScaffoldLoop } from './agent/loop.js'
import { serializeProgress } from './agent/progress.js'

async function main() {
  intro()

  // Phase 1: Conversation
  const progress = await runConversationLoop()

  if (!progress) {
    outro('Setup cancelled.')
    return
  }

  // Review gate
  const confirmed = await p.confirm({
    message: 'Ready to build this stack?',
  })

  if (p.isCancel(confirmed) || !confirmed) {
    outro('No problem — run create-stack again to start over.')
    return
  }

  // Phase 2: Scaffold
  const success = await runScaffoldLoop(progress)

  if (success) {
    const nextSteps = [`cd ${progress.projectName}`]
    nextSteps.push('cp .env.example .env  # fill in your values')
    nextSteps.push('npm run dev')

    p.log.step('Next steps:\n  ' + nextSteps.join('\n  '))
    outro('Happy building!')
  } else {
    renderError('Scaffolding encountered errors. Check the output above.')
    outro('You may need to fix issues manually.')
  }
}

const command = process.argv[2]

if (!command || command === 'init') {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
} else {
  console.error(`Unknown command: ${command}`)
  console.error('Usage: create-stack [init]')
  process.exit(1)
}
```

- [ ] **Step 2: Verify build works**

```bash
npx tsup
# Expected: builds dist/index.js
```

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
# Expected: all tests pass
```

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: add entry point wiring conversation and scaffold loops"
```

---

### Task 11: End-to-end manual test

- [ ] **Step 1: Run all unit tests**

```bash
npx vitest run
# Expected: all tests pass
```

- [ ] **Step 2: Build the CLI**

```bash
npx tsup
# Expected: dist/index.js produced
```

- [ ] **Step 3: Manual smoke test (requires ANTHROPIC_API_KEY)**

```bash
export ANTHROPIC_API_KEY=your-key-here
cd /tmp
npx tsx /mnt/bigstore/media/apps/code-server/workspace/stacker/src/index.ts
```

Walk through the conversation. Verify:
- Agent asks what you're building
- Agent presents options for each stage
- Agent commits decisions via set_decision
- Agent presents final plan via present_plan
- Confirmation gate works (try "No" first, then "Yes")
- Base scaffold runs (create-next-app or similar)
- Integration files are written
- `.env.example` is created
- Next steps are shown

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete create-stack v2 agent-driven CLI"
```

---

## Known Issues From Plan Review

The following issues were identified during plan review. Implementers MUST address these during implementation — the code samples in the tasks above contain these bugs. Refer to the spec for correct behavior.

### Critical

1. **Multi-tool message ordering in `loop.ts`:** When Claude returns multiple `tool_use` blocks in one response, all blocks must go in a single `assistant` message and all `tool_result` blocks in a single `user` message. The plan's loop incorrectly pushes separate messages per tool_use. Fix: collect all blocks, push one assistant message, execute all tools, push one user message with all results.

2. **`summarize_stage` not implemented:** The `executeConversationTool` stub returns a string but does not perform message-history replacement. The loop does not check for a `summarize_stage` signal. Fix: when `summarize_stage` is called, the loop must replace the stage's conversation turns with a single assistant summary message + synthetic user bridge for role alternation.

3. **`executeConversationTool` receives `[]` instead of live messages:** The call site passes a hardcoded empty array. Pass the actual `messages` array.

### Important

4. **Per-tool args allowlist missing in `base.ts`:** `validateScaffoldArgs` only checks for URL schemes, metacharacters, and whitespace. Add a `ALLOWED_ARGS` map per tool (e.g., `create-next-app` → `['--typescript', '--tailwind', '--app', '--src-dir', '--eslint', '--no-eslint', '--import-alias']`).

5. **`existsSync` vs non-empty check:** `runScaffold` throws on any existing directory. Change to `readdirSync(outputDir).length > 0` to match the spec ("if non-empty").

6. **No write path for `projectName`/`description`:** `StackProgress.projectName` and `description` have no tool to set them. Add a `set_project_info` tool with `{ projectName: string, description: string }` to conversation tools, and handle it in the executor and loop.

7. **Garbled system prompt bullet:** The `projectName` instruction in `buildConversationPrompt` is a sentence fragment. Rewrite to: "Use `set_project_info` to record the project name and description after the discovery conversation."

8. **Redundant path check in `integrate.ts`:** The second condition in `validateFilePaths` is always false. Replace with: `if (rel.startsWith('..') || isAbsolute(filePath))`.

9. **Scaffold loop path concatenation:** `${cwd}/${projectName}` should use `join(cwd, projectName)` or the return value from `runScaffold`.

10. **No tests for `runScaffoldLoop`:** Add tests covering the 30-call limit, tool dispatch, and error propagation.

11. **Unused imports:** Remove `mkdir` from `tests/scaffold/integrate.test.ts` and `renderPlan` from `src/index.ts`.

12. **Hardcoded path in smoke test:** Use a relative path or `node dist/index.js` after build.
