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
})
