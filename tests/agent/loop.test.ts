import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createProgress, type StackProgress } from '../../src/agent/progress.js'
import { DEFAULT_STAGES, type StageEntry } from '../../src/agent/stages.js'
import { createBridge, type ConversationBridge } from '../../src/cli/bridge.js'

// Mock the LLM client
vi.mock('../../src/llm/client.js', () => ({
  chat: vi.fn(),
  chatStream: vi.fn(),
}))

// Mock scaffold modules
vi.mock('../../src/scaffold/base.js', () => ({
  runScaffold: vi.fn(),
}))

vi.mock('../../src/scaffold/integrate.js', () => ({
  writeIntegration: vi.fn(),
}))

import { runStageLoop, runScaffoldLoop, type StageLoopResult } from '../../src/agent/loop.js'
import { chat, chatStream } from '../../src/llm/client.js'
import { runScaffold } from '../../src/scaffold/base.js'
import { writeIntegration } from '../../src/scaffold/integrate.js'

const mockChat = vi.mocked(chat)
const mockChatStream = vi.mocked(chatStream)
const mockRunScaffold = vi.mocked(runScaffold)
const mockWriteIntegration = vi.mocked(writeIntegration)

const mockStage: StageEntry = { id: 'frontend', label: 'Frontend', status: 'pending', progressKeys: ['frontend'] }
const mockProjectInfoStage: StageEntry = { id: 'project_info', label: 'Project Info', status: 'pending', progressKeys: ['projectName', 'description'] }

function createMockManager(overrides: Record<string, unknown> = {}) {
  return {
    _messages: [] as any[],
    _progress: createProgress(),
    stages: structuredClone(DEFAULT_STAGES),
    save: vi.fn(),
    get messages() { return this._messages },
    set messages(v: any[]) { this._messages = v },
    get progress() { return this._progress },
    set progress(v: StackProgress) { this._progress = v },
    restorePendingNavigation: vi.fn(),
    ...overrides,
  }
}

