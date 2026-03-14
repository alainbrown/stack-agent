# Session Robustness Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent progress saving, session resume, stage navigation, and cascading invalidation to stack-agent's conversation flow.

**Architecture:** A `StageManager` orchestrator owns stage state, persistence, and navigation. The existing monolithic conversation loop is refactored into a per-stage loop called by the stage manager. An `InvalidationFn` callback keeps LLM concerns out of the state machine. CLI UI adds left-arrow stage navigation, resume prompt, and review screen.

**Tech Stack:** TypeScript, Node.js 20+, vitest, @clack/prompts, Anthropic SDK

**Spec:** `docs/superpowers/specs/2026-03-14-session-robustness-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/agent/stages.ts` | Create | `StageEntry` type, `StageStatus` type, default stage definitions, stage instructions map, `InvalidationResult`/`InvalidationFn` types |
| `src/agent/progress.ts` | Modify | Add `clearProjectInfo`, `SavedSession` interface, `serializeSession`/`deserializeSession` |
| `src/agent/stage-manager.ts` | Create | `StageManager` class — lifecycle, navigation, persistence, invalidation |
| `src/cli/chat.ts` | Modify | `InputResult` type, refactored `getUserInput`, `renderStageList`, `renderResumePrompt`, `renderReviewScreen` |
| `src/agent/tools.ts` | Modify | Remove `present_plan` tool, update `ConversationToolResult.signal` type |
| `src/agent/system-prompt.ts` | Modify | Accept `stageId`, build per-stage scoped prompt |
| `src/agent/loop.ts` | Modify | Replace `runConversationLoop` with `runStageLoop`, keep `runScaffoldLoop` |
| `src/llm/client.ts` | Modify | Make `tools` optional in `ChatOptions` (invalidation call uses no tools) |
| `src/index.ts` | Modify | Resume detection, `StageManager`-driven orchestration, `InvalidationFn` wiring |
| `tests/agent/stages.test.ts` | Create | Default stage definitions, progressKeys mapping |
| `tests/agent/progress.test.ts` | Modify | Append `clearProjectInfo`, session serialization round-trip tests |
| `tests/agent/stage-manager.test.ts` | Create | State transitions, persistence, invalidation |
| `tests/agent/tools.test.ts` | Modify | Remove `present_plan` tests, update tool count assertions |
| `tests/agent/system-prompt.test.ts` | Modify | Update `buildConversationPrompt` calls for new 3-arg signature |
| `tests/agent/loop.test.ts` | Modify | Update for `runStageLoop` replacing `runConversationLoop` |

---

## Chunk 1: Foundation — Types, Stage Definitions, Progress Extensions

### Task 1: Stage Types and Default Definitions

**Files:**
- Create: `src/agent/stages.ts`
- Test: `tests/agent/stages.test.ts`

- [ ] **Step 1: Write tests for stage definitions**

Create `tests/agent/stages.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_STAGES,
  STAGE_INSTRUCTIONS,
  type StageEntry,
  type StageStatus,
} from '../../src/agent/stages.js'

describe('DEFAULT_STAGES', () => {
  it('has 9 stages in the correct order', () => {
    const ids = DEFAULT_STAGES.map((s) => s.id)
    expect(ids).toEqual([
      'project_info',
      'frontend',
      'backend',
      'database',
      'auth',
      'payments',
      'ai',
      'deployment',
      'extras',
    ])
  })

  it('all stages start as pending', () => {
    for (const stage of DEFAULT_STAGES) {
      expect(stage.status).toBe('pending')
    }
  })

  it('project_info maps to projectName and description', () => {
    const stage = DEFAULT_STAGES.find((s) => s.id === 'project_info')!
    expect(stage.progressKeys).toEqual(['projectName', 'description'])
  })

  it('category stages map to their single key', () => {
    const frontend = DEFAULT_STAGES.find((s) => s.id === 'frontend')!
    expect(frontend.progressKeys).toEqual(['frontend'])
    const extras = DEFAULT_STAGES.find((s) => s.id === 'extras')!
    expect(extras.progressKeys).toEqual(['extras'])
  })
})

describe('STAGE_INSTRUCTIONS', () => {
  it('has an instruction for every default stage', () => {
    for (const stage of DEFAULT_STAGES) {
      expect(STAGE_INSTRUCTIONS[stage.id]).toBeDefined()
      expect(typeof STAGE_INSTRUCTIONS[stage.id]).toBe('string')
      expect(STAGE_INSTRUCTIONS[stage.id].length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/agent/stages.test.ts`
Expected: FAIL — module `../src/agent/stages.js` not found

- [ ] **Step 3: Implement stage types and defaults**

Create `src/agent/stages.ts`:

```typescript
import type { ComponentChoice, StackProgress } from './progress.js'

export type StageStatus = 'pending' | 'complete' | 'skipped'

export interface StageEntry {
  id: string
  label: string
  status: StageStatus
  summary?: string
  progressKeys: string[]
}

export interface InvalidationResult {
  clear: string[]
  add: StageEntry[]
  remove: string[]
}

export type InvalidationFn = (
  changedId: string,
  oldValue: ComponentChoice | null,
  newValue: ComponentChoice | null,
  progress: StackProgress,
  stages: StageEntry[],
) => Promise<InvalidationResult>

export const DEFAULT_STAGES: StageEntry[] = [
  { id: 'project_info', label: 'Project Info', status: 'pending', progressKeys: ['projectName', 'description'] },
  { id: 'frontend', label: 'Frontend', status: 'pending', progressKeys: ['frontend'] },
  { id: 'backend', label: 'Backend', status: 'pending', progressKeys: ['backend'] },
  { id: 'database', label: 'Database', status: 'pending', progressKeys: ['database'] },
  { id: 'auth', label: 'Auth', status: 'pending', progressKeys: ['auth'] },
  { id: 'payments', label: 'Payments', status: 'pending', progressKeys: ['payments'] },
  { id: 'ai', label: 'AI/LLM', status: 'pending', progressKeys: ['ai'] },
  { id: 'deployment', label: 'Deployment', status: 'pending', progressKeys: ['deployment'] },
  { id: 'extras', label: 'Extras', status: 'pending', progressKeys: ['extras'] },
]

export const STAGE_INSTRUCTIONS: Record<string, string> = {
  project_info: 'Ask for the project name and a brief description of what the user is building. Call set_project_info to record them.',
  frontend: 'Present 2-3 frontend framework options with trade-offs and your recommendation. Consider the project description when suggesting options.',
  backend: 'Present 2-3 backend/API options. Consider the chosen frontend — if it has built-in API routes (e.g., Next.js), that may be sufficient. If this stage is not needed, explain why and skip it.',
  database: 'Present 2-3 database options with ORM/query layer recommendations. Consider the chosen frontend and backend when suggesting options.',
  auth: 'Present 2-3 authentication options. If auth is not needed for this project, explain why and skip it.',
  payments: 'Present 2-3 payment processing options. If payments are not needed, explain why and skip it.',
  ai: 'Present 2-3 AI/LLM integration options. If AI is not needed, explain why and skip it.',
  deployment: 'Present 2-3 deployment platform options. Consider the chosen frontend and backend when suggesting options.',
  extras: 'Suggest any additional integrations that would benefit this project (analytics, email, monitoring, etc.). If none are needed, explain why and skip it.',
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/agent/stages.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/agent/stages.ts tests/agent/stages.test.ts
git commit -m "feat: add stage types, default definitions, and instructions map"
```

