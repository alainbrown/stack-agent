import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createProgress, setDecision, type StackProgress } from '../../src/agent/progress.js'

// Mock the LLM client
vi.mock('../../src/llm/client.js', () => ({
  chat: vi.fn(),
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
}))

// Mock scaffold modules
vi.mock('../../src/scaffold/base.js', () => ({
  runScaffold: vi.fn(),
}))

vi.mock('../../src/scaffold/integrate.js', () => ({
  writeIntegration: vi.fn(),
}))

import { runConversationLoop, runScaffoldLoop } from '../../src/agent/loop.js'
import { chat } from '../../src/llm/client.js'
import {
  renderAgentMessage,
  getUserInput,
  renderPlan,
  renderError,
  createSpinner,
} from '../../src/cli/chat.js'
import { runScaffold } from '../../src/scaffold/base.js'
import { writeIntegration } from '../../src/scaffold/integrate.js'

const mockChat = vi.mocked(chat)
const mockGetUserInput = vi.mocked(getUserInput)
const mockRenderAgentMessage = vi.mocked(renderAgentMessage)
const mockRenderPlan = vi.mocked(renderPlan)
const mockRenderError = vi.mocked(renderError)
const mockRunScaffold = vi.mocked(runScaffold)
const mockWriteIntegration = vi.mocked(writeIntegration)

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
    mockChat.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'What kind of frontend?' }],
    } as any)

    // User cancels
    mockGetUserInput.mockResolvedValueOnce(null)

    const result = await runConversationLoop()
    expect(result).toBeNull()
    expect(mockRenderAgentMessage).toHaveBeenCalledWith('What kind of frontend?')
  })

  it('simple conversation: text -> user -> tools -> present_plan -> returns progress', async () => {
    // User provides initial input
    mockGetUserInput.mockResolvedValueOnce('Build me a Next.js app')

    // First Claude response: text asking about the project
    mockChat.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Let me help you set up your project.' }],
    } as any)

    // User responds
    mockGetUserInput.mockResolvedValueOnce('Sounds good, use Next.js and Postgres')

    // Second Claude response: set_decision for frontend + set_decision for database + present_plan
    mockChat.mockResolvedValueOnce({
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
    } as any)

    const result = await runConversationLoop()

    expect(result).not.toBeNull()
    expect(result!.projectName).toBe('my-app')
    expect(result!.frontend!.component).toBe('Next.js')
    expect(result!.database!.component).toBe('PostgreSQL')
    expect(result!.deployment!.component).toBe('Vercel')
    expect(mockRenderPlan).toHaveBeenCalled()
  })

  it('multi-tool turn: pushes ONE assistant message and ONE user message', async () => {
    mockGetUserInput.mockResolvedValueOnce('Build me an app')

    // Claude returns two set_decision calls in one response
    mockChat.mockResolvedValueOnce({
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
      ],
    } as any)

    // Next: Claude responds with text
    mockChat.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Great choices! What about deployment?' }],
    } as any)

    // User cancels to end the loop
    mockGetUserInput.mockResolvedValueOnce(null)

    await runConversationLoop()

    // Check the second call to chat to inspect messages
    expect(mockChat).toHaveBeenCalledTimes(2)
    const secondCallArgs = mockChat.mock.calls[1][0]
    const msgs = secondCallArgs.messages

    // Messages should be:
    // [0] user: initial input
    // [1] assistant: { content: [tool_use, tool_use] } (ONE assistant message)
    // [2] user: { content: [tool_result, tool_result] } (ONE user message)
    expect(msgs).toHaveLength(3)
    expect(msgs[0].role).toBe('user')
    expect(msgs[1].role).toBe('assistant')
    expect(msgs[2].role).toBe('user')

    // The assistant message contains both tool_use blocks
    const assistantContent = msgs[1].content as object[]
    expect(assistantContent).toHaveLength(2)
    expect((assistantContent[0] as any).type).toBe('tool_use')
    expect((assistantContent[1] as any).type).toBe('tool_use')

    // The user message contains both tool_result blocks
    const userContent = msgs[2].content as object[]
    expect(userContent).toHaveLength(2)
    expect((userContent[0] as any).type).toBe('tool_result')
    expect((userContent[1] as any).type).toBe('tool_result')
  })

  it('handles summarize_stage by replacing earlier messages with summary', async () => {
    mockGetUserInput.mockResolvedValueOnce('Build me an app')

    // First response: text
    mockChat.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Let me help you.' }],
    } as any)

    mockGetUserInput.mockResolvedValueOnce('Use React')

    // Second response: set_decision + summarize_stage
    mockChat.mockResolvedValueOnce({
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
    } as any)

    // After summarize, Claude returns more text
    mockChat.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Now let us pick a database.' }],
    } as any)

    // User cancels
    mockGetUserInput.mockResolvedValueOnce(null)

    await runConversationLoop()

    // Check the third call to chat — messages should have been replaced
    expect(mockChat).toHaveBeenCalledTimes(3)
    const thirdCallArgs = mockChat.mock.calls[2][0]
    const msgs = thirdCallArgs.messages

    // After summarize_stage, the messages are replaced with:
    // [0] assistant: summary text
    // [1] user: "[Continuing]"
    // [2] assistant: (the tool call message)
    // [3] user: (tool results)
    expect(msgs).toHaveLength(4)
    expect(msgs[0].role).toBe('assistant')
    expect(msgs[0].content).toBe('User chose React for the frontend.')
    expect(msgs[1].role).toBe('user')
    expect(msgs[1].content).toBe('[Continuing]')
  })

  it('passes live messages array to executeConversationTool', async () => {
    mockGetUserInput.mockResolvedValueOnce('Build me an app')

    // Claude responds with a tool call
    mockChat.mockResolvedValueOnce({
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
    } as any)

    // We need to spy on executeConversationTool to check messages
    // Since it's imported internally, we'll verify indirectly through the result
    const result = await runConversationLoop()

    // If the messages were passed correctly, executeConversationTool would
    // have been called and the progress should be updated
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
