import Anthropic from '@anthropic-ai/sdk'
import type { Tool, MessageParam } from '@anthropic-ai/sdk/resources/messages.js'
import { createLogger } from '../util/logger.js'

const log = createLogger('llm')

function summarizeMessages(messages: MessageParam[]): string {
  return `${messages.length} messages, last: ${messages.at(-1)?.role ?? 'none'}`
}

function withMessageCaching(messages: MessageParam[]): MessageParam[] {
  if (messages.length < 2) return messages

  // Mark the second-to-last message with cache_control on its last content block.
  // Everything up to and including that message will be cached.
  const cached = messages.map((m, i) => {
    if (i !== messages.length - 2) return m

    const content = m.content
    if (typeof content === 'string') {
      return { ...m, content: [{ type: 'text' as const, text: content, cache_control: { type: 'ephemeral' as const } }] }
    }
    if (Array.isArray(content)) {
      const blocks = [...content]
      const last = blocks[blocks.length - 1]
      if (last) {
        blocks[blocks.length - 1] = { ...last, cache_control: { type: 'ephemeral' as const } } as typeof last
      }
      return { ...m, content: blocks }
    }
    return m
  })

  return cached
}

export interface ChatOptions {
  system: string
  messages: MessageParam[]
  tools?: Tool[]
  maxTokens: number
  mcpServers?: Record<string, { url: string; apiKey?: string }>
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is not set. Please set it before running stack-agent.',
    )
  }
  return new Anthropic({ apiKey })
}

let _client: Anthropic | null = null

function client(): Anthropic {
  if (!_client) {
    _client = getClient()
  }
  return _client
}

import type { Message } from '@anthropic-ai/sdk/resources/messages.js'

export async function chat(options: ChatOptions): Promise<Message> {
  const { system, messages, tools, maxTokens, mcpServers } = options

  log.debug({ maxTokens, toolCount: tools?.length ?? 0, messages: summarizeMessages(messages) }, 'chat request')

  let response: Message

  if (mcpServers && Object.keys(mcpServers).length > 0) {
    const mcpServerList = Object.entries(mcpServers).map(([name, config]) => ({
      type: 'url' as const,
      name,
      url: config.url,
      ...(config.apiKey !== undefined && {
        authorization_token: config.apiKey,
      }),
    }))

    response = await client().beta.messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system,
        messages,
        ...(tools && tools.length > 0 && { tools }),
        mcp_servers: mcpServerList,
      },
      {
        headers: {
          'anthropic-beta': 'mcp-client-2025-11-20',
        },
      },
    ) as Message
  } else {
    response = await client().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: withMessageCaching(messages),
      ...(tools && tools.length > 0 && { tools }),
    })
  }

  log.info({
    stopReason: response.stop_reason,
    contentBlocks: response.content.length,
    usage: response.usage,
  }, 'chat response')
  log.debug({ content: response.content }, 'chat response content')

  return response
}

export interface StreamCallbacks {
  onText: (delta: string) => void
  onToolUse: (block: { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }) => void
  onComplete: (response: { content: object[]; stop_reason: string }) => void
}

export async function chatStream(
  options: ChatOptions,
  callbacks: StreamCallbacks,
): Promise<void> {
  const { system, messages, tools, maxTokens } = options

  log.debug({ maxTokens, toolCount: tools?.length ?? 0, messages: summarizeMessages(messages) }, 'chatStream request')

  const stream = client().messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: withMessageCaching(messages),
    ...(tools && tools.length > 0 && { tools }),
  })

  stream.on('text', (text) => {
    callbacks.onText(text)
  })

  const finalMessage = await stream.finalMessage()

  log.info({
    stopReason: finalMessage.stop_reason,
    contentBlocks: finalMessage.content.length,
    usage: finalMessage.usage,
  }, 'chatStream response')
  log.debug({ content: finalMessage.content }, 'chatStream response content')

  // Report tool_use blocks
  for (const block of finalMessage.content) {
    if (block.type === 'tool_use') {
      callbacks.onToolUse(block as { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> })
    }
  }

  callbacks.onComplete({
    content: finalMessage.content as object[],
    stop_reason: finalMessage.stop_reason ?? 'end_turn',
  })
}
