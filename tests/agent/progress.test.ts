import { describe, it, expect } from 'vitest'
import {
  createProgress,
  setDecision,
  clearDecision,
  clearProjectInfo,
  isComplete,
  serializeProgress,
  serializeSession,
  deserializeSession,
} from '../../src/agent/progress.js'
import type { ComponentChoice, StackProgress, SavedSession } from '../../src/agent/progress.js'
import type { StageEntry } from '../../src/agent/stages.js'

describe('createProgress', () => {
  it('returns an empty StackProgress', () => {
    const progress = createProgress()
    expect(progress.projectName).toBeNull()
    expect(progress.description).toBeNull()
    expect(progress.frontend).toBeNull()
    expect(progress.backend).toBeNull()
    expect(progress.database).toBeNull()
    expect(progress.auth).toBeNull()
    expect(progress.payments).toBeNull()
    expect(progress.deployment).toBeNull()
    expect(progress.extras).toEqual([])
  })
})

describe('setDecision', () => {
  it('sets a non-extras category', () => {
    const progress = createProgress()
    const choice: ComponentChoice = { component: 'React', reasoning: 'Popular' }
    const updated = setDecision(progress, 'frontend', choice)
    expect(updated.frontend).toEqual(choice)
  })

  it('sets a decision with scaffoldTool and scaffoldArgs', () => {
    const progress = createProgress()
    const choice: ComponentChoice = {
      component: 'Next.js',
      reasoning: 'Full-stack',
      scaffoldTool: 'create-next-app',
      scaffoldArgs: ['--typescript', '--tailwind'],
    }
    const updated = setDecision(progress, 'frontend', choice)
    expect(updated.frontend).toEqual(choice)
    expect(updated.frontend?.scaffoldTool).toBe('create-next-app')
    expect(updated.frontend?.scaffoldArgs).toEqual(['--typescript', '--tailwind'])
  })

  it('does not mutate the original progress', () => {
    const progress = createProgress()
    const choice: ComponentChoice = { component: 'React', reasoning: 'Popular' }
    setDecision(progress, 'frontend', choice)
    expect(progress.frontend).toBeNull()
  })

  it('overwrites non-extras decisions on subsequent calls', () => {
    const progress = createProgress()
    const first: ComponentChoice = { component: 'React', reasoning: 'Popular' }
    const second: ComponentChoice = { component: 'Vue', reasoning: 'Simpler' }
    const after1 = setDecision(progress, 'frontend', first)
    const after2 = setDecision(after1, 'frontend', second)
    expect(after2.frontend).toEqual(second)
  })

  it('appends to extras on multiple calls', () => {
    const progress = createProgress()
    const choice1: ComponentChoice = { component: 'Sentry', reasoning: 'Error tracking' }
    const choice2: ComponentChoice = { component: 'Redis', reasoning: 'Caching' }
    const after1 = setDecision(progress, 'extras', choice1)
    const after2 = setDecision(after1, 'extras', choice2)
    expect(after2.extras).toHaveLength(2)
    expect(after2.extras[0]).toEqual(choice1)
    expect(after2.extras[1]).toEqual(choice2)
  })

  it('does not overwrite extras on subsequent calls', () => {
    const progress = createProgress()
    const choice1: ComponentChoice = { component: 'Sentry', reasoning: 'Error tracking' }
    const choice2: ComponentChoice = { component: 'Redis', reasoning: 'Caching' }
    const after1 = setDecision(progress, 'extras', choice1)
    const after2 = setDecision(after1, 'extras', choice2)
    expect(after2.extras[0]).toEqual(choice1)
  })

  it('can set all optional categories', () => {
    let progress = createProgress()
    progress = setDecision(progress, 'backend', { component: 'Express', reasoning: 'Simple' })
    progress = setDecision(progress, 'auth', { component: 'Auth0', reasoning: 'Managed' })
    progress = setDecision(progress, 'payments', { component: 'Stripe', reasoning: 'Standard' })
    expect(progress.backend?.component).toBe('Express')
    expect(progress.auth?.component).toBe('Auth0')
    expect(progress.payments?.component).toBe('Stripe')
  })
})

