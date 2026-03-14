import { describe, it, expect } from 'vitest'
import { applyRecommendations } from '../../src/agent/recommend.js'
import { createProgress } from '../../src/agent/progress.js'
import { DEFAULT_STAGES } from '../../src/agent/stages.js'

describe('applyRecommendations', () => {
  it('applies recommendations to progress and stages', () => {
    const progress = createProgress()
    const stages = structuredClone(DEFAULT_STAGES)

    const recommendations = {
      frontend: { component: 'Next.js', reasoning: 'Best for SaaS' },
      backend: null,
      database: { component: 'Postgres', reasoning: 'Solid choice' },
      auth: { component: 'Clerk', reasoning: 'Easy auth' },
      payments: null,
      ai: null,
      deployment: { component: 'Vercel', reasoning: 'Native Next.js' },
    }

    const result = applyRecommendations(progress, stages, recommendations)

    // Recommended stages should be complete with summary
    expect(result.progress.frontend?.component).toBe('Next.js')
    expect(result.progress.database?.component).toBe('Postgres')
    expect(result.progress.auth?.component).toBe('Clerk')
    expect(result.progress.deployment?.component).toBe('Vercel')

    const frontend = stages.find((s) => s.id === 'frontend')!
    expect(frontend.status).toBe('complete')
    expect(frontend.summary).toBe('Next.js')
    expect(frontend.confirmed).toBe(false)

    // Null recommendations should be skipped
    const backend = stages.find((s) => s.id === 'backend')!
    expect(backend.status).toBe('skipped')
    expect(backend.confirmed).toBe(false)

    const payments = stages.find((s) => s.id === 'payments')!
    expect(payments.status).toBe('skipped')
  })

  it('handles empty recommendations gracefully', () => {
    const progress = createProgress()
    const stages = structuredClone(DEFAULT_STAGES)

    const result = applyRecommendations(progress, stages, {})

    // Nothing should change for category stages
    expect(result.progress.frontend).toBeNull()
    const frontend = stages.find((s) => s.id === 'frontend')!
    expect(frontend.status).toBe('pending')

    // Extras should be skipped by default
    const extras = stages.find((s) => s.id === 'extras')!
    expect(extras.status).toBe('skipped')
  })

  it('does not mark recommendations as confirmed', () => {
    const progress = createProgress()
    const stages = structuredClone(DEFAULT_STAGES)

    const recommendations = {
      frontend: { component: 'Next.js', reasoning: 'Best' },
    }

    applyRecommendations(progress, stages, recommendations)

    const frontend = stages.find((s) => s.id === 'frontend')!
    expect(frontend.confirmed).toBe(false)
  })
})
