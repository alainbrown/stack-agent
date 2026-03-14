import { Marked } from 'marked'
import { markedTerminal } from 'marked-terminal'
import type { ReadinessResult } from '../deploy/readiness.js'

// @ts-expect-error — marked-terminal types lag behind marked major versions
const marked = new Marked(markedTerminal())

export function renderMarkdown(text: string): string {
  return (marked.parse(text) as string).trimEnd()
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
  console.log('Local Development\n  ' + localSteps.join('\n  '))

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

  console.log(`Deployment (${readiness.platform})\n  ${lines.join('\n  ')}`)
}
