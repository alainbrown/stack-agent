import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (client) return client

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error(
      'Error: ANTHROPIC_API_KEY environment variable is not set.\n' +
      'Get your API key at https://console.anthropic.com/settings/keys\n' +
      'Then run: export ANTHROPIC_API_KEY=your-key-here'
    )
    process.exit(1)
  }

  client = new Anthropic({ apiKey })
  return client
}

export async function callClaude(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const anthropic = getClient()

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  return textBlock.text
}