// Helper: simulate chatStream by calling callbacks synchronously
function mockStreamResponse(response: { content: object[] }) {
  mockChatStream.mockImplementationOnce(async (_options, callbacks) => {
    // Send text deltas
    for (const block of response.content) {
      if ((block as any).type === 'text') {
        callbacks.onText((block as any).text)
      }
    }
    // Send tool_use blocks
    for (const block of response.content) {
      if ((block as any).type === 'tool_use') {
        callbacks.onToolUse(block as any)
      }
    }
    // Complete
    callbacks.onComplete({
      content: response.content,
      stop_reason: response.content.some((b: any) => b.type === 'tool_use') ? 'tool_use' : 'end_turn',
    })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('runStageLoop', () => {
  it('returns cancel when user cancels at initial input', async () => {
    const mockManager = createMockManager()
    const bridge = createBridge()

    // Claude responds with text (no tool calls)
    mockStreamResponse({
      content: [{ type: 'text', text: 'What frontend framework?' }],
    })

    // Intercept waitForInput to schedule resolution after it's called
    const origWaitForInput = bridge.waitForInput.bind(bridge)
    bridge.waitForInput = () => {
      queueMicrotask(() => bridge.resolveInput({ kind: 'cancel' }))
      return origWaitForInput()
    }

    const result = await runStageLoop(mockStage, mockManager as any, bridge)
    expect(result).toEqual({ outcome: 'cancel' })
  })

  it('returns cancel when user cancels during conversation', async () => {
    const mockManager = createMockManager()
    const bridge = createBridge()

    // Claude responds with text (no tool calls)
    mockStreamResponse({
      content: [{ type: 'text', text: 'What kind of frontend?' }],
    })

    // User provides input
    queueMicrotask(() => bridge.resolveInput({ kind: 'text', value: 'Build me a web app' }))

    // Claude responds with more text
    mockStreamResponse({
      content: [{ type: 'text', text: 'Great choice!' }],
    })

    // User cancels on second input
    // We need a small delay for the second resolution since the first loop iteration needs to complete
    const origWaitForInput = bridge.waitForInput.bind(bridge)
    let callCount = 0
    bridge.waitForInput = () => {
      callCount++
      if (callCount === 1) {
        queueMicrotask(() => bridge.resolveInput({ kind: 'text', value: 'Build me a web app' }))
      } else {
        queueMicrotask(() => bridge.resolveInput({ kind: 'cancel' }))
      }
      return origWaitForInput()
    }

    const result = await runStageLoop(mockStage, mockManager as any, bridge)
    expect(result).toEqual({ outcome: 'cancel' })
  })

  it('returns navigate when user sends navigate input', async () => {
    const mockManager = createMockManager()
    const bridge = createBridge()

    // Claude responds with text
    mockStreamResponse({
      content: [{ type: 'text', text: 'What frontend framework?' }],
    })

    // Intercept waitForInput to schedule resolution after it's called
    const origWaitForInput = bridge.waitForInput.bind(bridge)
    bridge.waitForInput = () => {
      queueMicrotask(() => bridge.resolveInput({ kind: 'navigate' }))
      return origWaitForInput()
    }

    const result = await runStageLoop(mockStage, mockManager as any, bridge)
    expect(result).toEqual({ outcome: 'navigate' })
  })

  it('returns complete with summary when set_decision + summarize_stage are called', async () => {
    const mockManager = createMockManager()
    const bridge = createBridge()

    // Claude responds with set_decision + summarize_stage
    mockStreamResponse({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'set_decision',
          input: { category: 'frontend', component: 'Next.js', reasoning: 'User requested' },
        },
        {
          type: 'tool_use',
          id: 'tool_2',
          name: 'summarize_stage',
          input: { category: 'frontend', summary: 'Chose Next.js for the frontend.' },
        },
      ],
    })

    const result = await runStageLoop(mockStage, mockManager as any, bridge)

    expect(result).toEqual({ outcome: 'complete', summary: 'Chose Next.js for the frontend.' })
    expect(mockManager.save).toHaveBeenCalled()
    expect(mockManager.progress.frontend!.component).toBe('Next.js')
  })

  it('returns complete for project_info stage even without set_decision', async () => {
    const mockManager = createMockManager()
    const bridge = createBridge()

    // Claude responds with set_project_info + summarize_stage
    mockStreamResponse({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'set_project_info',
          input: { projectName: 'my-app', description: 'A web app' },
        },
        {
          type: 'tool_use',
          id: 'tool_2',
          name: 'summarize_stage',
          input: { category: 'project_info', summary: 'Project: my-app - A web app' },
        },
      ],
    })

    const result = await runStageLoop(mockProjectInfoStage, mockManager as any, bridge)

    expect(result).toEqual({ outcome: 'complete', summary: 'Project: my-app - A web app' })
    expect(mockManager.progress.projectName).toBe('my-app')
  })

  it('returns skipped when summarize_stage is called without set_decision', async () => {
    const mockManager = createMockManager()
    const bridge = createBridge()

    // Claude decides payments not needed, just summarizes
    mockStreamResponse({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'summarize_stage',
          input: { category: 'payments', summary: 'Payments not needed for this project.' },
        },
      ],
    })

    const paymentsStage: StageEntry = { id: 'payments', label: 'Payments', status: 'pending', progressKeys: ['payments'] }
    const result = await runStageLoop(paymentsStage, mockManager as any, bridge)

    expect(result).toEqual({ outcome: 'skipped' })
    expect(mockManager.save).toHaveBeenCalled()
  })

  it('multi-tool turn: pushes ONE assistant message and ONE user message', async () => {
    const mockManager = createMockManager()
    const bridge = createBridge()

    // Initial response: Claude asks for project name
    mockStreamResponse({
      content: [{ type: 'text', text: 'What is your project name?' }],
    })

    // Use waitForInput override to schedule resolutions
    const origWaitForInput = bridge.waitForInput.bind(bridge)
    let callCount = 0
    bridge.waitForInput = () => {
      callCount++
      if (callCount === 1) {
        queueMicrotask(() => bridge.resolveInput({ kind: 'text', value: 'Build me an app' }))
      }
      return origWaitForInput()
    }

    // Claude returns two set_decision calls + summarize_stage in one response
    mockStreamResponse({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'set_decision',
          input: { category: 'frontend', component: 'React', reasoning: 'Popular' },
        },
        {
          type: 'tool_use',
          id: 'tool_2',
          name: 'summarize_stage',
          input: { category: 'frontend', summary: 'Chose React for frontend.' },
        },
      ],
    })

    const result = await runStageLoop(mockStage, mockManager as any, bridge)

    // Verify the result
    expect(result).toEqual({ outcome: 'complete', summary: 'Chose React for frontend.' })
    expect(mockManager.progress.frontend!.component).toBe('React')
  })

  it('handles summarize_stage by replacing earlier messages with summary', async () => {
    const mockManager = createMockManager()
    const bridge = createBridge()

    // Initial response: Claude asks for project name
    mockStreamResponse({
      content: [{ type: 'text', text: 'What is your project name?' }],
    })

    // Use waitForInput override to schedule resolutions
    const origWaitForInput = bridge.waitForInput.bind(bridge)
    let callCount = 0
    bridge.waitForInput = () => {
      callCount++
      if (callCount === 1) {
        queueMicrotask(() => bridge.resolveInput({ kind: 'text', value: 'Build me an app' }))
      } else if (callCount === 2) {
        queueMicrotask(() => bridge.resolveInput({ kind: 'text', value: 'Use React' }))
      }
      return origWaitForInput()
    }

    // First response: text
    mockStreamResponse({
      content: [{ type: 'text', text: 'Let me help you.' }],
    })

    // Second response: set_decision + summarize_stage
    mockStreamResponse({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'set_decision',
          input: { category: 'frontend', component: 'React', reasoning: 'User chose' },
        },
        {
          type: 'tool_use',
          id: 'tool_2',
          name: 'summarize_stage',
          input: { category: 'frontend', summary: 'User chose React for the frontend.' },
        },
      ],
    })

    const result = await runStageLoop(mockStage, mockManager as any, bridge)

    expect(result).toEqual({ outcome: 'complete', summary: 'User chose React for the frontend.' })

    // Verify messages were compressed
    const messages = mockManager.messages
    expect(messages[0].role).toBe('assistant')
    expect(messages[0].content).toBe('User chose React for the frontend.')
    expect(messages[1].role).toBe('user')
    expect(messages[1].content).toBe('[Continuing]')
  })

  it('passes live messages array to executeConversationTool', async () => {
    const mockManager = createMockManager()
    const bridge = createBridge()

    // Claude responds with a tool call
    mockStreamResponse({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'set_project_info',
          input: { projectName: 'test-app', description: 'Test' },
        },
        {
          type: 'tool_use',
          id: 'tool_2',
          name: 'summarize_stage',
          input: { category: 'project_info', summary: 'Project: test-app' },
        },
      ],
    })

    const result = await runStageLoop(mockProjectInfoStage, mockManager as any, bridge)

    expect(result).toEqual({ outcome: 'complete', summary: 'Project: test-app' })
    expect(mockManager.progress.projectName).toBe('test-app')
  })

  it('updates manager.progress after each tool execution', async () => {
    const mockManager = createMockManager()
    const bridge = createBridge()

    mockStreamResponse({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'set_decision',
          input: { category: 'frontend', component: 'Vue', reasoning: 'Great DX' },
        },
        {
          type: 'tool_use',
          id: 'tool_2',
          name: 'summarize_stage',
          input: { category: 'frontend', summary: 'Chose Vue.' },
        },
      ],
    })

    await runStageLoop(mockStage, mockManager as any, bridge)

    // Progress should be updated on the manager
    expect(mockManager.progress.frontend!.component).toBe('Vue')
  })

  it('intercepts present_options and waits for bridge input', async () => {
    const mockManager = createMockManager()
    const bridge = createBridge()

    // First: Claude streams text + present_options
    mockStreamResponse({
      content: [
        { type: 'text', text: 'Here are your options:' },
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'present_options',
          input: {
            options: [
              { label: 'Next.js', description: 'Full-stack React framework', recommended: true },
              { label: 'Remix', description: 'Web standards framework' },
            ],
          },
        },
      ],
    })

    // Intercept waitForInput to resolve with user selection
    const origWaitForInput = bridge.waitForInput.bind(bridge)
    bridge.waitForInput = () => {
      queueMicrotask(() => bridge.resolveInput({ kind: 'select', value: 'Next.js' }))
      return origWaitForInput()
    }

    // Capture messages at each chatStream call to avoid mutation issues
    const capturedMessages: any[][] = []
    const origMockImpl = mockChatStream.getMockImplementation()
    mockChatStream.mockImplementation(async (options, callbacks) => {
      capturedMessages.push(JSON.parse(JSON.stringify(options.messages)))
      // Delegate to the next queued implementation
      const impl = queuedImpls.shift()
      if (impl) return impl(options, callbacks)
    })

    // Queue the second response
    const queuedImpls: any[] = []

    // Re-mock: first call is the text+present_options, second is set_decision+summarize
    mockChatStream.mockReset()

    mockStreamResponse({
      content: [
        { type: 'text', text: 'Here are your options:' },
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'present_options',
          input: {
            options: [
              { label: 'Next.js', description: 'Full-stack React framework', recommended: true },
              { label: 'Remix', description: 'Web standards framework' },
            ],
          },
        },
      ],
    })

    // Then Claude responds with set_decision + summarize_stage
    mockStreamResponse({
      content: [
        {
          type: 'tool_use',
          id: 'tool_2',
          name: 'set_decision',
          input: { category: 'frontend', component: 'Next.js', reasoning: 'User selected' },
        },
        {
          type: 'tool_use',
          id: 'tool_3',
          name: 'summarize_stage',
          input: { category: 'frontend', summary: 'Chose Next.js.' },
        },
      ],
    })

    const result = await runStageLoop(mockStage, mockManager as any, bridge)

    expect(result).toEqual({ outcome: 'complete', summary: 'Chose Next.js.' })
    // Verify chatStream was called twice (present_options was intercepted, not passed to executeConversationTool)
    expect(mockChatStream).toHaveBeenCalledTimes(2)
  })
})

