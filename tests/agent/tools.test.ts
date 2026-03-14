import { describe, it, expect } from 'vitest'
import {
  conversationToolDefinitions,
  scaffoldToolDefinitions,
  executeConversationTool,
} from '../../src/agent/tools.js'
import { createProgress } from '../../src/agent/progress.js'

describe('conversationToolDefinitions', () => {
  it('returns all 3 tool names', () => {
    const tools = conversationToolDefinitions()
    const names = tools.map((t) => t.name)
    expect(names).toContain('set_decision')
    expect(names).toContain('set_project_info')
    expect(names).toContain('summarize_stage')
    expect(names).toHaveLength(3)
  })

  it('all tools have valid input_schema with type object', () => {
    const tools = conversationToolDefinitions()
    for (const tool of tools) {
      expect(tool.input_schema).toBeDefined()
      expect(tool.input_schema.type).toBe('object')
    }
  })

  it('set_decision has required fields: category, component, reasoning', () => {
    const tools = conversationToolDefinitions()
    const tool = tools.find((t) => t.name === 'set_decision')!
    expect(tool.input_schema.required).toContain('category')
    expect(tool.input_schema.required).toContain('component')
    expect(tool.input_schema.required).toContain('reasoning')
  })

  it('set_project_info has required fields: projectName, description', () => {
    const tools = conversationToolDefinitions()
    const tool = tools.find((t) => t.name === 'set_project_info')!
    expect(tool.input_schema.required).toContain('projectName')
    expect(tool.input_schema.required).toContain('description')
  })
})

describe('scaffoldToolDefinitions', () => {
  it('returns 2 tool names', () => {
    const tools = scaffoldToolDefinitions()
    expect(tools).toHaveLength(2)
  })

  it('includes run_scaffold and add_integration', () => {
    const tools = scaffoldToolDefinitions()
    const names = tools.map((t) => t.name)
    expect(names).toContain('run_scaffold')
    expect(names).toContain('add_integration')
  })

  it('all tools have valid input_schema with type object', () => {
    const tools = scaffoldToolDefinitions()
    for (const tool of tools) {
      expect(tool.input_schema).toBeDefined()
      expect(tool.input_schema.type).toBe('object')
    }
  })

  it('add_integration schema includes scripts property', () => {
    const tools = scaffoldToolDefinitions()
    const addIntegration = tools.find((t) => t.name === 'add_integration')!
    const properties = addIntegration.input_schema.properties as Record<string, unknown>
    expect(properties).toHaveProperty('scripts')
  })
})

describe('executeConversationTool', () => {
  const messages = []

  describe('set_decision', () => {
    it('records a decision and returns updated progress', () => {
      const progress = createProgress()
      const result = executeConversationTool(
        'set_decision',
        { category: 'frontend', component: 'React', reasoning: 'Popular' },
        progress,
        messages,
      )
      expect(result.progress.frontend).toEqual({ component: 'React', reasoning: 'Popular' })
      expect(result.response).toBeTruthy()
    })

    it('does not mutate original progress', () => {
      const progress = createProgress()
      executeConversationTool(
        'set_decision',
        { category: 'frontend', component: 'React', reasoning: 'Popular' },
        progress,
        messages,
      )
      expect(progress.frontend).toBeNull()
    })

    it('includes scaffoldTool and scaffoldArgs when provided', () => {
      const progress = createProgress()
      const result = executeConversationTool(
        'set_decision',
        {
          category: 'frontend',
          component: 'Next.js',
          reasoning: 'Full-stack',
          scaffoldTool: 'create-next-app',
          scaffoldArgs: ['--typescript'],
        },
        progress,
        messages,
      )
      expect(result.progress.frontend?.scaffoldTool).toBe('create-next-app')
      expect(result.progress.frontend?.scaffoldArgs).toEqual(['--typescript'])
    })

    it('appends extras rather than overwriting', () => {
      let progress = createProgress()
      const result1 = executeConversationTool(
        'set_decision',
        { category: 'extras', component: 'Sentry', reasoning: 'Error tracking' },
        progress,
        messages,
      )
      progress = result1.progress
      const result2 = executeConversationTool(
        'set_decision',
        { category: 'extras', component: 'Redis', reasoning: 'Caching' },
        progress,
        messages,
      )
      expect(result2.progress.extras).toHaveLength(2)
    })
  })

  describe('set_project_info', () => {
    it('sets projectName and description on progress', () => {
      const progress = createProgress()
      const result = executeConversationTool(
        'set_project_info',
        { projectName: 'MyApp', description: 'A cool app' },
        progress,
        messages,
      )
      expect(result.progress.projectName).toBe('MyApp')
      expect(result.progress.description).toBe('A cool app')
    })

    it('does not mutate original progress', () => {
      const progress = createProgress()
      executeConversationTool(
        'set_project_info',
        { projectName: 'MyApp', description: 'A cool app' },
        progress,
        messages,
      )
      expect(progress.projectName).toBeNull()
      expect(progress.description).toBeNull()
    })
  })

  describe('summarize_stage', () => {
    it('returns the summary as the response', () => {
      const progress = createProgress()
      const result = executeConversationTool(
        'summarize_stage',
        { category: 'frontend', summary: 'We chose React for the frontend.' },
        progress,
        messages,
      )
      expect(result.response).toBe('We chose React for the frontend.')
      expect(result.progress).toBe(progress)
    })
  })

  describe('unknown tool', () => {
    it('returns an error response for unknown tool names', () => {
      const progress = createProgress()
      const result = executeConversationTool('nonexistent_tool', {}, progress, messages)
      expect(result.response).toMatch(/unknown tool/i)
      expect(result.progress).toBe(progress)
    })
  })
})
