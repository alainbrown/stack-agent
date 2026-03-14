import Anthropic from '@anthropic-ai/sdk'
import type { Tool, MessageParam } from '@anthropic-ai/sdk/resources/messages.js'

export interface ChatOptions {
  system: string
  messages: MessageParam[]
  tools: Tool[]
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

export async function chat(options: ChatOptions) {
  const { system, messages, tools, maxTokens, mcpServers } = options

  if (mcpServers && Object.keys(mcpServers).length > 0) {
    const mcpServerList = Object.entries(mcpServers).map(([name, config]) => ({
      type: 'url' as const,
      name,
      url: config.url,
      ...(config.apiKey !== undefined && {
        authorization_token: config.apiKey,
      }),
    }))

    return client().beta.messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system,
        messages,
        tools,
        mcp_servers: mcpServerList,
      },
      {
        headers: {
          'anthropic-beta': 'mcp-client-2025-11-20',
        },
      },
    )
  }

  return client().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system,
    messages,
    tools,
  })
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

  const stream = client().messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system,
    messages,
    tools,
  })

  stream.on('text', (text) => {
    callbacks.onText(text)
  })

  const finalMessage = await stream.finalMessage()

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