describe('clearDecision', () => {
  it('clears a non-extras category back to null', () => {
    const progress = createProgress()
    const choice: ComponentChoice = { component: 'React', reasoning: 'Popular' }
    const withChoice = setDecision(progress, 'frontend', choice)
    const cleared = clearDecision(withChoice, 'frontend')
    expect(cleared.frontend).toBeNull()
  })

  it('clears extras back to empty array', () => {
    const progress = createProgress()
    const choice: ComponentChoice = { component: 'Sentry', reasoning: 'Error tracking' }
    const withChoice = setDecision(progress, 'extras', choice)
    const cleared = clearDecision(withChoice, 'extras')
    expect(cleared.extras).toEqual([])
  })

  it('does not mutate the original progress', () => {
    const progress = createProgress()
    const choice: ComponentChoice = { component: 'React', reasoning: 'Popular' }
    const withChoice = setDecision(progress, 'frontend', choice)
    clearDecision(withChoice, 'frontend')
    expect(withChoice.frontend).toEqual(choice)
  })

  it('clearing an already-null category returns null', () => {
    const progress = createProgress()
    const cleared = clearDecision(progress, 'frontend')
    expect(cleared.frontend).toBeNull()
  })
})

describe('isComplete', () => {
  it('returns false when progress is empty', () => {
    expect(isComplete(createProgress())).toBe(false)
  })

  it('returns false when only some required fields are set', () => {
    let progress = createProgress()
    progress = setDecision(progress, 'frontend', { component: 'React', reasoning: 'Popular' })
    progress = setDecision(progress, 'database', { component: 'Postgres', reasoning: 'Reliable' })
    expect(isComplete(progress)).toBe(false)
  })

  it('returns false when projectName and description missing', () => {
    let progress = createProgress()
    progress = setDecision(progress, 'frontend', { component: 'React', reasoning: 'Popular' })
    progress = setDecision(progress, 'database', { component: 'Postgres', reasoning: 'Reliable' })
    progress = setDecision(progress, 'deployment', { component: 'Vercel', reasoning: 'Easy' })
    expect(isComplete(progress)).toBe(false)
  })

  it('returns true when all required fields are set (no optional fields needed)', () => {
    let progress = createProgress()
    progress = { ...progress, projectName: 'MyApp', description: 'A cool app' }
    progress = setDecision(progress, 'frontend', { component: 'React', reasoning: 'Popular' })
    progress = setDecision(progress, 'database', { component: 'Postgres', reasoning: 'Reliable' })
    progress = setDecision(progress, 'deployment', { component: 'Vercel', reasoning: 'Easy' })
    expect(isComplete(progress)).toBe(true)
  })

  it('returns true even without backend, auth, and payments set', () => {
    let progress = createProgress()
    progress = { ...progress, projectName: 'MyApp', description: 'A cool app' }
    progress = setDecision(progress, 'frontend', { component: 'React', reasoning: 'Popular' })
    progress = setDecision(progress, 'database', { component: 'Postgres', reasoning: 'Reliable' })
    progress = setDecision(progress, 'deployment', { component: 'Vercel', reasoning: 'Easy' })
    // backend, auth, payments are NOT set
    expect(progress.backend).toBeNull()
    expect(progress.auth).toBeNull()
    expect(progress.payments).toBeNull()
    expect(isComplete(progress)).toBe(true)
  })
})

describe('serializeProgress', () => {
  it('shows "not yet decided" for all fields when empty', () => {
    const output = serializeProgress(createProgress())
    expect(output).toContain('not yet decided')
  })

  it('includes component names for set decisions', () => {
    let progress = createProgress()
    progress = { ...progress, projectName: 'MyApp', description: 'A cool app' }
    progress = setDecision(progress, 'frontend', { component: 'React', reasoning: 'Popular' })
    const output = serializeProgress(progress)
    expect(output).toContain('React')
    expect(output).toContain('MyApp')
    expect(output).toContain('A cool app')
  })

  it('still shows "not yet decided" for unset fields alongside set ones', () => {
    let progress = createProgress()
    progress = { ...progress, projectName: 'MyApp', description: 'A cool app' }
    progress = setDecision(progress, 'frontend', { component: 'React', reasoning: 'Popular' })
    const output = serializeProgress(progress)
    expect(output).toContain('not yet decided')
    expect(output).toContain('React')
  })

  it('shows multiple extras', () => {
    let progress = createProgress()
    const choice1: ComponentChoice = { component: 'Sentry', reasoning: 'Error tracking' }
    const choice2: ComponentChoice = { component: 'Redis', reasoning: 'Caching' }
    progress = setDecision(progress, 'extras', choice1)
    progress = setDecision(progress, 'extras', choice2)
    const output = serializeProgress(progress)
    expect(output).toContain('Sentry')
    expect(output).toContain('Redis')
  })

  it('shows "none" or similar when extras is empty', () => {
    const output = serializeProgress(createProgress())
    // extras section should indicate nothing set
    expect(output).toMatch(/extras.*not yet decided|extras.*none/i)
  })

  it('returns a multi-line string', () => {
    const output = serializeProgress(createProgress())
    expect(output).toContain('\n')
  })
})

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
