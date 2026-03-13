import { describe, it, expect } from 'vitest'
import { stackDecisionSchema } from '../../src/llm/schemas.js'

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