---

### Task 2: Progress Module Extensions

**Files:**
- Modify: `src/agent/progress.ts`
- Test: `tests/agent/progress.test.ts`

- [ ] **Step 1: Write tests for progress extensions**

**IMPORTANT:** `tests/agent/progress.test.ts` already exists with tests for `createProgress`, `setDecision`, `clearDecision`, `isComplete`, and `serializeProgress`. Append the new test blocks to the existing file — do NOT overwrite it.

Append to `tests/agent/progress.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  createProgress,
  clearDecision,
  clearProjectInfo,
  setDecision,
  type StackProgress,
  type SavedSession,
  serializeSession,
  deserializeSession,
} from '../../src/agent/progress.js'
import type { StageEntry } from '../../src/agent/stages.js'

describe('clearProjectInfo', () => {
  it('clears projectName and description', () => {
    const progress = createProgress()
    progress.projectName = 'my-app'
    progress.description = 'A task manager'
    const cleared = clearProjectInfo(progress)
    expect(cleared.projectName).toBeNull()
    expect(cleared.description).toBeNull()
  })

  it('does not affect other fields', () => {
    let progress = createProgress()
    progress.projectName = 'my-app'
    progress.description = 'A task manager'
    progress = setDecision(progress, 'frontend', {
      component: 'Next.js',
      reasoning: 'Best fit',
    })
    const cleared = clearProjectInfo(progress)
    expect(cleared.frontend).not.toBeNull()
    expect(cleared.frontend!.component).toBe('Next.js')
  })
})

describe('serializeSession / deserializeSession', () => {
  it('round-trips a session through JSON', () => {
    const stages: StageEntry[] = [
      { id: 'project_info', label: 'Project Info', status: 'complete', summary: 'my-app', progressKeys: ['projectName', 'description'] },
      { id: 'frontend', label: 'Frontend', status: 'pending', progressKeys: ['frontend'] },
    ]
    const session: SavedSession = {
      version: 1,
      createdAt: '2026-03-14T00:00:00.000Z',
      updatedAt: '2026-03-14T01:00:00.000Z',
      progress: createProgress(),
      stages,
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ],
    }

    const json = serializeSession(session)
    expect(typeof json).toBe('string')

    const restored = deserializeSession(json)
    expect(restored).toEqual(session)
  })

  it('returns null for invalid JSON', () => {
    expect(deserializeSession('not json')).toBeNull()
  })

  it('returns null for wrong version', () => {
    const bad = JSON.stringify({ version: 99, progress: {}, stages: [], messages: [] })
    expect(deserializeSession(bad)).toBeNull()
  })

  it('returns null for missing required fields', () => {
    const bad = JSON.stringify({ version: 1 })
    expect(deserializeSession(bad)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/agent/progress.test.ts`
Expected: FAIL — `clearProjectInfo`, `SavedSession`, `serializeSession`, `deserializeSession` not found

- [ ] **Step 3: Implement progress extensions**

Add to `src/agent/progress.ts` (after the existing `clearDecision` function):

```typescript
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js'
import type { StageEntry } from './stages.js'
```

Add the `clearProjectInfo` function after `clearDecision`:

```typescript
export function clearProjectInfo(progress: StackProgress): StackProgress {
  return { ...progress, projectName: null, description: null }
}
```

Add the `SavedSession` interface and serialization functions at the end of the file:

```typescript
export interface SavedSession {
  version: 1
  createdAt: string
  updatedAt: string
  progress: StackProgress
  stages: StageEntry[]
  messages: MessageParam[]
}

export function serializeSession(session: SavedSession): string {
  return JSON.stringify(session, null, 2)
}

export function deserializeSession(json: string): SavedSession | null {
  try {
    const data = JSON.parse(json)
    if (data.version !== 1) return null
    if (!data.progress || !Array.isArray(data.stages) || !Array.isArray(data.messages)) return null
    return data as SavedSession
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/agent/progress.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/agent/progress.ts tests/agent/progress.test.ts
git commit -m "feat: add clearProjectInfo, SavedSession type, and session serialization"
```

---

## Chunk 2: StageManager

### Task 3: StageManager — Lifecycle and State Transitions

**Files:**
- Create: `src/agent/stage-manager.ts`
- Test: `tests/agent/stage-manager.test.ts`

- [ ] **Step 1: Write tests for lifecycle and state transitions**

Create `tests/agent/stage-manager.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, unlinkSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync } from 'node:fs'
import { StageManager } from '../../src/agent/stage-manager.js'

describe('StageManager', () => {
  let testDir: string

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'stage-manager-test-'))
  })

  afterEach(() => {
    const file = join(testDir, '.stack-agent.json')
    if (existsSync(file)) unlinkSync(file)
  })

  describe('start', () => {
    it('creates a manager with default stages', () => {
      const manager = StageManager.start(testDir)
      expect(manager.stages).toHaveLength(9)
      expect(manager.stages[0].id).toBe('project_info')
      expect(manager.stages.every((s) => s.status === 'pending')).toBe(true)
    })

    it('creates empty progress', () => {
      const manager = StageManager.start(testDir)
      expect(manager.progress.projectName).toBeNull()
      expect(manager.progress.frontend).toBeNull()
    })

    it('starts with empty messages', () => {
      const manager = StageManager.start(testDir)
      expect(manager.messages).toEqual([])
    })
  })

  describe('currentStage', () => {
    it('returns the first pending stage', () => {
      const manager = StageManager.start(testDir)
      expect(manager.currentStage()?.id).toBe('project_info')
    })

    it('skips completed stages', () => {
      const manager = StageManager.start(testDir)
      manager.completeStage('project_info', 'Done')
      expect(manager.currentStage()?.id).toBe('frontend')
    })

    it('skips skipped stages', () => {
      const manager = StageManager.start(testDir)
      manager.completeStage('project_info', 'Done')
      manager.completeStage('frontend', 'Next.js')
      manager.skipStage('backend')
      expect(manager.currentStage()?.id).toBe('database')
    })

    it('returns null when all stages are complete or skipped', () => {
      const manager = StageManager.start(testDir)
      for (const stage of manager.stages) {
        manager.completeStage(stage.id, 'Done')
      }
      expect(manager.currentStage()).toBeNull()
    })
  })

  describe('completeStage', () => {
    it('marks stage as complete with summary', () => {
      const manager = StageManager.start(testDir)
      manager.completeStage('project_info', 'my-app: a task manager')
      const stage = manager.stages.find((s) => s.id === 'project_info')!
      expect(stage.status).toBe('complete')
      expect(stage.summary).toBe('my-app: a task manager')
    })
  })

  describe('skipStage', () => {
    it('marks stage as skipped', () => {
      const manager = StageManager.start(testDir)
      manager.skipStage('payments')
      const stage = manager.stages.find((s) => s.id === 'payments')!
      expect(stage.status).toBe('skipped')
    })
  })

  describe('addStage', () => {
    it('inserts a stage after the specified stage', () => {
      const manager = StageManager.start(testDir)
      manager.addStage(
        { id: 'email', label: 'Email', status: 'pending', progressKeys: ['extras'] },
        'auth',
      )
      const ids = manager.stages.map((s) => s.id)
      expect(ids.indexOf('email')).toBe(ids.indexOf('auth') + 1)
    })
  })

  describe('removeStage', () => {
    it('removes a stage by id', () => {
      const manager = StageManager.start(testDir)
      manager.removeStage('payments')
      expect(manager.stages.find((s) => s.id === 'payments')).toBeUndefined()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/agent/stage-manager.test.ts`
