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
