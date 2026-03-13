import Anthropic from '@anthropic-ai/sdk'
import type { Tool } from '@anthropic-ai/sdk/resources/messages.js'

export interface ChatOptions {
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string | object[] }>
  tools: Tool[]
  maxTokens: number
  mcpServers?: Record<string, { url: string; apiKey?: string }>
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is not set. Please set it before running create-stack.',
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
        // @ts-expect-error: mcp_servers is a beta param not yet in SDK types
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