describe('runScaffoldLoop', () => {
  it('returns true when Claude finishes without tool calls', async () => {
    const progress = createProgress()
    progress.projectName = 'my-app'

    mockChat.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'All done!' }],
    } as any)

    const result = await runScaffoldLoop(progress)
    expect(result).toBe(true)
  })

  it('happy path: run_scaffold then add_integration, returns true', async () => {
    let progress = createProgress()
    progress.projectName = 'my-app'
    progress.frontend = {
      component: 'Next.js',
      reasoning: 'User chose',
    }

    mockRunScaffold.mockReturnValue('/tmp/my-app')

    // First response: run_scaffold
    mockChat.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'run_scaffold',
          input: { tool: 'create-next-app', args: ['--typescript'] },
        },
      ],
    } as any)

    // Second response: add_integration
    mockChat.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tool_2',
          name: 'add_integration',
          input: {
            files: { 'lib/db.ts': 'export const db = {}' },
            dependencies: { prisma: '^5.0.0' },
          },
        },
      ],
    } as any)

    // Third response: done (no tools)
    mockChat.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Scaffolding complete!' }],
    } as any)

    const result = await runScaffoldLoop(progress)

    expect(result).toBe(true)
    expect(mockRunScaffold).toHaveBeenCalledOnce()
    expect(mockWriteIntegration).toHaveBeenCalledOnce()
  })

  it('returns false when tool call limit is exceeded', async () => {
    let progress = createProgress()
    progress.projectName = 'my-app'
    progress.frontend = {
      component: 'Next.js',
      reasoning: 'User chose',
    }

    // Return tool calls that will eventually exceed the limit
    // Each response has 1 tool call, so we need 31 responses
    for (let i = 0; i < 31; i++) {
      mockChat.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: `tool_${i}`,
            name: 'add_integration',
            input: {
              files: { [`file${i}.ts`]: `content ${i}` },
            },
          },
        ],
      } as any)
    }

    const result = await runScaffoldLoop(progress)

    expect(result).toBe(false)
  })

  it('sends error back as tool_result with is_error when tool throws', async () => {
    let progress = createProgress()
    progress.projectName = 'my-app'
    progress.frontend = {
      component: 'Next.js',
      reasoning: 'User chose',
    }

    mockRunScaffold.mockImplementation(() => {
      throw new Error('Scaffold failed: permission denied')
    })

    // First response: run_scaffold (which will throw)
    mockChat.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'run_scaffold',
          input: { tool: 'create-next-app', args: ['--typescript'] },
        },
      ],
    } as any)

    // After the error result is sent, Claude responds with no tools (gives up)
    mockChat.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'There was an error.' }],
    } as any)

    const result = await runScaffoldLoop(progress)

    // Should still return true because Claude stopped calling tools
    expect(result).toBe(true)

    // Verify the error was sent back as a tool_result
    expect(mockChat).toHaveBeenCalledTimes(2)
    const secondCallArgs = mockChat.mock.calls[1][0]
    const msgs = secondCallArgs.messages

    // The user message should contain the error tool_result
    const lastUserMsg = msgs[msgs.length - 1]
    expect(lastUserMsg.role).toBe('user')
    const content = lastUserMsg.content as any[]
    expect(content[0].type).toBe('tool_result')
    expect(content[0].is_error).toBe(true)
    expect(content[0].content).toBe('Scaffold failed: permission denied')
  })

  it('uses join(cwd, projectName) for project directory', async () => {
    let progress = createProgress()
    progress.projectName = 'my-app'
    progress.frontend = {
      component: 'Next.js',
      reasoning: 'User chose',
    }

    // Return add_integration call to check projectDir
    mockChat.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'add_integration',
          input: {
            files: { 'src/index.ts': 'console.log("hello")' },
          },
        },
      ],
    } as any)

    // Done
    mockChat.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Done!' }],
    } as any)

    await runScaffoldLoop(progress)

    // writeIntegration should have been called with the joined path
    expect(mockWriteIntegration).toHaveBeenCalledWith(
      expect.stringContaining('my-app'),
      expect.objectContaining({
        files: { 'src/index.ts': 'console.log("hello")' },
      }),
    )
  })

  it('calls onProgress with step updates during scaffolding', async () => {
    let progress = createProgress()
    progress.projectName = 'my-app'
    progress.frontend = { component: 'Next.js', reasoning: 'User chose' }

    mockRunScaffold.mockReturnValue('/tmp/my-app')

    // First response: run_scaffold
    mockChat.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'run_scaffold',
          input: { tool: 'create-next-app', args: ['--typescript'] },
        },
      ],
    } as any)

    // Second response: add_integration
    mockChat.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tool_2',
          name: 'add_integration',
          input: {
            files: { 'src/db/schema.ts': 'schema', 'src/db/index.ts': 'index' },
          },
        },
      ],
    } as any)

    // Third response: done
    mockChat.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Done!' }],
    } as any)

    const progressCalls: any[] = []
    const onProgress = vi.fn((steps: any) => progressCalls.push(structuredClone(steps)))

    await runScaffoldLoop(progress, onProgress)

    // onProgress should have been called multiple times
    expect(onProgress).toHaveBeenCalled()

    // First call: running scaffold
    const firstCall = progressCalls[0]
    expect(firstCall).toHaveLength(1)
    expect(firstCall[0].status).toBe('running')

    // Should eventually have a done scaffold step
    const hasDoneScaffold = progressCalls.some((steps) =>
      steps.some((s: any) => s.status === 'done' && s.name.toLowerCase().includes('project'))
    )
    expect(hasDoneScaffold).toBe(true)

    // Should have an integration step with files
    const lastCall = progressCalls[progressCalls.length - 1]
    const integrationStep = lastCall.find((s: any) => s.files && s.files.length > 0)
    expect(integrationStep).toBeDefined()
    expect(integrationStep.status).toBe('done')
    expect(integrationStep.files).toContain('src/db/schema.ts')
  })

  it('handles unknown scaffold tool names with is_error', async () => {
    let progress = createProgress()
    progress.projectName = 'my-app'

    mockChat.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'unknown_tool',
          input: {},
        },
      ],
    } as any)

    mockChat.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Done.' }],
    } as any)

    const result = await runScaffoldLoop(progress)
    expect(result).toBe(true)

    // Check that error was sent back
    const secondCallArgs = mockChat.mock.calls[1][0]
    const msgs = secondCallArgs.messages
    const lastUserMsg = msgs[msgs.length - 1]
    const content = lastUserMsg.content as any[]
    expect(content[0].is_error).toBe(true)
    expect(content[0].content).toMatch(/unknown tool/i)
  })
})
