# create-stack Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI-assisted developer CLI that scaffolds full-stack applications through interactive prompts, LLM-driven architecture planning, and deterministic template-based execution.

**Architecture:** Linear pipeline — CLI prompts collect requirements, Claude selects a template and modules via structured JSON, the execution engine scaffolds deterministically. Single retry on LLM validation failure.

**Tech Stack:** TypeScript, `@clack/prompts`, Anthropic SDK, Zod, Vitest, `tsx` (dev), `tsup` (build)

**Spec:** `docs/superpowers/specs/2026-03-13-create-stack-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | Project metadata, dependencies, scripts, bin field |
| `tsconfig.json` | TypeScript config (ESM, strict) |
| `tsup.config.ts` | Build config for distributable CLI |
| `vitest.config.ts` | Test runner config |
| `src/index.ts` | Entry point — parse args, route to command |
| `src/cli/prompts.ts` | Interactive prompts via `@clack/prompts`, returns `UserRequirements` |
| `src/llm/schemas.ts` | Zod schemas for `StackDecision` validation |
| `src/llm/client.ts` | Anthropic SDK wrapper, `callClaude()` |
| `src/llm/planner.ts` | Build prompt, call Claude, validate response, retry once |
| `src/engine/scaffold.ts` | Copy template directory, replace tokens, warn on unresolved |
| `src/engine/modules.ts` | Copy module files, replace tokens, merge deps, write `.env.example` |
| `src/engine/deps.ts` | Detect package manager, run install in scaffolded project |
| `src/utils/tokens.ts` | `replaceTokens()` and `findUnresolvedTokens()` |
| `src/commands/init.ts` | Orchestrator — ties prompts → planner → engine pipeline |
| `templates/nextjs-basic/template.json` | Template metadata |
| `templates/nextjs-basic/` | Complete working Next.js project with token placeholders |
| `modules/auth-supabase/module.json` | Module metadata |
| `modules/auth-supabase/files/` | Auth files to copy into scaffolded project |
| `tests/utils/tokens.test.ts` | Token replacement tests |
| `tests/llm/schemas.test.ts` | Zod schema validation tests |
| `tests/engine/scaffold.test.ts` | Scaffold engine tests |
| `tests/engine/modules.test.ts` | Module application tests |
| `tests/engine/deps.test.ts` | Package manager detection tests |
| `tests/llm/planner.test.ts` | Planner tests (mocked LLM) |

---

## Chunk 1: Project Setup & Token Utilities

### Task 1: Initialize project with TypeScript, Vitest, and build tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`

- [ ] **Step 1: Initialize package.json**

```bash
cd /mnt/bigstore/media/apps/code-server/workspace/stacker
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @clack/prompts @anthropic-ai/sdk zod
npm install -D typescript tsx tsup vitest @types/node
```

- [ ] **Step 3: Configure package.json**

Edit `package.json` to set:

```json
{
  "name": "create-stack",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "create-stack": "./dist/index.js"
  },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Create tsconfig.json**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 5: Create tsup.config.ts**

Create `tsup.config.ts`:

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
})
```

- [ ] **Step 6: Create vitest.config.ts**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
  },
})
```

- [ ] **Step 7: Create minimal entry point to verify setup**

Create `src/index.ts`:

```typescript
console.log('create-stack')
```

- [ ] **Step 8: Verify dev and build work**

```bash
npx tsx src/index.ts
# Expected: prints "create-stack"

npx tsup
# Expected: builds dist/index.js with no errors
```

- [ ] **Step 9: Verify test runner works**

Create `tests/setup.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('setup', () => {
  it('works', () => {
    expect(1 + 1).toBe(2)
  })
})
```

```bash
npx vitest run
# Expected: 1 test passed
```

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsup.config.ts vitest.config.ts src/index.ts tests/setup.test.ts
git commit -m "feat: initialize project with TypeScript, Vitest, tsup"
```

---

### Task 2: Token replacement utility

**Files:**
- Create: `src/utils/tokens.ts`
- Create: `tests/utils/tokens.test.ts`

- [ ] **Step 1: Write failing tests for token replacement**

Create `tests/utils/tokens.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { replaceTokens, findUnresolvedTokens } from '../src/utils/tokens.js'

describe('replaceTokens', () => {
  it('replaces __TOKEN__ patterns with values', () => {
    const content = 'Welcome to __PROJECT_NAME__!'
    const result = replaceTokens(content, { PROJECT_NAME: 'my-app' })
    expect(result).toBe('Welcome to my-app!')
  })

  it('replaces multiple different tokens', () => {
    const content = '__PROJECT_NAME__ - __DESCRIPTION__'
    const result = replaceTokens(content, {
      PROJECT_NAME: 'my-app',
      DESCRIPTION: 'A cool app',
    })
    expect(result).toBe('my-app - A cool app')
  })

  it('replaces all occurrences of the same token', () => {
    const content = '__PROJECT_NAME__ and __PROJECT_NAME__'
    const result = replaceTokens(content, { PROJECT_NAME: 'my-app' })
    expect(result).toBe('my-app and my-app')
  })

  it('leaves content unchanged when no tokens match', () => {
    const content = 'no tokens here'
    const result = replaceTokens(content, { PROJECT_NAME: 'my-app' })
    expect(result).toBe('no tokens here')
  })
})

describe('findUnresolvedTokens', () => {
  it('returns empty array when no unresolved tokens', () => {
    expect(findUnresolvedTokens('hello world')).toEqual([])
  })

  it('finds unresolved __TOKEN__ patterns', () => {
    const content = 'hello __UNRESOLVED__ world'
    expect(findUnresolvedTokens(content)).toEqual(['__UNRESOLVED__'])
  })

  it('finds multiple unresolved tokens', () => {
    const content = '__FOO__ and __BAR__'
    const result = findUnresolvedTokens(content)
    expect(result).toContain('__FOO__')
    expect(result).toContain('__BAR__')
  })

  it('returns unique tokens only', () => {
    const content = '__FOO__ and __FOO__'
    expect(findUnresolvedTokens(content)).toEqual(['__FOO__'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/utils/tokens.test.ts
# Expected: FAIL — cannot find module
```

