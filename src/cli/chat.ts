import * as p from '@clack/prompts'
import { Marked } from 'marked'
import TerminalRenderer from 'marked-terminal'

const marked = new Marked(TerminalRenderer())

function renderMarkdown(text: string): string {
  return (marked.parse(text) as string).trimEnd()
}

export function intro(): void {
  p.intro('create-stack')
}

export function outro(message: string): void {
  p.outro(message)
}

export function renderAgentMessage(text: string): void {
  p.log.message(renderMarkdown(text))
}

export function renderError(text: string): void {
  p.log.error(text)
}

export function renderWarning(text: string): void {
  p.log.warn(text)
}

export function renderStep(text: string): void {
  p.log.step(text)
}

export function renderPlan(plan: string): void {
  p.log.info(renderMarkdown(plan))
}

export async function getUserInput(message?: string, placeholder?: string): Promise<string | null> {
  const result = await p.text({
    message: message ?? '›',
    placeholder: placeholder ?? 'Type your message...',
  })

  if (p.isCancel(result)) {
    return null
  }

  return result as string
}

export function createSpinner() {
  return p.spinner()
}
