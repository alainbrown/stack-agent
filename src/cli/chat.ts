import * as p from '@clack/prompts'
import { Marked } from 'marked'
import { markedTerminal } from 'marked-terminal'
import type { ReadinessResult } from '../deploy/readiness.js'

// @ts-expect-error — marked-terminal types lag behind marked major versions
const marked = new Marked(markedTerminal())

function renderMarkdown(text: string): string {
  return (marked.parse(text) as string).trimEnd()
}

export function intro(): void {
  p.intro('stack-agent')
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

export function writeText(text: string): void {
  process.stdout.write(text)
}

export function writeLine(): void {
  process.stdout.write('\n')
}

export function renderPostScaffold(
  projectName: string,
  readiness: ReadinessResult | null,
): void {
  const localSteps = [
    `cd ${projectName}`,
    'cp .env.example .env   # fill in your values',
    'npm install',
    'npm run dev',
  ]
  p.log.step('Local Development\n  ' + localSteps.join('\n  '))

  if (readiness === null) return

  const lines: string[] = []

  if (readiness.cliInstalled && readiness.authenticated === true) {
    lines.push('\u2713 Ready to deploy')
    lines.push(`\u2192 ${readiness.deployCmd}`)
  } else if (!readiness.cliInstalled) {
    lines.push(`\u2717 ${readiness.cliName || 'CLI'} not found`)
    if (readiness.installCmd) lines.push(`  Install: ${readiness.installCmd}`)
    if (readiness.authCmd) lines.push(`  Then: ${readiness.authCmd}`)
    lines.push(`  Then: ${readiness.deployCmd}`)
  } else {
    // CLI installed but not authenticated (or indeterminate)
    lines.push(`\u2713 ${readiness.cliName} CLI installed`)
    if (readiness.authenticated === false) {
      lines.push(`\u2717 Not authenticated`)
      lines.push(`  Run: ${readiness.authCmd}`)
    } else {
      lines.push('? Authentication status unknown')
      lines.push(`  Try: ${readiness.authCmd}`)
    }
    lines.push(`  Then: ${readiness.deployCmd}`)
  }

  lines.push('')
  if (readiness.envVarCmd) {
    lines.push(`\u2139 Set production env vars with: ${readiness.envVarCmd}`)
  }
  lines.push('\u2139 See README.md \u2192 Deployment for full instructions')

  p.log.info(`Deployment (${readiness.platform})\n  ${lines.join('\n  ')}`)
}