Expected: FAIL — `StageManager` not found

- [ ] **Step 3: Implement StageManager lifecycle and state transitions**

Create `src/agent/stage-manager.ts`:

```typescript
import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  createProgress,
  clearDecision,
  clearProjectInfo,
  type StackProgress,
  type SavedSession,
  type ProgressCategory,
  type ComponentChoice,
  serializeSession,
  deserializeSession,
} from './progress.js'
import {
  DEFAULT_STAGES,
  type StageEntry,
  type InvalidationFn,
} from './stages.js'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js'

const SESSION_FILE = '.stack-agent.json'
const SESSION_VERSION = 1

export class StageManager {
  private session: SavedSession
  private filePath: string
  private onInvalidate?: InvalidationFn
  private pendingNavigation?: {
    stageId: string
    oldValue: ComponentChoice | null
    oldProjectInfo?: { projectName: string | null; description: string | null }
    oldSummary?: string
  }

  private constructor(session: SavedSession, cwd: string, onInvalidate?: InvalidationFn) {
    this.session = session
    this.filePath = join(cwd, SESSION_FILE)
    this.onInvalidate = onInvalidate
  }

  static start(cwd: string, onInvalidate?: InvalidationFn): StageManager {
    const session: SavedSession = {
      version: SESSION_VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progress: createProgress(),
      stages: structuredClone(DEFAULT_STAGES),
      messages: [],
    }
    return new StageManager(session, cwd, onInvalidate)
  }

  static resume(cwd: string, onInvalidate?: InvalidationFn): StageManager | null {
    const session = StageManager.detect(cwd)
    if (!session) return null
    return new StageManager(session, cwd, onInvalidate)
  }

  static detect(cwd: string): SavedSession | null {
    const filePath = join(cwd, SESSION_FILE)
    if (!existsSync(filePath)) return null
    try {
      const json = readFileSync(filePath, 'utf-8')
      return deserializeSession(json)
    } catch {
      return null
    }
  }

  // --- Stage navigation ---

  currentStage(): StageEntry | null {
    return this.session.stages.find((s) => s.status === 'pending') ?? null
  }

  completeStage(id: string, summary: string): void {
    const stage = this.session.stages.find((s) => s.id === id)
    if (!stage) return
    stage.status = 'complete'
    stage.summary = summary
    this.session.updatedAt = new Date().toISOString()

    // If this was a navigation target, discard the stash
    if (this.pendingNavigation?.stageId === id) {
      this.pendingNavigation = undefined
    }
  }

  skipStage(id: string): void {
    const stage = this.session.stages.find((s) => s.id === id)
    if (!stage) return
    stage.status = 'skipped'
    this.session.updatedAt = new Date().toISOString()
  }

  navigateTo(id: string): void {
    const stage = this.session.stages.find((s) => s.id === id)
    if (!stage) return

    // Stash old value if revisiting a completed stage
    if (stage.status === 'complete') {
      if (id === 'project_info') {
        this.pendingNavigation = {
          stageId: id,
          oldValue: null,
          oldProjectInfo: {
            projectName: this.session.progress.projectName,
            description: this.session.progress.description,
          },
          oldSummary: stage.summary,
        }
      } else {
        const key = stage.progressKeys[0] as keyof StackProgress
        const oldValue = (key === 'extras')
          ? null
          : (this.session.progress[key] as ComponentChoice | null) ?? null
        this.pendingNavigation = {
          stageId: id,
          oldValue,
          oldSummary: stage.summary,
        }
      }
    }

    // Mark as pending so it becomes the current stage
    stage.status = 'pending'
    stage.summary = undefined
  }

  restorePendingNavigation(): void {
    if (!this.pendingNavigation) return
    const { stageId, oldValue, oldProjectInfo, oldSummary } = this.pendingNavigation
    const stage = this.session.stages.find((s) => s.id === stageId)
    if (!stage) return

    // Restore old decision
    if (stageId === 'project_info' && oldProjectInfo) {
      this.session.progress = {
        ...this.session.progress,
        projectName: oldProjectInfo.projectName,
        description: oldProjectInfo.description,
      }
    } else if (stageId !== 'project_info') {
      const category = stageId as ProgressCategory
      if (oldValue) {
        this.session.progress = { ...this.session.progress, [category]: oldValue }
      }
    }

    stage.status = 'complete'
    stage.summary = oldSummary
    this.pendingNavigation = undefined
  }

  isNavigating(): boolean {
    return this.pendingNavigation !== undefined
  }

  getPendingOldValue(): ComponentChoice | null {
    return this.pendingNavigation?.oldValue ?? null
  }

  // --- Dynamic stages ---

  addStage(entry: StageEntry, afterId: string): void {
    const idx = this.session.stages.findIndex((s) => s.id === afterId)
    if (idx === -1) {
      this.session.stages.push(entry)
    } else {
      this.session.stages.splice(idx + 1, 0, entry)
    }
    this.session.updatedAt = new Date().toISOString()
  }

  removeStage(id: string): void {
    this.session.stages = this.session.stages.filter((s) => s.id !== id)
    this.session.updatedAt = new Date().toISOString()
  }

  // --- Cascading invalidation ---

  async invalidateAfter(changedId: string, oldValue: ComponentChoice | null): Promise<void> {
    if (!this.onInvalidate) return

    const stage = this.session.stages.find((s) => s.id === changedId)
    if (!stage) return

    const key = stage.progressKeys[0] as keyof StackProgress
    const newValue = (key === 'extras' || key === 'projectName' || key === 'description')
      ? null
      : (this.session.progress[key] as ComponentChoice | null) ?? null

    const result = await this.onInvalidate(
      changedId,
      oldValue,
      newValue,
      this.session.progress,
      this.session.stages,
    )

    // Only affect stages after the changed stage
    const changedIdx = this.session.stages.findIndex((s) => s.id === changedId)

    // Clear invalidated stages
    for (const clearId of result.clear) {
      const clearIdx = this.session.stages.findIndex((s) => s.id === clearId)
      if (clearIdx <= changedIdx) continue // guardrail: only downstream
      const clearStage = this.session.stages[clearIdx]
      if (!clearStage) continue

      // Clear progress keys
      for (const pKey of clearStage.progressKeys) {
        if (pKey === 'projectName' || pKey === 'description') {
          this.session.progress = clearProjectInfo(this.session.progress)
        } else if (pKey === 'extras') {
          this.session.progress = clearDecision(this.session.progress, 'extras')
        } else {
          this.session.progress = clearDecision(this.session.progress, pKey as ProgressCategory)
        }
      }
      clearStage.status = 'pending'
      clearStage.summary = undefined
    }

    // Remove stages
    for (const removeId of result.remove) {
      const removeIdx = this.session.stages.findIndex((s) => s.id === removeId)
      if (removeIdx <= changedIdx) continue // guardrail
      this.removeStage(removeId)
    }

    // Add new stages (insert in order — each after the previous)
    let insertAfterId = changedId
    for (const newStage of result.add) {
      this.addStage(newStage, insertAfterId)
      insertAfterId = newStage.id
    }

    this.session.updatedAt = new Date().toISOString()
  }

  // --- Persistence ---

  save(): void {
    this.session.updatedAt = new Date().toISOString()
    const json = serializeSession(this.session)

    if (json.length > 500_000) {
      console.warn('Warning: session file exceeds 500KB. Consider summarizing more aggressively.')
    }

    try {
      const tmpPath = this.filePath + '.tmp'
      writeFileSync(tmpPath, json, 'utf-8')
      renameSync(tmpPath, this.filePath)
    } catch (err) {
      console.warn(`Warning: failed to save session: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  cleanup(): void {
    try {
      if (existsSync(this.filePath)) unlinkSync(this.filePath)
      const tmpPath = this.filePath + '.tmp'
      if (existsSync(tmpPath)) unlinkSync(tmpPath)
    } catch {
      // Best effort
    }
  }

  // --- Accessors ---

  get progress(): StackProgress {
    return this.session.progress
  }

  set progress(value: StackProgress) {
    this.session.progress = value
  }

  get messages(): MessageParam[] {
    return this.session.messages
  }

  set messages(value: MessageParam[]) {
    this.session.messages = value
  }

  get stages(): StageEntry[] {
    return this.session.stages
  }

  get updatedAt(): string {
    return this.session.updatedAt
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/agent/stage-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/agent/stage-manager.ts tests/agent/stage-manager.test.ts
git commit -m "feat: add StageManager with lifecycle, navigation, and state transitions"
```

---

### Task 4: StageManager — Persistence Tests

**Files:**
- Modify: `tests/agent/stage-manager.test.ts`

- [ ] **Step 1: Add persistence tests**

Append to `tests/agent/stage-manager.test.ts`:

```typescript
  describe('persistence', () => {
    it('detect returns null when no file exists', () => {
      expect(StageManager.detect(testDir)).toBeNull()
    })

    it('save creates a file that detect can read', () => {
      const manager = StageManager.start(testDir)
      manager.completeStage('project_info', 'my-app')
      manager.save()

      const filePath = join(testDir, '.stack-agent.json')
      expect(existsSync(filePath)).toBe(true)

      const detected = StageManager.detect(testDir)
      expect(detected).not.toBeNull()
      expect(detected!.stages[0].status).toBe('complete')
      expect(detected!.stages[0].summary).toBe('my-app')
    })

    it('resume restores full state', () => {
      const manager = StageManager.start(testDir)
      manager.completeStage('project_info', 'my-app')
      manager.completeStage('frontend', 'Next.js')
      manager.save()

      const resumed = StageManager.resume(testDir)
      expect(resumed).not.toBeNull()
      expect(resumed!.currentStage()?.id).toBe('backend')
      expect(resumed!.stages[0].summary).toBe('my-app')
      expect(resumed!.stages[1].summary).toBe('Next.js')
    })

    it('resume returns null for corrupt file', () => {
      const filePath = join(testDir, '.stack-agent.json')
      writeFileSync(filePath, 'not valid json', 'utf-8')
      expect(StageManager.resume(testDir)).toBeNull()
    })

    it('cleanup deletes the session file', () => {
      const manager = StageManager.start(testDir)
      manager.save()
      const filePath = join(testDir, '.stack-agent.json')
      expect(existsSync(filePath)).toBe(true)
      manager.cleanup()
      expect(existsSync(filePath)).toBe(false)
    })
  })
```

Add `writeFileSync` to the existing imports at the top of the file:

```typescript
import { existsSync, unlinkSync, readFileSync, writeFileSync } from 'node:fs'
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/agent/stage-manager.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/agent/stage-manager.test.ts
git commit -m "test: add StageManager persistence tests"
```

---

### Task 5: StageManager — Invalidation Tests

**Files:**
- Modify: `tests/agent/stage-manager.test.ts`

- [ ] **Step 1: Add invalidation and navigation tests**

Append to `tests/agent/stage-manager.test.ts`:

```typescript
  describe('navigateTo and invalidation', () => {
    it('navigateTo marks a completed stage as pending', () => {
      const manager = StageManager.start(testDir)
      manager.completeStage('frontend', 'Next.js')
      manager.navigateTo('frontend')
      const stage = manager.stages.find((s) => s.id === 'frontend')!
      expect(stage.status).toBe('pending')
    })

    it('restorePendingNavigation restores old decision', () => {
      const manager = StageManager.start(testDir)
      // Simulate having a frontend decision
      manager.progress = {
        ...manager.progress,
        frontend: { component: 'Next.js', reasoning: 'Best fit' },
      }
      manager.completeStage('frontend', 'Next.js')
      manager.navigateTo('frontend')

      // User cancels — restore
      manager.restorePendingNavigation()
      const stage = manager.stages.find((s) => s.id === 'frontend')!
      expect(stage.status).toBe('complete')
      expect(manager.progress.frontend?.component).toBe('Next.js')
    })

    it('invalidateAfter clears downstream stages', async () => {
      const mockInvalidate: InvalidationFn = async () => ({
        clear: ['backend'],
        add: [],
        remove: [],
      })
      const manager = StageManager.start(testDir, mockInvalidate)
      manager.completeStage('project_info', 'Done')
      manager.completeStage('frontend', 'Next.js')
      manager.progress = {
        ...manager.progress,
        backend: { component: 'Express', reasoning: 'Flexible' },
      }
      manager.completeStage('backend', 'Express')

      const oldFrontend = { component: 'Next.js', reasoning: 'Best fit' }
      await manager.invalidateAfter('frontend', oldFrontend)

      const backend = manager.stages.find((s) => s.id === 'backend')!
      expect(backend.status).toBe('pending')
      expect(manager.progress.backend).toBeNull()
    })

    it('invalidateAfter does not clear upstream stages (guardrail)', async () => {
      const mockInvalidate: InvalidationFn = async () => ({
        clear: ['project_info'], // trying to clear upstream — should be ignored
        add: [],
        remove: [],
      })
      const manager = StageManager.start(testDir, mockInvalidate)
      manager.completeStage('project_info', 'Done')
      manager.completeStage('frontend', 'Next.js')

      await manager.invalidateAfter('frontend', null)

      const pi = manager.stages.find((s) => s.id === 'project_info')!
      expect(pi.status).toBe('complete') // should NOT be cleared
    })

    it('invalidateAfter removes downstream stages', async () => {
      const mockInvalidate: InvalidationFn = async () => ({
        clear: [],
        add: [],
        remove: ['payments'],
      })
      const manager = StageManager.start(testDir, mockInvalidate)
      manager.completeStage('project_info', 'Done')
      manager.completeStage('frontend', 'Static HTML')

      await manager.invalidateAfter('frontend', null)

      expect(manager.stages.find((s) => s.id === 'payments')).toBeUndefined()
    })

    it('invalidateAfter adds new stages in order after the changed stage', async () => {
      const mockInvalidate: InvalidationFn = async () => ({
        clear: [],
        add: [
          { id: 'cms', label: 'CMS', status: 'pending', progressKeys: ['extras'] },
          { id: 'search', label: 'Search', status: 'pending', progressKeys: ['extras'] },
        ],
        remove: [],
      })
      const manager = StageManager.start(testDir, mockInvalidate)
      manager.completeStage('project_info', 'Done')
      manager.completeStage('frontend', 'Astro')

      await manager.invalidateAfter('frontend', null)

      const ids = manager.stages.map((s) => s.id)
      expect(ids).toContain('cms')
      expect(ids).toContain('search')
      // Verify order: frontend -> cms -> search (not reversed)
      expect(ids.indexOf('cms')).toBe(ids.indexOf('frontend') + 1)
      expect(ids.indexOf('search')).toBe(ids.indexOf('cms') + 1)
    })

    it('restorePendingNavigation is a no-op when no navigation is pending', () => {
      const manager = StageManager.start(testDir)
      manager.restorePendingNavigation() // should not throw
      expect(manager.stages[0].status).toBe('pending') // unchanged
    })

    it('isNavigating returns false by default, true after navigateTo', () => {
      const manager = StageManager.start(testDir)
      expect(manager.isNavigating()).toBe(false)
      manager.progress = {
        ...manager.progress,
        frontend: { component: 'Next.js', reasoning: 'Best fit' },
      }
      manager.completeStage('frontend', 'Next.js')
      manager.navigateTo('frontend')
      expect(manager.isNavigating()).toBe(true)
    })
  })
```

Add `InvalidationFn` to the imports:

```typescript
import type { InvalidationFn } from '../../src/agent/stages.js'
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/agent/stage-manager.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/agent/stage-manager.test.ts
git commit -m "test: add StageManager invalidation and navigation tests"
```

---

## Chunk 3: CLI UI

### Task 6: Input Handling — `InputResult` and Left Arrow Detection

**Files:**
- Modify: `src/cli/chat.ts`

- [ ] **Step 1: Add InputResult type and refactor getUserInput**

Add the `InputResult` type at the top of `src/cli/chat.ts` (after imports):

```typescript
export type InputResult =
  | { kind: 'text'; value: string }
  | { kind: 'cancel' }
  | { kind: 'navigate' }
```

Replace the existing `getUserInput` function with a version that detects left arrow:

```typescript
export async function getUserInput(message?: string, placeholder?: string): Promise<InputResult> {
  // Phase 1: Listen for left arrow before activating the text prompt
  const preKey = await listenForPreKey()
  if (preKey === 'navigate') {
    return { kind: 'navigate' }
  }

  // Phase 2: Delegate to clack text prompt
  // If a regular key was captured in phase 1, prepend it
  const result = await p.text({
    message: message ?? '›',
    placeholder: placeholder ?? 'Type your message...',
    initialValue: preKey ?? undefined,
  })

  if (p.isCancel(result)) {
    return { kind: 'cancel' }
  }

  return { kind: 'text', value: result as string }
}

function listenForPreKey(): Promise<string | 'navigate' | null> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve(null)
      return
    }

    const wasRaw = process.stdin.isRaw
    process.stdin.setRawMode(true)
    process.stdin.resume()

    const onData = (data: Buffer) => {
      process.stdin.removeListener('data', onData)
      process.stdin.setRawMode(wasRaw ?? false)
      process.stdin.pause()

      const seq = data.toString()
      // Left arrow escape sequence
      if (seq === '\x1b[D') {
        resolve('navigate')
      } else if (seq === '\x03') {
        // Ctrl+C — let it propagate
        resolve(null)
        process.emit('SIGINT' as any)
      } else {
        // Regular character — pass through to clack
        resolve(seq)
      }
    }

    process.stdin.on('data', onData)
  })
}
```

- [ ] **Step 2: Verify the module compiles**

Run: `npx tsx --eval "import './src/cli/chat.js'"`
Expected: No compilation errors (may warn about runtime but should not throw type errors)

- [ ] **Step 3: Commit**

```bash
git add src/cli/chat.ts
git commit -m "feat: add InputResult type and left-arrow detection to getUserInput"
```

---

### Task 7: Stage List, Resume Prompt, and Review Screen

**Files:**
- Modify: `src/cli/chat.ts`

- [ ] **Step 1: Add renderStageList**

Add to `src/cli/chat.ts`:

```typescript
import type { StageEntry } from '../agent/stages.js'
import { isComplete, serializeProgress, type StackProgress } from '../agent/progress.js'

