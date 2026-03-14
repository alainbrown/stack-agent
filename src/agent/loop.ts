import { join } from 'node:path'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js'
import { chat, chatStream } from '../llm/client.js'
import {
  renderAgentMessage,
  getUserInput,
  renderPlan,
  renderError,
  createSpinner,
  writeText,
  writeLine,
} from '../cli/chat.js'
import {
  conversationToolDefinitions,
  scaffoldToolDefinitions,
  executeConversationTool,
} from './tools.js'
import {
  buildConversationPrompt,
  buildScaffoldPrompt,
} from './system-prompt.js'
import {
  createProgress,
  serializeProgress,
  type StackProgress,
} from './progress.js'
import { runScaffold } from '../scaffold/base.js'
import { writeIntegration } from '../scaffold/integrate.js'

interface Message {
  role: 'user' | 'assistant'
  content: string | object[]
}

export async function runConversationLoop(
  mcpServers?: Record<string, { url: string; apiKey?: string }>,
): Promise<StackProgress | null> {
  let progress = createProgress()
  const messages: Message[] = []

  // Kick off the conversation — Claude will ask for project name first
  messages.push({ role: 'user', content: 'I want to start a new project.' })

  while (true) {
    const system = buildConversationPrompt(progress)

    // Stream the response — text deltas render in real-time
    let contentBlocks: object[] = []
    const collectedToolUse: Array<{ type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }> = []
    let hasText = false

    await chatStream(
      {
        system,
        messages: messages as MessageParam[],
        tools: conversationToolDefinitions(),
        maxTokens: 4096,
        mcpServers,
      },
      {
        onText: (delta) => {
          if (!hasText) {
            hasText = true
            writeText('\n')
          }
          writeText(delta)
        },
        onToolUse: (block) => {
          collectedToolUse.push(block)
        },
        onComplete: (response) => {
          contentBlocks = response.content
        },
      },
    )

    if (hasText) {
      writeLine()
      writeLine()
    }

    const toolUseBlocks = collectedToolUse

    if (toolUseBlocks.length > 0) {
      // CRITICAL: Push ALL content blocks as a SINGLE assistant message
      messages.push({ role: 'assistant', content: contentBlocks as object[] })

      // Execute all tools and collect results
      const toolResults: object[] = []
      let hasPresentPlan = false
      let hasSummarizeStage = false
      let summarizeSummary = ''

      for (const block of toolUseBlocks) {
        const toolBlock = block as {
          type: 'tool_use'
          id: string
          name: string
          input: Record<string, unknown>
        }

        const result = executeConversationTool(
          toolBlock.name,
          toolBlock.input,
          progress,
          messages as MessageParam[],
        )

        progress = result.progress

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: result.response,
        })

        if (result.signal === 'present_plan') {
          hasPresentPlan = true
        }

        if (toolBlock.name === 'summarize_stage') {
          hasSummarizeStage = true
          summarizeSummary = toolBlock.input.summary as string
        }
      }

      // CRITICAL: Push ALL tool_result blocks as a SINGLE user message
      messages.push({ role: 'user', content: toolResults })

      // Handle summarize_stage: replace earlier conversation messages with summary
      if (hasSummarizeStage) {
        // Keep the system message context, but replace the conversation
        // turns before the last assistant+user pair with a concise summary.
        // The last two messages are: assistant (with tool calls) + user (with tool results)
        // We replace everything before those with the summary.
        const lastAssistant = messages[messages.length - 2]
        const lastUser = messages[messages.length - 1]

        messages.length = 0
        messages.push({
          role: 'assistant',
          content: summarizeSummary,
        })
        messages.push({
          role: 'user',
          content: '[Continuing]',
        })
        messages.push(lastAssistant)
        messages.push(lastUser)
      }

      // Handle present_plan signal
      if (hasPresentPlan) {
        renderPlan(serializeProgress(progress))
        return progress
      }

      // Continue the loop - Claude may want to send more messages
      continue
    }

    // No tool use blocks - just text. Get user input to continue conversation.
    const userInput = await getUserInput('Your response')
    if (userInput === null) return null

    // Push assistant message (text only)
    messages.push({
      role: 'assistant',
      content: contentBlocks as object[],
    })
    messages.push({ role: 'user', content: userInput })
  }
}