- [ ] **Step 3: Implement token utilities**

Create `src/utils/tokens.ts`:

```typescript
export function replaceTokens(
  content: string,
  values: Record<string, string>,
): string {
  let result = content
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`__${key}__`, value)
  }
  return result
}

export function findUnresolvedTokens(content: string): string[] {
  const matches = content.match(/__[A-Z][A-Z0-9_]*__/g)
  if (!matches) return []
  return [...new Set(matches)]
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/utils/tokens.test.ts
# Expected: all tests pass
```

- [ ] **Step 5: Commit**

```bash
git add src/utils/tokens.ts tests/utils/tokens.test.ts
git commit -m "feat: add token replacement utility with tests"
```

---

## Chunk 2: LLM Layer (Schemas, Client, Planner)

### Task 3: Zod schemas for StackDecision

**Files:**
- Create: `src/llm/schemas.ts`
- Create: `tests/llm/schemas.test.ts`

- [ ] **Step 1: Write failing tests for schema validation**

Create `tests/llm/schemas.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { stackDecisionSchema } from '../src/llm/schemas.js'

describe('stackDecisionSchema', () => {
  const validDecision = {
    frontend: 'nextjs',
    backend: 'node',
    database: 'postgres',
    auth: 'supabase',
    deployment: 'vercel',
    template: 'nextjs-basic',
    modules: ['auth-supabase'],
    reasoning: 'Next.js with Supabase auth is ideal for a small startup SaaS.',
  }

  it('accepts a valid StackDecision', () => {
    const result = stackDecisionSchema.safeParse(validDecision)
    expect(result.success).toBe(true)
  })

  it('accepts empty modules array', () => {
    const result = stackDecisionSchema.safeParse({
      ...validDecision,
      modules: [],
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing template', () => {
    const { template, ...missing } = validDecision
    const result = stackDecisionSchema.safeParse(missing)
    expect(result.success).toBe(false)
  })

  it('rejects missing reasoning', () => {
    const { reasoning, ...missing } = validDecision
    const result = stackDecisionSchema.safeParse(missing)
    expect(result.success).toBe(false)
  })

  it('rejects non-string modules', () => {
    const result = stackDecisionSchema.safeParse({
      ...validDecision,
      modules: [123],
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/llm/schemas.test.ts
# Expected: FAIL — cannot find module
```

- [ ] **Step 3: Implement schemas**

Create `src/llm/schemas.ts`:

```typescript
import { z } from 'zod'

export const stackDecisionSchema = z.object({
  frontend: z.string(),
  backend: z.string(),
  database: z.string(),
  auth: z.string(),
  deployment: z.string(),
  template: z.string(),
  modules: z.array(z.string()),
  reasoning: z.string(),
})

export type StackDecision = z.infer<typeof stackDecisionSchema>

export interface UserRequirements {
  projectName: string
  description: string
  scale: 'hobby' | 'startup' | 'enterprise'
  frontend: 'nextjs' | 'react-spa' | 'none'
  needsAuth: boolean
  needsPayments: boolean
}

export interface TemplateMetadata {
  name: string
  description: string
  tokens: string[]
  compatibleModules: string[]
}

export interface ModuleMetadata {
  name: string
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  env: string[]
  files: Record<string, string>
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/llm/schemas.test.ts
# Expected: all tests pass
```

- [ ] **Step 5: Commit**

```bash
git add src/llm/schemas.ts tests/llm/schemas.test.ts
git commit -m "feat: add Zod schemas and TypeScript interfaces"
```

---

### Task 4: Anthropic SDK client wrapper

**Files:**
- Create: `src/llm/client.ts`

- [ ] **Step 1: Implement client**

Create `src/llm/client.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (client) return client

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error(
      'Error: ANTHROPIC_API_KEY environment variable is not set.\n' +
      'Get your API key at https://console.anthropic.com/settings/keys\n' +
      'Then run: export ANTHROPIC_API_KEY=your-key-here'
    )
    process.exit(1)
  }

  client = new Anthropic({ apiKey })
  return client
}

export async function callClaude(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const anthropic = getClient()

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6-20250514', // Use the latest available claude-sonnet-4-6 model ID at time of implementation
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  return textBlock.text
}
```

No unit tests for this file — it's a thin wrapper over the Anthropic SDK. It will be tested via the planner integration tests with mocked SDK calls.

- [ ] **Step 2: Commit**

```bash
git add src/llm/client.ts
git commit -m "feat: add Anthropic SDK client wrapper"
```

---

### Task 5: Planner — LLM-driven stack selection

**Files:**
- Create: `src/llm/planner.ts`
- Create: `tests/llm/planner.test.ts`

- [ ] **Step 1: Write failing tests for the planner**