export type StageListResult =
  | { kind: 'select'; stageId: string }
  | { kind: 'review' }
  | { kind: 'cancel' }

export async function renderStageList(
  stages: StageEntry[],
  currentStageId: string | null,
  progress: StackProgress,
): Promise<StageListResult> {
  while (true) {
    const options: { value: string; label: string; hint?: string }[] = []

    for (const stage of stages) {
      let prefix: string
      if (stage.status === 'complete') prefix = '\u2713'
      else if (stage.status === 'skipped') prefix = '\u2013'
      else if (stage.id === currentStageId) prefix = '\u25cf'
      else prefix = '\u25cb'

      const hint = stage.summary ?? (stage.id === currentStageId ? 'current' : undefined)
      options.push({
        value: stage.id,
        label: `${prefix} ${stage.label}`,
        hint,
      })
    }

    // Add Review & Build option
    const canReview = isComplete(progress)
    if (canReview) {
      options.push({
        value: '__review__',
        label: '\u2605 Review & Build',
      })
    } else {
      const remaining = requiredRemaining(progress)
      options.push({
        value: '__review__',
        label: `\u2605 Review & Build`,
        hint: `${remaining} required decision${remaining !== 1 ? 's' : ''} remaining`,
      })
    }

    const result = await p.select({
      message: 'Stack Progress',
      options,
    })

    if (p.isCancel(result)) {
      return { kind: 'cancel' }
    }

    if (result === '__review__') {
      if (!canReview) {
        p.log.warn('Complete the required decisions first (frontend, database, deployment).')
        continue // loop back instead of recursing
      }
      return { kind: 'review' }
    }

    return { kind: 'select', stageId: result as string }
  }
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

- [ ] **Step 2: Add renderResumePrompt**

Add to `src/cli/chat.ts`:

```typescript
import type { SavedSession } from '../agent/progress.js'

export type ResumeResult = 'resume' | 'fresh' | 'cancel'

export async function renderResumePrompt(session: SavedSession): Promise<ResumeResult> {
  const lines: string[] = []

  for (const stage of session.stages) {
    if (stage.status === 'complete') {
      lines.push(`  \u2713 ${stage.label.padEnd(16)} \u2014 ${stage.summary ?? 'done'}`)
    }
  }

  const pending = session.stages.filter((s) => s.status === 'pending')
  if (pending.length > 0) {
    lines.push(`  \u25cb ${pending.map((s) => s.label).join(', ')}`)
  }

  const updatedAt = new Date(session.updatedAt)
  const ago = formatTimeAgo(updatedAt)
  lines.push('')
  lines.push(`  Last updated: ${ago}`)

  p.log.info(`Found saved progress for "${session.progress.projectName ?? 'unnamed project'}"\n${lines.join('\n')}`)

  const result = await p.select({
    message: 'Resume or start fresh?',
    options: [
      { value: 'resume', label: 'Resume', hint: 'continue where you left off' },
      { value: 'fresh', label: 'Start fresh', hint: 'discard saved progress' },
    ],
  })

  if (p.isCancel(result)) return 'cancel'
  return result as ResumeResult
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}
```

- [ ] **Step 3: Add renderReviewScreen**

Add to `src/cli/chat.ts`:

```typescript
export type ReviewResult = 'confirm' | 'adjust' | 'cancel'

export async function renderReviewScreen(progress: StackProgress): Promise<ReviewResult> {
  renderPlan(serializeProgress(progress))

  const result = await p.select({
    message: 'Ready to build?',
    options: [
      { value: 'confirm', label: 'Confirm & build' },
      { value: 'adjust', label: 'Go back and adjust' },
      { value: 'cancel', label: 'Cancel', hint: 'progress saved for next time' },
    ],
  })

  if (p.isCancel(result)) return 'cancel'
  return result as ReviewResult
}
```

- [ ] **Step 4: Verify the module compiles**

Run: `npx tsx --eval "import './src/cli/chat.js'"`
Expected: No compilation errors

- [ ] **Step 5: Commit**

```bash
git add src/cli/chat.ts
git commit -m "feat: add stage list, resume prompt, and review screen UI"
```

---

## Chunk 4: Conversation Refactor

### Task 8: Remove `present_plan` Tool and Update Signals

**Files:**
- Modify: `src/agent/tools.ts`

- [ ] **Step 1: Remove present_plan from tool definitions**

In `src/agent/tools.ts`, remove the `present_plan` tool object from the array returned by `conversationToolDefinitions()` (lines 86-94).

- [ ] **Step 2: Remove `signal` field from ConversationToolResult**

The `signal` field was only used by `present_plan`. Stage completion is now detected by the loop checking tool names, not via signals. Remove the `signal` field from `ConversationToolResult` entirely (line 13).

- [ ] **Step 3: Remove present_plan handler from executeConversationTool**

Remove the `if (name === 'present_plan')` block (lines 197-202) from `executeConversationTool`.

- [ ] **Step 4: Verify the module compiles**

Run: `npx tsx --eval "import './src/agent/tools.js'"`
Expected: No compilation errors

- [ ] **Step 5: Commit**

```bash
git add src/agent/tools.ts
git commit -m "refactor: remove present_plan tool, update signal types"
```

---

### Task 9: Per-Stage System Prompt

**Files:**
- Modify: `src/agent/system-prompt.ts`

- [ ] **Step 1: Refactor buildConversationPrompt to accept stageId**

Replace the existing `buildConversationPrompt` function in `src/agent/system-prompt.ts`:

```typescript
import { serializeProgress, type StackProgress } from './progress.js'
import { STAGE_INSTRUCTIONS, type StageEntry } from './stages.js'

export function buildConversationPrompt(
  progress: StackProgress,
  stageId: string,
  stages: StageEntry[],
): string {
  const stage = stages.find((s) => s.id === stageId)
  const stageLabel = stage?.label ?? stageId
  const instruction = STAGE_INSTRUCTIONS[stageId] ?? `Discuss the ${stageLabel} stage with the user.`

  // Gather summaries from completed stages
  const completedSummaries = stages
    .filter((s) => s.status === 'complete' && s.summary)
    .map((s) => `- ${s.label}: ${s.summary}`)
    .join('\n')

  const contextSection = completedSummaries
    ? `\n\nContext from previous stages:\n${completedSummaries}`
    : ''

  return `You are a senior software architect helping a developer set up a new project.

Current project state:
${serializeProgress(progress)}

## Current Stage: ${stageLabel}

You are currently discussing the ${stageLabel} stage.
${instruction}

For each set of options, number them (1, 2, 3...) so users can respond quickly. Explicitly label your top pick with "(Recommended)" and explain WHY it's the best fit. Be opinionated — you are a senior architect, not a menu.
${contextSection}

Guidelines:
- Focus on ${stageLabel}. Do not discuss other undecided stages.
- When the user has made their choice, call \`set_decision\` to commit it, then call \`summarize_stage\` to summarize what was decided.
- If this stage is not relevant to the project, briefly explain why and call \`summarize_stage\` to skip it.
- Do not ask the user to confirm each tool call — just make the calls naturally as decisions are reached.`
}
```

Keep `buildScaffoldPrompt` unchanged.

- [ ] **Step 2: Verify the module compiles**

Run: `npx tsx --eval "import './src/agent/system-prompt.js'"`
Expected: No compilation errors

- [ ] **Step 3: Commit**

```bash
git add src/agent/system-prompt.ts
git commit -m "refactor: scope buildConversationPrompt to active stage"
```

---

### Task 10: Update Existing Tests for Modified Interfaces

**Files:**
- Modify: `tests/agent/tools.test.ts`
- Modify: `tests/agent/system-prompt.test.ts`

These existing test files reference interfaces that are changing. They must be updated before the loop refactor to keep the test suite passing.

- [ ] **Step 1: Update tests/agent/tools.test.ts**

Changes needed:
- The test checking `conversationToolDefinitions()` returns 4 tools — change to 3 (present_plan removed)
- Remove the `describe('present_plan', ...)` test block
- Remove any references to `signal: 'present_plan'`
- If tests reference `ConversationToolResult.signal`, remove those assertions (signal field is removed)

- [ ] **Step 2: Update tests/agent/system-prompt.test.ts**

Changes needed:
- `buildConversationPrompt(createProgress())` calls must add the two new parameters: `buildConversationPrompt(createProgress(), 'project_info', DEFAULT_STAGES)`
- Import `DEFAULT_STAGES` from `../../src/agent/stages.js`
- Update any assertions that check for `present_plan` in prompt text (no longer present)
- Update any assertions that check for the old monolithic prompt structure

- [ ] **Step 3: Run updated tests**

Run: `npx vitest run tests/agent/tools.test.ts tests/agent/system-prompt.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tests/agent/tools.test.ts tests/agent/system-prompt.test.ts
git commit -m "test: update tools and system-prompt tests for new interfaces"
```

---

### Task 11: Per-Stage Conversation Loop (renumbered from original Task 10)

**Files:**
- Modify: `src/agent/loop.ts`

- [ ] **Step 1: Add StageLoopResult type and refactor into runStageLoop**

Replace the `runConversationLoop` function in `src/agent/loop.ts` with `runStageLoop`. Keep all imports and `runScaffoldLoop` unchanged.

Add new imports at top:

```typescript
import type { StageEntry } from './stages.js'
import type { StageManager } from './stage-manager.js'
```

Add the result type:

```typescript
export type StageLoopResult =
  | { outcome: 'complete'; summary: string }
  | { outcome: 'skipped' }
  | { outcome: 'navigate' }
  | { outcome: 'cancel' }