export async function runScaffoldLoop(
  progress: StackProgress,
  mcpServers?: Record<string, { url: string; apiKey?: string }>,
): Promise<boolean> {
  const messages: Message[] = []
  const system = buildScaffoldPrompt(progress)
  const cwd = process.cwd()
  const projectName = progress.projectName!
  const projectDir = join(cwd, projectName)

  let toolCallCount = 0
  const maxToolCalls = 30

  // Initial message to kick off the scaffold
  messages.push({
    role: 'user',
    content: 'Begin scaffolding the project according to the plan.',
  })

  while (true) {
    const response = await chat({
      system,
      messages: messages as MessageParam[],
      tools: scaffoldToolDefinitions(),
      maxTokens: 16384,
      mcpServers,
    })

    const contentBlocks = response.content

    const toolUseBlocks = contentBlocks.filter(
      (b: { type: string }) => b.type === 'tool_use',
    )

    // If no tool calls, Claude is done
    if (toolUseBlocks.length === 0) {
      return true
    }

    // Push assistant message with all content blocks
    messages.push({ role: 'assistant', content: contentBlocks as object[] })

    // Execute all tool calls
    const toolResults: object[] = []

    for (const block of toolUseBlocks) {
      const toolBlock = block as {
        type: 'tool_use'
        id: string
        name: string
        input: Record<string, unknown>
      }

      toolCallCount++
      if (toolCallCount > maxToolCalls) {
        renderError(`Tool call limit exceeded (${maxToolCalls}). Stopping scaffold loop.`)
        return false
      }

      const spinner = createSpinner()

      try {
        if (toolBlock.name === 'run_scaffold') {
          spinner.start(`Running scaffold: ${toolBlock.input.tool as string}`)

          // Find the approved scaffold tool from progress
          const approvedTool = findApprovedScaffoldTool(progress)

          const outputDir = runScaffold(
            toolBlock.input.tool as string,
            toolBlock.input.args as string[],
            approvedTool,
            projectName,
            cwd,
          )

          spinner.stop(`Scaffold complete: ${outputDir}`)

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: `Scaffold completed. Project created at ${outputDir}`,
          })
        } else if (toolBlock.name === 'add_integration') {
          const integrationDesc = Object.keys(
            (toolBlock.input.files as Record<string, string>) ?? {},
          ).join(', ')
          spinner.start(`Adding integration: ${integrationDesc}`)

          writeIntegration(projectDir, {
            files: (toolBlock.input.files as Record<string, string>) ?? {},
            dependencies: toolBlock.input.dependencies as
              | Record<string, string>
              | undefined,
            devDependencies: toolBlock.input.devDependencies as
              | Record<string, string>
              | undefined,
            envVars: toolBlock.input.envVars as string[] | undefined,
          })

          spinner.stop('Integration added')

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: 'Integration written successfully.',
          })
        } else {
          spinner.stop(`Unknown tool: ${toolBlock.name}`)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: `Unknown tool: "${toolBlock.name}".`,
            is_error: true,
          })
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err)
        spinner.stop(`Error: ${errorMessage}`)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: errorMessage,
          is_error: true,
        })
      }
    }

    // Push all tool results as a single user message
    messages.push({ role: 'user', content: toolResults })
  }
}

function findApprovedScaffoldTool(progress: StackProgress): string {
  // Check all categories for a scaffoldTool
  const categories = [
    progress.frontend,
    progress.backend,
    progress.database,
    progress.auth,
    progress.payments,
    progress.deployment,
    ...progress.extras,
  ]

  for (const choice of categories) {
    if (choice?.scaffoldTool) {
      return choice.scaffoldTool
    }
  }

  return ''
}