Create `tests/llm/planner.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { planStack } from '../src/llm/planner.js'
import type { UserRequirements, TemplateMetadata, ModuleMetadata } from '../src/llm/schemas.js'

// Mock the client module
vi.mock('../src/llm/client.js', () => ({
  callClaude: vi.fn(),
}))

import { callClaude } from '../src/llm/client.js'
const mockCallClaude = vi.mocked(callClaude)

const requirements: UserRequirements = {
  projectName: 'my-app',
  description: 'A SaaS analytics platform',
  scale: 'startup',
  frontend: 'nextjs',
  needsAuth: true,
  needsPayments: false,
}

const templates: TemplateMetadata[] = [
  {
    name: 'nextjs-basic',
    description: 'Basic Next.js application',
    tokens: ['PROJECT_NAME', 'DESCRIPTION'],
    compatibleModules: ['auth-supabase'],
  },
]

const modules: ModuleMetadata[] = [
  {
    name: 'auth-supabase',
    dependencies: { '@supabase/supabase-js': '^2.0.0' },
    devDependencies: {},
    env: ['SUPABASE_URL', 'SUPABASE_KEY'],
    files: { 'lib/auth.ts': 'files/auth.ts' },
  },
]

const validResponse = JSON.stringify({
  frontend: 'nextjs',
  backend: 'node',
  database: 'postgres',
  auth: 'supabase',
  deployment: 'vercel',
  template: 'nextjs-basic',
  modules: ['auth-supabase'],
  reasoning: 'Next.js with Supabase is ideal for a startup SaaS.',
})

describe('planStack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a valid StackDecision on success', async () => {
    mockCallClaude.mockResolvedValueOnce(validResponse)

    const result = await planStack(requirements, templates, modules)

    expect(result.template).toBe('nextjs-basic')
    expect(result.modules).toEqual(['auth-supabase'])
    expect(result.reasoning).toBeTruthy()
  })

  it('retries once on invalid JSON and succeeds', async () => {
    mockCallClaude
      .mockResolvedValueOnce('not valid json')
      .mockResolvedValueOnce(validResponse)

    const result = await planStack(requirements, templates, modules)

    expect(mockCallClaude).toHaveBeenCalledTimes(2)
    expect(result.template).toBe('nextjs-basic')
  })

  it('throws after two failures', async () => {
    mockCallClaude
      .mockResolvedValueOnce('bad')
      .mockResolvedValueOnce('also bad')

    await expect(planStack(requirements, templates, modules)).rejects.toThrow()
  })

  it('rejects modules not in compatibleModules', async () => {
    const badResponse = JSON.stringify({
      frontend: 'nextjs',
      backend: 'node',
      database: 'postgres',
      auth: 'nextauth',
      deployment: 'vercel',
      template: 'nextjs-basic',
      modules: ['auth-nextauth'],
      reasoning: 'NextAuth is great.',
    })

    mockCallClaude
      .mockResolvedValueOnce(badResponse)
      .mockResolvedValueOnce(badResponse)

    await expect(planStack(requirements, templates, modules)).rejects.toThrow(
      /not compatible/
    )
  })

  it('rejects unknown template name', async () => {
    const badTemplate = JSON.stringify({
      frontend: 'nextjs',
      backend: 'node',
      database: 'postgres',
      auth: 'supabase',
      deployment: 'vercel',
      template: 'nonexistent-template',
      modules: [],
      reasoning: 'This template does not exist.',
    })

    mockCallClaude
      .mockResolvedValueOnce(badTemplate)
      .mockResolvedValueOnce(badTemplate)

    await expect(planStack(requirements, templates, modules)).rejects.toThrow(
      /not found/
    )
  })

  it('extracts JSON from markdown code fences', async () => {
    const wrappedResponse = '```json\n' + validResponse + '\n```'
    mockCallClaude.mockResolvedValueOnce(wrappedResponse)

    const result = await planStack(requirements, templates, modules)
    expect(result.template).toBe('nextjs-basic')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/llm/planner.test.ts
# Expected: FAIL — cannot find module
```

- [ ] **Step 3: Implement planner**

Create `src/llm/planner.ts`:

```typescript
import { callClaude } from './client.js'
import {
  stackDecisionSchema,
  type StackDecision,
  type UserRequirements,
  type TemplateMetadata,
  type ModuleMetadata,
} from './schemas.js'

function buildSystemPrompt(
  templates: TemplateMetadata[],
  modules: ModuleMetadata[],
): string {
  return `You are a software architect. Given a developer's project requirements, choose the best architecture from the available templates and modules.

Available templates:
${JSON.stringify(templates, null, 2)}

Available modules:
${JSON.stringify(modules, null, 2)}

Return a JSON object matching this exact schema:
{
  "frontend": "string - framework name",
  "backend": "string - runtime/framework",
  "database": "string - database name",
  "auth": "string - auth provider",
  "deployment": "string - hosting platform",
  "template": "string - must be one of the available template names",
  "modules": ["string[] - must be from available module names, only include if relevant"],
  "reasoning": "string - 1-2 sentences explaining why this stack was chosen"
}

Return ONLY the JSON object. No markdown, no explanation outside the JSON.`
}

function buildUserMessage(requirements: UserRequirements): string {
  return `Project: ${requirements.projectName}