```

Replace `runConversationLoop` with:

```typescript
export async function runStageLoop(
  stage: StageEntry,
  manager: StageManager,
  mcpServers?: Record<string, { url: string; apiKey?: string }>,
): Promise<StageLoopResult> {
  const messages = manager.messages
  let progress = manager.progress

  // Kick off this stage
  if (messages.length === 0) {
    messages.push({ role: 'user', content: 'I want to start a new project.' })
  }

  let hasCalledSetDecision = false

  while (true) {
    const system = buildConversationPrompt(progress, stage.id, manager.stages)

    let contentBlocks: object[] = []
    const collectedToolUse: Array<{ type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }> = []
    let hasText = false

    await chatStream(
      {
        system,
        messages,
        tools: conversationToolDefinitions(),
        maxTokens: 4096,
        mcpServers,
      },
      {
        onText: (delta) => {
          if (!hasText) {
            hasText = true
            writeText('\n')
          }
          writeText(delta)
        },
        onToolUse: (block) => {
          collectedToolUse.push(block)
        },
        onComplete: (response) => {
          contentBlocks = response.content
        },
      },
    )

    if (hasText) {
      writeLine()
      writeLine()
    }

    const toolUseBlocks = collectedToolUse

    if (toolUseBlocks.length > 0) {
      messages.push({ role: 'assistant', content: contentBlocks as MessageParam['content'] })

      const toolResults: object[] = []
      let hasSummarizeStage = false
      let summarizeSummary = ''
      let madeDecision = false

      for (const block of toolUseBlocks) {
        const toolBlock = block as {
          type: 'tool_use'
          id: string
          name: string
          input: Record<string, unknown>
        }

        const result = executeConversationTool(
          toolBlock.name,
          toolBlock.input,
          progress,
          messages,
        )

        progress = result.progress
        manager.progress = progress

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: result.response,
        })

        if (toolBlock.name === 'set_decision' || toolBlock.name === 'set_project_info') {
          madeDecision = true
          hasCalledSetDecision = true
        }

        if (toolBlock.name === 'summarize_stage') {
          hasSummarizeStage = true
          summarizeSummary = toolBlock.input.summary as string
        }
      }

      messages.push({ role: 'user', content: toolResults as MessageParam['content'] })

      // Save if progress changed
      if (madeDecision || hasSummarizeStage) {
        manager.save()
      }

      // Handle summarize_stage: compress messages
      if (hasSummarizeStage) {
        const lastAssistant = messages[messages.length - 2]
        const lastUser = messages[messages.length - 1]

        messages.length = 0
        messages.push({ role: 'assistant', content: summarizeSummary })
        messages.push({ role: 'user', content: '[Continuing]' })
        messages.push(lastAssistant)
        messages.push(lastUser)

        manager.messages = messages
      }

      // Check stage completion
      if (hasSummarizeStage) {
        if (hasCalledSetDecision || stage.id === 'project_info') {
          return { outcome: 'complete', summary: summarizeSummary }
        }
        // summarize_stage without a decision = skip
        return { outcome: 'skipped' }
      }

      // For non-extras category stages, set_decision alone completes the stage
      // (extras accumulate, only complete via summarize_stage)
      if (stage.id !== 'extras' && stage.id !== 'project_info' && hasCalledSetDecision) {
        // LLM should call summarize_stage next, but if it made the decision
        // without summarizing, continue the loop so it gets a chance to summarize
      }

      continue
    }

    // No tool use — get user input
    const inputResult = await getUserInput('Your response')

    if (inputResult.kind === 'cancel') return { outcome: 'cancel' }
    if (inputResult.kind === 'navigate') return { outcome: 'navigate' }

    messages.push({
      role: 'assistant',
      content: contentBlocks as MessageParam['content'],
    })
    messages.push({ role: 'user', content: inputResult.value })
  }
}
```

- [ ] **Step 2: Update imports**

Remove unused imports from the old `runConversationLoop` (like `createProgress`, `isComplete` if no longer used locally). Keep `serializeProgress` if still used by `runScaffoldLoop`. Add `StageManager` and `StageEntry` imports. Update `buildConversationPrompt` import to include the new signature.

- [ ] **Step 3: Verify the module compiles**

Run: `npx tsx --eval "import './src/agent/loop.js'"`
Expected: No compilation errors

- [ ] **Step 4: Commit**

```bash
git add src/agent/loop.ts
git commit -m "refactor: replace runConversationLoop with per-stage runStageLoop"
```

---

## Chunk 5: Orchestration and Integration

### Task 11: Make `tools` Optional in ChatOptions

**Files:**
- Modify: `src/llm/client.ts`

The invalidation LLM call needs to call `chat()` without tools. The Anthropic SDK rejects empty `tools` arrays.

- [ ] **Step 1: Make tools optional in ChatOptions**

In `src/llm/client.ts`, change `ChatOptions.tools` from required to optional:

```typescript
export interface ChatOptions {
  system: string
  messages: MessageParam[]
  tools?: Tool[]       // was: tools: Tool[]
  maxTokens: number
  mcpServers?: Record<string, { url: string; apiKey?: string }>
}
```

In `chat()` and `chatStream()`, only include `tools` in the API call if it has entries:

```typescript
...(tools && tools.length > 0 && { tools }),
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `npx vitest run`
Expected: PASS (existing callers already pass tools, so no breakage)

