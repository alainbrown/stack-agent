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