Description: ${requirements.description}
Scale: ${requirements.scale}
Frontend preference: ${requirements.frontend}
Needs authentication: ${requirements.needsAuth}
Needs payments: ${requirements.needsPayments}`
}

function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (fenceMatch) return fenceMatch[1].trim()
  return text.trim()
}

function validateCompatibility(
  decision: StackDecision,
  templates: TemplateMetadata[],
): void {
  const template = templates.find((t) => t.name === decision.template)
  if (!template) {
    throw new Error(`Template "${decision.template}" not found in available templates`)
  }

  for (const mod of decision.modules) {
    if (!template.compatibleModules.includes(mod)) {
      throw new Error(
        `Module "${mod}" is not compatible with template "${decision.template}". ` +
        `Compatible modules: ${template.compatibleModules.join(', ')}`
      )
    }
  }
}

export async function planStack(
  requirements: UserRequirements,
  templates: TemplateMetadata[],
  modules: ModuleMetadata[],
): Promise<StackDecision> {
  const systemPrompt = buildSystemPrompt(templates, modules)
  const userMessage = buildUserMessage(requirements)

  let lastError: Error | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt =
      attempt === 0
        ? userMessage
        : `${userMessage}\n\nPrevious attempt failed with error: ${lastError?.message}\nPlease fix the issue and return valid JSON.`

    try {
      const raw = await callClaude(systemPrompt, prompt)
      const json = extractJson(raw)
      const parsed = JSON.parse(json)
      const decision = stackDecisionSchema.parse(parsed)
      validateCompatibility(decision, templates)
      return decision
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  throw new Error(`Failed to get valid stack decision after 2 attempts: ${lastError?.message}`)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/llm/planner.test.ts
# Expected: all tests pass
```

- [ ] **Step 5: Commit**

```bash
git add src/llm/planner.ts tests/llm/planner.test.ts
git commit -m "feat: add LLM planner with retry and compatibility validation"
```

---

## Chunk 3: Execution Engine (Scaffold, Modules, Deps)

### Task 6: Template scaffolding engine

**Files:**
- Create: `src/engine/scaffold.ts`
- Create: `tests/engine/scaffold.test.ts`

- [ ] **Step 1: Write failing tests for scaffold**

Create `tests/engine/scaffold.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { scaffoldTemplate } from '../src/engine/scaffold.js'
import { mkdtemp, rm, mkdir, writeFile, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('scaffoldTemplate', () => {
  let templateDir: string
  let outputDir: string

  beforeEach(async () => {
    templateDir = await mkdtemp(join(tmpdir(), 'template-'))
    outputDir = await mkdtemp(join(tmpdir(), 'output-'))

    // Create template.json
    await writeFile(
      join(templateDir, 'template.json'),
      JSON.stringify({
        name: 'test-template',
        description: 'A test template',
        tokens: ['PROJECT_NAME', 'DESCRIPTION'],
        compatibleModules: [],
      })
    )

    // Create a template file with tokens
    await writeFile(
      join(templateDir, 'README.md'),
      '# __PROJECT_NAME__\n\n__DESCRIPTION__'
    )

    // Create a nested file
    await mkdir(join(templateDir, 'src'), { recursive: true })
    await writeFile(
      join(templateDir, 'src', 'index.ts'),
      'console.log("__PROJECT_NAME__")'
    )
  })

  afterEach(async () => {
    await rm(templateDir, { recursive: true, force: true })
    await rm(outputDir, { recursive: true, force: true })
  })

  it('copies template files to output directory', async () => {
    await scaffoldTemplate(templateDir, outputDir, {
      PROJECT_NAME: 'my-app',
      DESCRIPTION: 'A cool app',
    })

    const readme = await readFile(join(outputDir, 'README.md'), 'utf-8')
    expect(readme).toBe('# my-app\n\nA cool app')
  })

  it('replaces tokens in nested files', async () => {
    await scaffoldTemplate(templateDir, outputDir, {
      PROJECT_NAME: 'my-app',
      DESCRIPTION: 'A cool app',
    })

    const index = await readFile(join(outputDir, 'src', 'index.ts'), 'utf-8')
    expect(index).toBe('console.log("my-app")')
  })

  it('does not copy template.json to output', async () => {
    await scaffoldTemplate(templateDir, outputDir, {
      PROJECT_NAME: 'my-app',
      DESCRIPTION: 'A cool app',
    })

    const files = await readdir(outputDir)
    expect(files).not.toContain('template.json')
  })

  it('returns warnings for unresolved tokens', async () => {
    await writeFile(
      join(templateDir, 'config.ts'),
      'const url = "__API_URL__"'
    )

    const warnings = await scaffoldTemplate(templateDir, outputDir, {
      PROJECT_NAME: 'my-app',
      DESCRIPTION: 'A cool app',
    })

    expect(warnings).toContain('__API_URL__')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/engine/scaffold.test.ts
# Expected: FAIL — cannot find module
```

- [ ] **Step 3: Implement scaffold engine**

Create `src/engine/scaffold.ts`:

```typescript
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { replaceTokens, findUnresolvedTokens } from '../utils/tokens.js'

async function copyDir(
  src: string,
  dest: string,
  tokenValues: Record<string, string>,
  skip: string[],
): Promise<string[]> {
  const allUnresolved: string[] = []
  await mkdir(dest, { recursive: true })

  const entries = await readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    if (skip.includes(entry.name)) continue

    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)

    if (entry.isDirectory()) {
      const nested = await copyDir(srcPath, destPath, tokenValues, skip)
      allUnresolved.push(...nested)
    } else {
      const content = await readFile(srcPath, 'utf-8')
      const replaced = replaceTokens(content, tokenValues)
      const unresolved = findUnresolvedTokens(replaced)
      allUnresolved.push(...unresolved)
      await writeFile(destPath, replaced)
    }
  }

  return allUnresolved
}

export async function scaffoldTemplate(
  templateDir: string,
  outputDir: string,
  tokenValues: Record<string, string>,
): Promise<string[]> {
  const warnings = await copyDir(templateDir, outputDir, tokenValues, ['template.json'])
  return [...new Set(warnings)]
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/engine/scaffold.test.ts
# Expected: all tests pass
```