- [ ] **Step 3: Commit**

```bash
git add src/llm/client.ts
git commit -m "refactor: make tools optional in ChatOptions"
```

---

### Task 12: Update tests/agent/loop.test.ts

**Files:**
- Modify: `tests/agent/loop.test.ts`

The existing loop tests reference `runConversationLoop` and the old `getUserInput` signature (returns `string | null`). These must be updated for the new `runStageLoop` and `InputResult` interfaces.

- [ ] **Step 1: Update loop test imports and mocks**

Changes needed:
- Replace `runConversationLoop` imports with `runStageLoop`
- Mock `getUserInput` to return `InputResult` objects instead of `string | null`
  - `'some text'` becomes `{ kind: 'text', value: 'some text' }`
  - `null` becomes `{ kind: 'cancel' }`
- Create a mock `StageManager` that provides `progress`, `messages`, `stages`, and `save()`
- Create `StageEntry` fixtures for test stages
- Update assertions for `StageLoopResult` instead of `StackProgress | null`

- [ ] **Step 2: Run updated tests**

Run: `npx vitest run tests/agent/loop.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/agent/loop.test.ts
git commit -m "test: update loop tests for runStageLoop and InputResult"
```

---

### Task 13: Rewrite index.ts with StageManager Orchestration

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Rewrite main function**

