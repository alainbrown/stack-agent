import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createProgress, setDecision, type StackProgress } from '../../src/agent/progress.js'

// Mock the LLM client
vi.mock('../../src/llm/client.js', () => ({
  chat: vi.fn(),
  chatStream: vi.fn(),
}))

// Mock the CLI chat
vi.mock('../../src/cli/chat.js', () => ({
  renderAgentMessage: vi.fn(),
  getUserInput: vi.fn(),
  renderPlan: vi.fn(),
  renderError: vi.fn(),
  createSpinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  writeText: vi.fn(),
  writeLine: vi.fn(),
}))

// Mock scaffold modules
vi.mock('../../src/scaffold/base.js', () => ({
  runScaffold: vi.fn(),
}))

vi.mock('../../src/scaffold/integrate.js', () => ({
  writeIntegration: vi.fn(),
}))

import { runConversationLoop, runScaffoldLoop } from '../../src/agent/loop.js'
import { chat, chatStream } from '../../src/llm/client.js'
import {
  renderAgentMessage,
  getUserInput,
  renderPlan,
  renderError,
  createSpinner,
  writeText,
  writeLine,
} from '../../src/cli/chat.js'
import { runScaffold } from '../../src/scaffold/base.js'
import { writeIntegration } from '../../src/scaffold/integrate.js'

const mockChat = vi.mocked(chat)
const mockChatStream = vi.mocked(chatStream)
const mockGetUserInput = vi.mocked(getUserInput)
const mockRenderAgentMessage = vi.mocked(renderAgentMessage)
const mockRenderPlan = vi.mocked(renderPlan)
const mockRenderError = vi.mocked(renderError)
const mockRunScaffold = vi.mocked(runScaffold)
const mockWriteIntegration = vi.mocked(writeIntegration)

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