- [ ] **Step 5: Commit**

```bash
git add src/engine/scaffold.ts tests/engine/scaffold.test.ts
git commit -m "feat: add template scaffolding engine with token replacement"
```

---

### Task 7: Module application engine

**Files:**
- Create: `src/engine/modules.ts`
- Create: `tests/engine/modules.test.ts`

- [ ] **Step 1: Write failing tests for module application**

Create `tests/engine/modules.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { applyModule } from '../src/engine/modules.js'
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('applyModule', () => {
  let moduleDir: string
  let projectDir: string

  beforeEach(async () => {
    moduleDir = await mkdtemp(join(tmpdir(), 'module-'))
    projectDir = await mkdtemp(join(tmpdir(), 'project-'))

    // Create module.json
    await writeFile(
      join(moduleDir, 'module.json'),
      JSON.stringify({
        name: 'auth-supabase',
        dependencies: { '@supabase/supabase-js': '^2.0.0' },
        devDependencies: {},
        env: ['SUPABASE_URL', 'SUPABASE_KEY'],
        files: {
          'lib/auth.ts': 'files/auth.ts',
          'middleware.ts': 'files/middleware.ts',
        },
      })
    )

    // Create module files
    await mkdir(join(moduleDir, 'files'), { recursive: true })
    await writeFile(
      join(moduleDir, 'files', 'auth.ts'),
      'export const auth = "__PROJECT_NAME__"'
    )
    await writeFile(
      join(moduleDir, 'files', 'middleware.ts'),
      'export const middleware = true'
    )

    // Create project package.json
    await writeFile(
      join(projectDir, 'package.json'),
      JSON.stringify({
        name: 'my-app',
        dependencies: { next: '^14.0.0' },
      }, null, 2)
    )
  })

  afterEach(async () => {
    await rm(moduleDir, { recursive: true, force: true })
    await rm(projectDir, { recursive: true, force: true })
  })

  it('copies module files to project', async () => {
    await applyModule(moduleDir, projectDir, { PROJECT_NAME: 'my-app' })

    const auth = await readFile(join(projectDir, 'lib', 'auth.ts'), 'utf-8')
    expect(auth).toContain('my-app')
  })

  it('replaces tokens in module files', async () => {
    await applyModule(moduleDir, projectDir, { PROJECT_NAME: 'my-app' })

    const auth = await readFile(join(projectDir, 'lib', 'auth.ts'), 'utf-8')
    expect(auth).toBe('export const auth = "my-app"')
  })

  it('merges dependencies into package.json', async () => {
    await applyModule(moduleDir, projectDir, { PROJECT_NAME: 'my-app' })

    const pkg = JSON.parse(
      await readFile(join(projectDir, 'package.json'), 'utf-8')
    )
    expect(pkg.dependencies['@supabase/supabase-js']).toBe('^2.0.0')
    expect(pkg.dependencies['next']).toBe('^14.0.0')
  })

  it('module dependency wins over existing version', async () => {
    // Add conflicting dependency to project
    const pkg = JSON.parse(
      await readFile(join(projectDir, 'package.json'), 'utf-8')
    )
    pkg.dependencies['@supabase/supabase-js'] = '^1.0.0'
    await writeFile(join(projectDir, 'package.json'), JSON.stringify(pkg, null, 2))

    await applyModule(moduleDir, projectDir, { PROJECT_NAME: 'my-app' })

    const updated = JSON.parse(
      await readFile(join(projectDir, 'package.json'), 'utf-8')
    )
    expect(updated.dependencies['@supabase/supabase-js']).toBe('^2.0.0')
  })

  it('creates .env.example with env vars', async () => {
    await applyModule(moduleDir, projectDir, { PROJECT_NAME: 'my-app' })

    const envExample = await readFile(
      join(projectDir, '.env.example'),
      'utf-8'
    )
    expect(envExample).toContain('SUPABASE_URL=')
    expect(envExample).toContain('SUPABASE_KEY=')
  })

  it('appends to existing .env.example', async () => {
    await writeFile(join(projectDir, '.env.example'), 'EXISTING_VAR=value\n')

    await applyModule(moduleDir, projectDir, { PROJECT_NAME: 'my-app' })

    const envExample = await readFile(
      join(projectDir, '.env.example'),
      'utf-8'
    )
    expect(envExample).toContain('EXISTING_VAR=value')
    expect(envExample).toContain('SUPABASE_URL=')
  })

  it('overwrites existing project files', async () => {
    await mkdir(join(projectDir, 'lib'), { recursive: true })
    await writeFile(join(projectDir, 'lib', 'auth.ts'), 'old content')

    await applyModule(moduleDir, projectDir, { PROJECT_NAME: 'my-app' })

    const auth = await readFile(join(projectDir, 'lib', 'auth.ts'), 'utf-8')
    expect(auth).toBe('export const auth = "my-app"')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/engine/modules.test.ts
# Expected: FAIL — cannot find module
```

