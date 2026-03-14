import { describe, it, expect } from 'vitest'
import { buildConversationPrompt, buildScaffoldPrompt } from '../../src/agent/system-prompt.js'
import { createProgress, setDecision } from '../../src/agent/progress.js'
import type { StackProgress } from '../../src/agent/progress.js'
import { DEFAULT_STAGES } from '../../src/agent/stages.js'

function makeFullProgress(): StackProgress {
  let p = createProgress()
  p = { ...p, projectName: 'MyApp', description: 'A test application' }
  p = setDecision(p, 'frontend', { component: 'Next.js', reasoning: 'Full-stack' })
  p = setDecision(p, 'database', { component: 'PostgreSQL', reasoning: 'Reliable' })
  p = setDecision(p, 'deployment', { component: 'Vercel', reasoning: 'Easy deploys' })
  return p
}

describe('buildConversationPrompt', () => {
  it('includes "senior software architect" persona', () => {
    const prompt = buildConversationPrompt(createProgress(), 'project_info', DEFAULT_STAGES)
    expect(prompt).toContain('senior software architect')
  })

  it('includes current progress state', () => {
    const progress = makeFullProgress()
    const prompt = buildConversationPrompt(progress, 'project_info', DEFAULT_STAGES)
    expect(prompt).toContain('MyApp')
    expect(prompt).toContain('A test application')
    expect(prompt).toContain('Next.js')
    expect(prompt).toContain('PostgreSQL')
    expect(prompt).toContain('Vercel')
  })

  it('includes set_decision tool name', () => {
    const prompt = buildConversationPrompt(createProgress(), 'project_info', DEFAULT_STAGES)
    expect(prompt).toContain('set_decision')
  })

  it('includes Current Stage section', () => {
    const prompt = buildConversationPrompt(createProgress(), 'project_info', DEFAULT_STAGES)
    expect(prompt).toContain('Current Stage:')
  })

  it('mentions presenting 2-3 options per category', () => {
    const prompt = buildConversationPrompt(createProgress(), 'frontend', DEFAULT_STAGES)
    expect(prompt).toMatch(/2.?3.*options|options.*2.?3/i)
  })

  it('mentions summarize_stage for stage completion', () => {
    const prompt = buildConversationPrompt(createProgress(), 'project_info', DEFAULT_STAGES)
    expect(prompt).toContain('summarize_stage')
  })
})

describe('buildScaffoldPrompt', () => {
  it('includes run_scaffold tool name', () => {
    const prompt = buildScaffoldPrompt(makeFullProgress())
    expect(prompt).toContain('run_scaffold')
  })

  it('includes add_integration tool name', () => {
    const prompt = buildScaffoldPrompt(makeFullProgress())
    expect(prompt).toContain('add_integration')
  })

  it('includes project info from progress', () => {
    const progress = makeFullProgress()
    const prompt = buildScaffoldPrompt(progress)
    expect(prompt).toContain('MyApp')
    expect(prompt).toContain('A test application')
    expect(prompt).toContain('Next.js')
  })

  it('instructs to call run_scaffold before add_integration', () => {
    const prompt = buildScaffoldPrompt(makeFullProgress())
    const runIndex = prompt.indexOf('run_scaffold')
    const addIndex = prompt.indexOf('add_integration')
    expect(runIndex).toBeGreaterThanOrEqual(0)
    expect(addIndex).toBeGreaterThanOrEqual(0)
    expect(runIndex).toBeLessThan(addIndex)
  })

  it('instructs to use MCP tools for current docs', () => {
    const prompt = buildScaffoldPrompt(makeFullProgress())
    expect(prompt.toLowerCase()).toContain('mcp')
  })

  it('instructs to generate complete working code, not stubs', () => {
    const prompt = buildScaffoldPrompt(makeFullProgress())
    expect(prompt.toLowerCase()).toMatch(/complete|working|production/)
    expect(prompt.toLowerCase()).toMatch(/no stubs|no.*placeholder|production-ready/)
  })

  it('instructs Claude to generate deploy.sh', () => {
    const prompt = buildScaffoldPrompt(makeFullProgress())
    expect(prompt).toContain('deploy.sh')
    expect(prompt).toContain('set -euo pipefail')
  })

  it('instructs Claude to generate README.md', () => {
    const prompt = buildScaffoldPrompt(makeFullProgress())
    expect(prompt).toContain('README.md')
    expect(prompt).toContain('Environment variables')
    expect(prompt).toContain('.env')
  })

  it('instructs Claude to use scripts property for npm run deploy', () => {
    const prompt = buildScaffoldPrompt(makeFullProgress())
    expect(prompt).toContain('scripts')
    expect(prompt).toContain('npm run deploy')
  })
})