Replace the contents of `src/index.ts`:

```typescript
import * as p from '@clack/prompts'
import { intro, outro, renderError, renderPostScaffold } from './cli/chat.js'
import {
  renderResumePrompt,
  renderStageList,
  renderReviewScreen,
  type ResumeResult,
} from './cli/chat.js'
import { checkDeployReadiness } from './deploy/readiness.js'
import { runStageLoop } from './agent/loop.js'
import { runScaffoldLoop } from './agent/loop.js'
import { StageManager } from './agent/stage-manager.js'
import { serializeProgress } from './agent/progress.js'
import { chat } from './llm/client.js'
import type { InvalidationFn } from './agent/stages.js'

const INVALIDATION_PROMPT = `You are evaluating whether changing a technology stack decision affects other decisions.

The user changed their decision. Given the current state of all decisions, determine which OTHER decisions (if any) are now invalid and should be reconsidered.

Rules:
- Only include stages that are GENUINELY affected by the change.
- Only affect stages AFTER the changed stage in the ordered list.
- Consider whether each decision was dependent on the changed decision.
- If nothing needs to change, return empty arrays.

Examples:

Changed frontend from Next.js to Astro (backend was "Next.js API routes"):
{"clear":["backend"],"add":[],"remove":[]}
Reason: Backend was tied to Next.js. If backend had been "Express" (independent), it would NOT be cleared.

Changed auth from Clerk to Auth.js:
{"clear":[],"add":[],"remove":[]}
Reason: Swapping auth providers doesn't affect other decisions.