- [ ] **Step 3: Implement module application engine**

Create `src/engine/modules.ts`:

```typescript
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { replaceTokens, findUnresolvedTokens } from '../utils/tokens.js'
import type { ModuleMetadata } from '../llm/schemas.js'

export async function applyModule(
  moduleDir: string,
  projectDir: string,
  tokenValues: Record<string, string>,
): Promise<string[]> {
  const metaRaw = await readFile(join(moduleDir, 'module.json'), 'utf-8')
  const meta: ModuleMetadata = JSON.parse(metaRaw)

  const allUnresolved: string[] = []

  // Copy and token-replace module files
  for (const [destRelative, srcRelative] of Object.entries(meta.files)) {
    const srcPath = join(moduleDir, srcRelative)
    const destPath = join(projectDir, destRelative)

    await mkdir(dirname(destPath), { recursive: true })

    const content = await readFile(srcPath, 'utf-8')
    const replaced = replaceTokens(content, tokenValues)
    const unresolved = findUnresolvedTokens(replaced)
    allUnresolved.push(...unresolved)

    await writeFile(destPath, replaced)
  }

  // Merge dependencies into package.json
  const pkgPath = join(projectDir, 'package.json')
  const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))

  if (Object.keys(meta.dependencies).length > 0) {
    pkg.dependencies = { ...pkg.dependencies, ...meta.dependencies }
  }

  if (Object.keys(meta.devDependencies).length > 0) {
    pkg.devDependencies = { ...pkg.devDependencies, ...meta.devDependencies }
  }

  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

  // Append env vars to .env.example
  if (meta.env.length > 0) {
    const envPath = join(projectDir, '.env.example')
    let existing = ''
    try {
      existing = await readFile(envPath, 'utf-8')
    } catch {
      // File doesn't exist yet — that's fine
    }

    const newVars = meta.env
      .map((v) => `${v}=`)
      .join('\n')

    const separator = existing && !existing.endsWith('\n') ? '\n' : ''
    await writeFile(envPath, existing + separator + newVars + '\n')
  }

  return [...new Set(allUnresolved)]
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/engine/modules.test.ts
# Expected: all tests pass
```

- [ ] **Step 5: Commit**

```bash
git add src/engine/modules.ts tests/engine/modules.test.ts
git commit -m "feat: add module application engine with dep merge and env vars"
```

---

### Task 8: Package manager detection and dependency installation

**Files:**
- Create: `src/engine/deps.ts`
- Create: `tests/engine/deps.test.ts`

- [ ] **Step 1: Write failing tests for package manager detection**

Create `tests/engine/deps.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { detectPackageManager } from '../src/engine/deps.js'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('detectPackageManager', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'detect-pm-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('detects pnpm from pnpm-lock.yaml', async () => {
    await writeFile(join(dir, 'pnpm-lock.yaml'), '')
    expect(await detectPackageManager(dir)).toBe('pnpm')
  })

  it('detects yarn from yarn.lock', async () => {
    await writeFile(join(dir, 'yarn.lock'), '')
    expect(await detectPackageManager(dir)).toBe('yarn')
  })

  it('detects bun from bun.lockb', async () => {
    await writeFile(join(dir, 'bun.lockb'), '')
    expect(await detectPackageManager(dir)).toBe('bun')
  })

  it('defaults to npm when no lockfile found', async () => {
    expect(await detectPackageManager(dir)).toBe('npm')
  })

  it('pnpm takes priority over yarn', async () => {
    await writeFile(join(dir, 'pnpm-lock.yaml'), '')
    await writeFile(join(dir, 'yarn.lock'), '')
    expect(await detectPackageManager(dir)).toBe('pnpm')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/engine/deps.test.ts
# Expected: FAIL — cannot find module
```

- [ ] **Step 3: Implement deps engine**

Create `src/engine/deps.ts`:

```typescript
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

const lockfiles: [string, PackageManager][] = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lockb', 'bun'],
]

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function detectPackageManager(
  cwd: string,
): Promise<PackageManager> {
  for (const [lockfile, pm] of lockfiles) {
    if (await fileExists(join(cwd, lockfile))) {
      return pm
    }
  }
  return 'npm'
}

export async function installDependencies(projectDir: string): Promise<void> {
  const pm = await detectPackageManager(process.cwd())
  execSync(`${pm} install`, {
    cwd: projectDir,
    stdio: 'inherit',
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/engine/deps.test.ts
# Expected: all tests pass
```

- [ ] **Step 5: Commit**

```bash
git add src/engine/deps.ts tests/engine/deps.test.ts
git commit -m "feat: add package manager detection and dependency installation"
```

---

## Chunk 4: CLI Prompts, Templates, and Orchestrator

### Task 9: CLI interactive prompts

**Files:**
- Create: `src/cli/prompts.ts`

- [ ] **Step 1: Implement prompts**

Create `src/cli/prompts.ts`:

```typescript
import * as p from '@clack/prompts'
import type { UserRequirements } from '../llm/schemas.js'

const validNameRegex = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/

export async function collectRequirements(): Promise<UserRequirements> {
  const projectName = await p.text({
    message: 'What is your project name?',
    placeholder: 'my-app',
    validate(value) {
      if (!value) return 'Project name is required'
      if (!validNameRegex.test(value)) {
        return 'Must be lowercase, alphanumeric, hyphens/dots/underscores only'
      }
    },
  })

  if (p.isCancel(projectName)) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  const description = await p.text({
    message: 'Describe what you are building in a sentence',
    placeholder: 'A SaaS analytics platform for small businesses',
    validate(value) {
      if (!value) return 'Description is required'
    },
  })

  if (p.isCancel(description)) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  const scale = await p.select({
    message: 'Expected scale?',
    options: [
      { value: 'hobby' as const, label: 'Hobby / side project' },
      { value: 'startup' as const, label: 'Startup' },
      { value: 'enterprise' as const, label: 'Enterprise' },
    ],
  })

  if (p.isCancel(scale)) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  const frontend = await p.select({
    message: 'Frontend framework?',
    options: [
      { value: 'nextjs' as const, label: 'Next.js' },
      { value: 'react-spa' as const, label: 'React SPA' },
      { value: 'none' as const, label: 'None (API only)' },
    ],
  })

  if (p.isCancel(frontend)) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  const needsAuth = await p.confirm({
    message: 'Need authentication?',
  })

  if (p.isCancel(needsAuth)) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  const needsPayments = await p.confirm({
    message: 'Need payments?',
  })

  if (p.isCancel(needsPayments)) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  return {
    projectName,
    description,
    scale,
    frontend,
    needsAuth,
    needsPayments,
  }
}
```

Interactive prompts are not unit-tested — they require a TTY. They will be validated via manual testing and the integration test.

- [ ] **Step 2: Commit**

```bash
git add src/cli/prompts.ts
git commit -m "feat: add interactive CLI prompts with clack"
```

---

### Task 10: Create nextjs-basic template

**Files:**
- Create: `templates/nextjs-basic/template.json`
- Create: `templates/nextjs-basic/package.json`
- Create: `templates/nextjs-basic/tsconfig.json`
- Create: `templates/nextjs-basic/next.config.js`
- Create: `templates/nextjs-basic/app/layout.tsx`
- Create: `templates/nextjs-basic/app/page.tsx`
- Create: `templates/nextjs-basic/public/.gitkeep`

- [ ] **Step 1: Create template metadata**

Create `templates/nextjs-basic/template.json`:

```json
{
  "name": "nextjs-basic",
  "description": "Basic Next.js application with App Router",
  "tokens": ["PROJECT_NAME", "DESCRIPTION"],
  "compatibleModules": ["auth-supabase"]
}
```

- [ ] **Step 2: Create template package.json**

Create `templates/nextjs-basic/package.json`:

```json
{
  "name": "__PROJECT_NAME__",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 3: Create template tsconfig.json**

Create `templates/nextjs-basic/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create next.config.js**

Create `templates/nextjs-basic/next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = nextConfig
```

- [ ] **Step 5: Create app/layout.tsx**

Create `templates/nextjs-basic/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '__PROJECT_NAME__',
  description: '__DESCRIPTION__',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 6: Create app/page.tsx**

Create `templates/nextjs-basic/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main>
      <h1>__PROJECT_NAME__</h1>
      <p>__DESCRIPTION__</p>
    </main>
  )
}
```

- [ ] **Step 7: Create public/.gitkeep**

Create `templates/nextjs-basic/public/.gitkeep` (empty file).

- [ ] **Step 8: Commit**

```bash
git add templates/nextjs-basic/
git commit -m "feat: add nextjs-basic template"
```

---

### Task 11: Create auth-supabase module

**Files:**
- Create: `modules/auth-supabase/module.json`
- Create: `modules/auth-supabase/files/auth.ts`
- Create: `modules/auth-supabase/files/middleware.ts`

- [ ] **Step 1: Create module metadata**

Create `modules/auth-supabase/module.json`:

```json
{
  "name": "auth-supabase",
  "dependencies": {
    "@supabase/supabase-js": "^2.0.0",
    "@supabase/ssr": "^0.1.0"
  },
  "devDependencies": {},
  "env": ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  "files": {
    "lib/supabase.ts": "files/auth.ts",
    "middleware.ts": "files/middleware.ts"
  }
}
```

- [ ] **Step 2: Create auth utility file**

Create `modules/auth-supabase/files/auth.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Create middleware file**

Create `modules/auth-supabase/files/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 4: Commit**

```bash
git add modules/auth-supabase/
git commit -m "feat: add auth-supabase module"
```

---

### Task 12: Command orchestrator and entry point

**Files:**
- Create: `src/commands/init.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Implement the init command orchestrator**

Create `src/commands/init.ts`:

```typescript
import * as p from '@clack/prompts'
import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectRequirements } from '../cli/prompts.js'
import { planStack } from '../llm/planner.js'
import { scaffoldTemplate } from '../engine/scaffold.js'
import { applyModule } from '../engine/modules.js'
import { installDependencies } from '../engine/deps.js'
import type { TemplateMetadata, ModuleMetadata } from '../llm/schemas.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

function getProjectRoot(): string {
  // In dist (tsup bundles to dist/index.js): __dirname = dist/ → ../ = project root
  // In dev (tsx src/commands/init.ts): __dirname = src/commands/ → ../../ = project root
  const distRoot = resolve(__dirname, '..')
  if (existsSync(join(distRoot, 'templates'))) return distRoot
  return resolve(__dirname, '..', '..')
}

async function loadTemplates(rootDir: string): Promise<TemplateMetadata[]> {
  const templatesDir = join(rootDir, 'templates')
  const entries = await readdir(templatesDir, { withFileTypes: true })
  const templates: TemplateMetadata[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const metaPath = join(templatesDir, entry.name, 'template.json')
    const raw = await readFile(metaPath, 'utf-8')
    templates.push(JSON.parse(raw))
  }

  return templates
}

async function loadModules(rootDir: string): Promise<ModuleMetadata[]> {
  const modulesDir = join(rootDir, 'modules')
  const entries = await readdir(modulesDir, { withFileTypes: true })
  const modules: ModuleMetadata[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const metaPath = join(modulesDir, entry.name, 'module.json')
    const raw = await readFile(metaPath, 'utf-8')
    modules.push(JSON.parse(raw))
  }

  return modules
}

export async function runInit(): Promise<void> {
  p.intro('create-stack')

  const requirements = await collectRequirements()
  const outputDir = resolve(process.cwd(), requirements.projectName)

  const rootDir = getProjectRoot()
  const templates = await loadTemplates(rootDir)
  const modules = await loadModules(rootDir)

  const spinner = p.spinner()

  spinner.start('Planning your stack with AI...')
  let decision
  try {
    decision = await planStack(requirements, templates, modules)
  } catch (err) {
    spinner.stop('Planning failed')
    p.log.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
  spinner.stop('Stack planned')

  p.log.info(`Recommended stack:
  Frontend:   ${decision.frontend}
  Backend:    ${decision.backend}
  Database:   ${decision.database}
  Auth:       ${decision.auth}
  Deployment: ${decision.deployment}
  Template:   ${decision.template}
  Modules:    ${decision.modules.join(', ') || 'none'}

${decision.reasoning}`)

  const confirmed = await p.confirm({
    message: 'Proceed with this stack?',
  })

  if (p.isCancel(confirmed) || !confirmed) {
    p.outro('No problem — run create-stack again to start over.')
    return
  }

  // Scaffold template
  const templateDir = join(rootDir, 'templates', decision.template)
  const tokenValues = {
    PROJECT_NAME: requirements.projectName,
    DESCRIPTION: requirements.description,
  }

  spinner.start('Scaffolding project...')
  const scaffoldWarnings = await scaffoldTemplate(templateDir, outputDir, tokenValues)
  spinner.stop('Project scaffolded')

  if (scaffoldWarnings.length > 0) {
    p.log.warn(`Unresolved tokens found: ${scaffoldWarnings.join(', ')}`)
  }

  // Apply modules
  for (const moduleName of decision.modules) {
    const moduleDir = join(rootDir, 'modules', moduleName)
    spinner.start(`Applying module: ${moduleName}...`)
    const moduleWarnings = await applyModule(moduleDir, outputDir, tokenValues)
    spinner.stop(`Module applied: ${moduleName}`)

    if (moduleWarnings.length > 0) {
      p.log.warn(`Unresolved tokens in ${moduleName}: ${moduleWarnings.join(', ')}`)
    }
  }

  // Install dependencies
  spinner.start('Installing dependencies...')
  try {
    await installDependencies(outputDir)
    spinner.stop('Dependencies installed')
  } catch (err) {
    spinner.stop('Dependency installation failed')
    p.log.error(
      'Failed to install dependencies. You can install them manually:\n' +
      `  cd ${requirements.projectName}\n  npm install`
    )
  }

  // Collect env vars from applied modules
  const envVars = decision.modules.flatMap((modName) => {
    const mod = modules.find((m) => m.name === modName)
    return mod ? mod.env : []
  })

  const nextSteps = [`cd ${requirements.projectName}`]
  if (envVars.length > 0) {
    nextSteps.push('cp .env.example .env  # fill in your values')
  }
  nextSteps.push('npm run dev')

  p.log.step('Next steps:\n  ' + nextSteps.join('\n  '))
  p.outro('Happy building!')
}
```

- [ ] **Step 2: Update entry point**

Replace `src/index.ts` with:

```typescript
import { runInit } from './commands/init.js'

const command = process.argv[2]

if (!command || command === 'init') {
  runInit().catch((err) => {
    console.error(err)
    process.exit(1)
  })
} else {
  console.error(`Unknown command: ${command}`)
  console.error('Usage: create-stack [init]')
  process.exit(1)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/commands/init.ts src/index.ts
git commit -m "feat: add init command orchestrator and entry point"
```

---

### Task 13: End-to-end manual test

- [ ] **Step 1: Run all unit tests**

```bash
npx vitest run
# Expected: all tests pass
```

- [ ] **Step 2: Build the CLI**

```bash
npx tsup
# Expected: dist/index.js produced with no errors
```

- [ ] **Step 3: Manual smoke test (requires ANTHROPIC_API_KEY)**

```bash
export ANTHROPIC_API_KEY=your-key-here
cd /tmp
npx tsx /mnt/bigstore/media/apps/code-server/workspace/stacker/src/index.ts
```

Walk through the prompts. Verify:
- All 6 prompts appear and accept input
- Claude returns a stack recommendation
- Confirmation gate works (try "No" first, then rerun and confirm "Yes")
- Template is scaffolded with tokens replaced
- Module files are copied
- `.env.example` is created
- Dependencies install (or fail gracefully with helpful message)
- Next steps are shown

- [ ] **Step 4: Verify the scaffolded project**

```bash
cd /tmp/<project-name>
cat package.json    # should have project name and supabase deps
cat app/layout.tsx  # should have project name in title
cat lib/supabase.ts # should exist from auth module
cat .env.example    # should list SUPABASE env vars
```

- [ ] **Step 5: Delete the setup test**

```bash
rm tests/setup.test.ts
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete v1 create-stack CLI"
```
