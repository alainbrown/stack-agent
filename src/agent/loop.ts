import { join } from 'node:path'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js'
import { chat, chatStream } from '../llm/client.js'
import type { ConversationBridge } from '../cli/bridge.js'
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
  serializeProgress,
  type StackProgress,
} from './progress.js'
import type { StageEntry } from './stages.js'
import type { StageManager } from './stage-manager.js'
import { runScaffold } from '../scaffold/base.js'
import { writeIntegration } from '../scaffold/integrate.js'

export type StageLoopResult =
  | { outcome: 'complete'; summary: string }
  | { outcome: 'skipped' }
  | { outcome: 'navigate' }
  | { outcome: 'cancel' }

export async function runStageLoop(
  stage: StageEntry,
  manager: StageManager,
  bridge: ConversationBridge,
  mcpServers?: Record<string, { url: string; apiKey?: string }>,
): Promise<StageLoopResult> {
  const messages = manager.messages
  let progress = manager.progress

  // Kick off the conversation if this is the first stage
  if (messages.length === 0) {
    messages.push({ role: 'user', content: 'I want to start a new project.' })
  }

  let hasCalledSetDecision = false

  while (true) {
    const system = buildConversationPrompt(progress, stage.id, manager.stages)

    let contentBlocks: object[] = []
    const collectedToolUse: Array<{ type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }> = []
    let hasText = false
    let fullText = ''

    bridge.onSpinnerStart()

    await chatStream(
      {
        system,
        messages,
        tools: conversationToolDefinitions(),
        maxTokens: 4096,
        mcpServers,
      },
      {
        onText: (delta) => {
          hasText = true
          fullText += delta
          bridge.onStreamText(delta)
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
      bridge.onStreamText('\n')
    }

    const toolUseBlocks = collectedToolUse

    if (toolUseBlocks.length > 0) {
      messages.push({ role: 'assistant', content: contentBlocks as MessageParam['content'] })

      const toolResults: object[] = []
      let hasSummarizeStage = false
      let summarizeSummary = ''
      let madeDecision = false

      for (const block of toolUseBlocks) {
        const toolBlock = block as {
          type: 'tool_use'
          id: string
          name: string
          input: Record<string, unknown>
        }

        // Intercept present_options before executeConversationTool
        if (toolBlock.name === 'present_options') {
          const options = toolBlock.input.options as Array<{ label: string; description: string; recommended?: boolean }>
          bridge.onPresentOptions(options)
          const input = await bridge.waitForInput()
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: input.kind === 'select'
              ? `User selected: ${input.value}`
              : input.kind === 'text'
                ? `User wrote: ${input.value}`
                : 'User cancelled.',
          })
          if (input.kind === 'cancel') {
            return { outcome: 'cancel' }
          }
          continue
        }

        const result = executeConversationTool(
          toolBlock.name,
          toolBlock.input,
          progress,
          messages,
        )

        progress = result.progress
        manager.progress = progress

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: result.response,
        })

        if (toolBlock.name === 'set_decision' || toolBlock.name === 'set_project_info') {
          madeDecision = true
          hasCalledSetDecision = true
        }

        if (toolBlock.name === 'summarize_stage') {
          hasSummarizeStage = true
          summarizeSummary = toolBlock.input.summary as string
        }
      }

      messages.push({ role: 'user', content: toolResults as MessageParam['content'] })

      // Save if progress changed
      if (madeDecision || hasSummarizeStage) {
        manager.save()
      }

      // Handle summarize_stage: compress messages
      if (hasSummarizeStage) {
        const lastAssistant = messages[messages.length - 2]
        const lastUser = messages[messages.length - 1]

        messages.length = 0
        messages.push({ role: 'assistant', content: summarizeSummary })
        messages.push({ role: 'user', content: '[Continuing]' })
        messages.push(lastAssistant)
        messages.push(lastUser)

        manager.messages = messages
      }

      // Check stage completion
      if (hasSummarizeStage) {
        if (hasCalledSetDecision || stage.id === 'project_info') {
          return { outcome: 'complete', summary: summarizeSummary }
        }
        return { outcome: 'skipped' }
      }

      continue
    }

    // No tool use — get user input
    bridge.onStreamEnd(fullText)
    const inputResult = await bridge.waitForInput()

    if (inputResult.kind === 'cancel') return { outcome: 'cancel' }
    if (inputResult.kind === 'navigate') return { outcome: 'navigate' }

    messages.push({
      role: 'assistant',
      content: contentBlocks as MessageParam['content'],
    })
    messages.push({ role: 'user', content: inputResult.value })
  }
}

function createSimpleSpinner() {
  return {
    start: (msg: string) => process.stdout.write(`  ${msg}...`),
    stop: (msg: string) => process.stdout.write(` ${msg}\n`),
  }
}

export async function runScaffoldLoop(
  progress: StackProgress,
  mcpServers?: Record<string, { url: string; apiKey?: string }>,
): Promise<boolean> {
  const messages: MessageParam[] = []
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
      messages: messages,
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
    messages.push({ role: 'assistant', content: contentBlocks as MessageParam['content'] })

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
        console.error(`Tool call limit exceeded (${maxToolCalls}). Stopping scaffold loop.`)
        return false
      }

      const spinner = createSimpleSpinner()

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
            scripts: toolBlock.input.scripts as
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
    messages.push({ role: 'user', content: toolResults as MessageParam['content'] })
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