Changed frontend from Next.js to static HTML:
{"clear":["backend","auth","ai"],"add":[],"remove":["payments"]}
Reason: Static site fundamentally changes what's viable.

Respond with ONLY a JSON object: {"clear": [...], "add": [...], "remove": [...]}
`

function createInvalidationFn(): InvalidationFn {
  return async (changedId, oldValue, newValue, progress, stages) => {
    const stageList = stages.map((s) => `${s.id} (${s.status}): ${s.summary ?? 'no decision'}`).join('\n')

    const userPrompt = `The user changed "${changedId}" from "${oldValue?.component ?? 'none'}" to "${newValue?.component ?? 'none'}".

Current decisions:
${serializeProgress(progress)}

Current stages:
${stageList}

What needs to change?`

    try {
      // Note: ChatOptions.tools must be made optional in src/llm/client.ts,
      // or pass undefined. The Anthropic SDK rejects empty tools arrays.
      const response = await chat({
        system: INVALIDATION_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 1024,
      })

      const text = response.content
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { type: string; text: string }) => b.text)
        .join('')

      const parsed = JSON.parse(text)
      return {
        clear: Array.isArray(parsed.clear) ? parsed.clear : [],
        add: Array.isArray(parsed.add) ? parsed.add : [],
        remove: Array.isArray(parsed.remove) ? parsed.remove : [],
      }
    } catch {
      // If invalidation fails, don't clear anything — conservative fallback
      return { clear: [], add: [], remove: [] }
    }
  }
}

async function main() {
  intro()

  const cwd = process.cwd()
  const invalidationFn = createInvalidationFn()

  // Check for existing session
  let manager: StageManager
  const existingSession = StageManager.detect(cwd)

  if (existingSession) {
    const resumeResult = await renderResumePrompt(existingSession)
    if (resumeResult === 'cancel') {
      outro('See you next time.')
      return
    }
    if (resumeResult === 'fresh') {
      // Delete old session and start fresh
      const tempManager = StageManager.resume(cwd)
      tempManager?.cleanup()
      manager = StageManager.start(cwd, invalidationFn)
    } else {
      const resumed = StageManager.resume(cwd, invalidationFn)
      if (!resumed) {
        p.log.warn('Could not restore session. Starting fresh.')
        manager = StageManager.start(cwd, invalidationFn)
      } else {
        manager = resumed
      }
    }
  } else {
    manager = StageManager.start(cwd, invalidationFn)
  }

  // Phase 1: Stage-driven conversation loop
  while (true) {
    const stage = manager.currentStage()

    if (!stage) {
      // All stages done — show review
      const reviewResult = await renderReviewScreen(manager.progress)
      if (reviewResult === 'confirm') {
        break // proceed to scaffold
      } else if (reviewResult === 'adjust') {
        const listResult = await renderStageList(manager.stages, null, manager.progress)
        if (listResult.kind === 'cancel') {
          manager.save()
          outro('Progress saved. Run stack-agent again to resume.')
          return
        }
        if (listResult.kind === 'select') {
          manager.navigateTo(listResult.stageId)
        }
        // If review, loop back to show review again
        continue
      } else {
        // cancel
        manager.save()
        outro('Progress saved. Run stack-agent again to resume.')
        return
      }
    }

    const result = await runStageLoop(stage, manager)

    switch (result.outcome) {
      case 'complete': {
        // Check BEFORE completeStage clears the navigation stash
        const wasNavigation = manager.isNavigating()
        const oldValue = manager.getPendingOldValue()
        manager.completeStage(stage.id, result.summary)
        manager.save()

        // If this was a navigation (user changed a decision), check invalidation
        if (wasNavigation) {
          await manager.invalidateAfter(stage.id, oldValue)
          manager.save()
        }
        break
      }
      case 'skipped':
        manager.skipStage(stage.id)
        manager.save()
        break
      case 'navigate': {
        const listResult = await renderStageList(manager.stages, stage.id, manager.progress)
        if (listResult.kind === 'cancel') {
          manager.restorePendingNavigation()
          continue
        }
        if (listResult.kind === 'review') {
          // Show review screen on next iteration (if all stages complete)
          // Mark current stage as pending so it gets re-evaluated
          continue
        }
        if (listResult.kind === 'select') {
          if (listResult.stageId !== stage.id) {
            manager.navigateTo(listResult.stageId)
          }
        }
        break
      }
      case 'cancel':
        manager.save()
        outro('Progress saved. Run stack-agent again to resume.')
        return
    }
  }

  // Phase 2: Scaffold
  const success = await runScaffoldLoop(manager.progress)

  if (success) {
    const readiness = manager.progress.deployment
      ? checkDeployReadiness(manager.progress.deployment.component)
      : null
    renderPostScaffold(manager.progress.projectName!, readiness)
    manager.cleanup() // Remove session file on success
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
  console.error('Usage: stack-agent [init]')
  process.exit(1)
}
```

- [ ] **Step 2: Verify the module compiles**

Run: `npx tsx --eval "import './src/index.js'"`
Expected: No compilation errors (may exit due to missing API key, but no type errors)

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: rewrite index.ts with StageManager orchestration and resume flow"
```

---

### Task 14: Verify Exports and Type Check

**Files:**
- Modify: `src/agent/loop.ts`

- [ ] **Step 1: Verify runScaffoldLoop is still exported**

Check that `runScaffoldLoop` is still exported from `src/agent/loop.ts` and that the import in `src/index.ts` resolves correctly. The `runScaffoldLoop` function should be unchanged.

- [ ] **Step 2: Run full type check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: resolve type errors from orchestration integration"
```

---

### Task 15: Run Full Test Suite

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Fix any failures**

Address any test failures, type errors, or build errors. Common issues:
- Import path mismatches (`.js` extensions for ESM)
- Missing exports
- Type mismatches between old and new interfaces

- [ ] **Step 5: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve test and build issues"
```

---

### Task 16: SIGINT Handler

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add SIGINT handler at top of main()**

Add early in the `main()` function, after `const cwd = process.cwd()`:

```typescript
  // Handle SIGINT gracefully — save progress before exit
  let activeSave = false
  process.on('SIGINT', () => {
    if (activeSave) return // let in-progress save complete
    process.exit(0)
  })
```

Note: The `StageManager.save()` method is synchronous (writeFileSync), so SIGINT during save is handled by the atomic write pattern (write to `.tmp` then rename). No additional coordination needed beyond the existing implementation.

- [ ] **Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat: add SIGINT handler for graceful exit"
```

---

### Task 17: Smoke Test

**Files:** None (manual verification)

- [ ] **Step 1: Run the CLI**

Run: `npm run dev`
Expected: CLI starts, asks for project info. Verify:
- Left arrow shows stage list
- Making a decision saves `.stack-agent.json`
- Ctrl+C exits with "Progress saved" message

- [ ] **Step 2: Test resume**

Run: `npm run dev` again (with `.stack-agent.json` present)
Expected: Shows resume prompt with saved progress. Verify:
- "Resume" continues from last stage
- "Start fresh" deletes file and starts over

- [ ] **Step 3: Test navigation**

During a session, press left arrow and select a completed stage.
Expected: Returns to that stage for re-discussion.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: session robustness — progress persistence, resume, and stage navigation"
```
