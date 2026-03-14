import { describe, it, expect, vi, beforeEach } from 'vitest'
import { planStack } from '../../src/llm/planner.js'
import type { UserRequirements, TemplateMetadata, ModuleMetadata } from '../../src/llm/schemas.js'

// Mock the client module
vi.mock('../../src/llm/client.js', () => ({
  callClaude: vi.fn(),
}))

import { callClaude } from '../../src/llm/client.js'
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