describe('runConversationLoop', () => {
  it('returns null when user cancels at initial input', async () => {
    mockGetUserInput.mockResolvedValueOnce(null)

    const result = await runConversationLoop()
    expect(result).toBeNull()
  })

  it('returns null when user cancels during conversation', async () => {
    // User provides initial input
    mockGetUserInput.mockResolvedValueOnce('Build me a web app')

    // Claude responds with text (no tool calls)
    mockStreamResponse({
      content: [{ type: 'text', text: 'What kind of frontend?' }],
    })

    // User cancels
    mockGetUserInput.mockResolvedValueOnce(null)

    const result = await runConversationLoop()
    expect(result).toBeNull()
  })

  it('simple conversation: text -> user -> tools -> present_plan -> returns progress', async () => {
    // User provides initial input
    mockGetUserInput.mockResolvedValueOnce('Build me a Next.js app')

    // First Claude response: text asking about the project
    mockStreamResponse({
      content: [{ type: 'text', text: 'Let me help you set up your project.' }],
    })

    // User responds
    mockGetUserInput.mockResolvedValueOnce('Sounds good, use Next.js and Postgres')

    // Second Claude response: set_decision for frontend + set_decision for database + present_plan
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
          name: 'set_decision',
          input: { category: 'frontend', component: 'Next.js', reasoning: 'User requested' },
        },
        {
          type: 'tool_use',
          id: 'tool_3',
          name: 'set_decision',
          input: { category: 'database', component: 'PostgreSQL', reasoning: 'User requested' },
        },
        {
          type: 'tool_use',
          id: 'tool_4',
          name: 'set_decision',
          input: { category: 'deployment', component: 'Vercel', reasoning: 'Works with Next.js' },
        },
        {
          type: 'tool_use',
          id: 'tool_5',
          name: 'present_plan',
          input: {},
        },
      ],
    })

    const result = await runConversationLoop()

    expect(result).not.toBeNull()
    expect(result!.projectName).toBe('my-app')
    expect(result!.frontend!.component).toBe('Next.js')
    expect(result!.database!.component).toBe('PostgreSQL')
    expect(result!.deployment!.component).toBe('Vercel')
    expect(mockRenderPlan).toHaveBeenCalled()
  })

  it('multi-tool turn: pushes ONE assistant message and ONE user message', async () => {
    // Initial response: Claude asks for project name
    mockStreamResponse({
      content: [{ type: 'text', text: 'What is your project name?' }],
    })
    mockGetUserInput.mockResolvedValueOnce('Build me an app')

    // Claude returns two set_decision calls + present_plan in one response
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
          name: 'set_decision',
          input: { category: 'database', component: 'MongoDB', reasoning: 'Flexible' },
        },
        {
          type: 'tool_use',
          id: 'tool_3',
          name: 'present_plan',
          input: {},
        },
      ],
    })

    const result = await runConversationLoop()

    // Verify the result has both decisions
    expect(result).not.toBeNull()
    expect(result!.frontend!.component).toBe('React')
    expect(result!.database!.component).toBe('MongoDB')

    // Inspect the messages sent in the last chatStream call
    const lastCallIdx = mockChatStream.mock.calls.length - 1
    const msgs = mockChatStream.mock.calls[lastCallIdx][0].messages

    // Find the assistant message with tool_use blocks
    const toolAssistantMsg = msgs.find(
      (m: any) => m.role === 'assistant' && Array.isArray(m.content) &&
        m.content.some((b: any) => b.type === 'tool_use')
    )
    // Find the user message with tool_result blocks
    const toolResultMsg = msgs.find(
      (m: any) => m.role === 'user' && Array.isArray(m.content) &&
        m.content.some((b: any) => b.type === 'tool_result')
    )

    // All 3 tool_use blocks should be in ONE assistant message
    expect(toolAssistantMsg).toBeDefined()
    const assistantContent = toolAssistantMsg!.content as any[]
    const toolUseCount = assistantContent.filter((b: any) => b.type === 'tool_use').length
    expect(toolUseCount).toBe(3)

    // All 3 tool_result blocks should be in ONE user message
    expect(toolResultMsg).toBeDefined()
    const userContent = toolResultMsg!.content as any[]
    const toolResultCount = userContent.filter((b: any) => b.type === 'tool_result').length
    expect(toolResultCount).toBe(3)
  })

  it('handles summarize_stage by replacing earlier messages with summary', async () => {
    // Initial response: Claude asks for project name
    mockStreamResponse({
      content: [{ type: 'text', text: 'What is your project name?' }],
    })
    mockGetUserInput.mockResolvedValueOnce('Build me an app')

    // First response: text
    mockStreamResponse({
      content: [{ type: 'text', text: 'Let me help you.' }],
    })

    mockGetUserInput.mockResolvedValueOnce('Use React')

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

    // After summarize, Claude returns more text
    mockStreamResponse({
      content: [{ type: 'text', text: 'Now let us pick a database.' }],
    })

    // User cancels
    mockGetUserInput.mockResolvedValueOnce(null)

    await runConversationLoop()

    // After summarize_stage, find the call where messages were replaced
    // The call after summarize should have the summary as the first message
    const allCalls = mockChatStream.mock.calls
    const callAfterSummarize = allCalls.find((call: any) => {
      const msgs = call[0].messages
      return msgs.length > 0 && msgs[0].role === 'assistant' &&
        msgs[0].content === 'User chose React for the frontend.'
    })

    expect(callAfterSummarize).toBeDefined()
    const msgs = callAfterSummarize![0].messages
    expect(msgs[0].role).toBe('assistant')
    expect(msgs[0].content).toBe('User chose React for the frontend.')
    expect(msgs[1].role).toBe('user')
    expect(msgs[1].content).toBe('[Continuing]')
  })

  it('passes live messages array to executeConversationTool', async () => {
    mockGetUserInput.mockResolvedValueOnce('Build me an app')

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
          name: 'present_plan',
          input: {},
        },
      ],
    })

    const result = await runConversationLoop()

    expect(result).not.toBeNull()
    expect(result!.projectName).toBe('test-app')
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
      scaffoldTool: 'create-next-app',
      scaffoldArgs: ['--typescript'],
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
      scaffoldTool: 'create-next-app',
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
    expect(mockRenderError).toHaveBeenCalledWith(
      expect.stringMatching(/tool call limit/i),
    )
  })

  it('sends error back as tool_result with is_error when tool throws', async () => {
    let progress = createProgress()
    progress.projectName = 'my-app'
    progress.frontend = {
      component: 'Next.js',
      reasoning: 'User chose',
      scaffoldTool: 'create-next-app',
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
      scaffoldTool: 'create-next-app',
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
