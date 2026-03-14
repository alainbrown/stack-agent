import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync } from 'node:fs'
import { StageManager } from '../../src/agent/stage-manager.js'
import type { InvalidationFn } from '../../src/agent/stages.js'

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
      manager.progress = {
        ...manager.progress,
        frontend: { component: 'Next.js', reasoning: 'Best fit' },
      }
      manager.completeStage('frontend', 'Next.js')
      manager.navigateTo('frontend')

      manager.restorePendingNavigation()
      const stage = manager.stages.find((s) => s.id === 'frontend')!
      expect(stage.status).toBe('complete')
      expect(manager.progress.frontend?.component).toBe('Next.js')
    })

    it('restorePendingNavigation restores summary', () => {
      const manager = StageManager.start(testDir)
      manager.progress = {
        ...manager.progress,
        frontend: { component: 'Next.js', reasoning: 'Best fit' },
      }
      manager.completeStage('frontend', 'Next.js chosen')
      manager.navigateTo('frontend')

      const stage = manager.stages.find((s) => s.id === 'frontend')!
      expect(stage.summary).toBeUndefined() // cleared by navigateTo

      manager.restorePendingNavigation()
      expect(stage.summary).toBe('Next.js chosen') // restored
    })

    it('restorePendingNavigation is a no-op when no navigation is pending', () => {
      const manager = StageManager.start(testDir)
      manager.restorePendingNavigation()
      expect(manager.stages[0].status).toBe('pending')
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
        clear: ['project_info'],
        add: [],
        remove: [],
      })
      const manager = StageManager.start(testDir, mockInvalidate)
      manager.completeStage('project_info', 'Done')
      manager.completeStage('frontend', 'Next.js')

      await manager.invalidateAfter('frontend', null)

      const pi = manager.stages.find((s) => s.id === 'project_info')!
      expect(pi.status).toBe('complete')
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
          { id: 'cms', label: 'CMS', status: 'pending' as const, progressKeys: ['extras'] },
          { id: 'search', label: 'Search', status: 'pending' as const, progressKeys: ['extras'] },
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
      expect(ids.indexOf('cms')).toBe(ids.indexOf('frontend') + 1)
      expect(ids.indexOf('search')).toBe(ids.indexOf('cms') + 1)
    })
  })
})
