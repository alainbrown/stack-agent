import * as p from '@clack/prompts'
import { Marked } from 'marked'
import { markedTerminal } from 'marked-terminal'
import type { ReadinessResult } from '../deploy/readiness.js'
import type { StageEntry } from '../agent/stages.js'
import { isComplete, serializeProgress, type StackProgress } from '../agent/progress.js'
import type { SavedSession } from '../agent/progress.js'

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

export type InputResult =
  | { kind: 'text'; value: string }
  | { kind: 'cancel' }
  | { kind: 'navigate' }

let inputCallCount = 0

export async function getUserInput(message?: string, placeholder?: string): Promise<InputResult> {
  inputCallCount++
  const hint = inputCallCount <= 3 ? '  \u2190 stage list' : ''

  const preKey = await listenForPreKey()
  if (preKey === 'navigate') {
    return { kind: 'navigate' }
  }

  const result = await p.text({
    message: (message ?? '\u203a') + hint,
    placeholder: placeholder ?? 'Type your message...',
    initialValue: preKey ?? undefined,
  })

  if (p.isCancel(result)) {
    return { kind: 'cancel' }
  }

  return { kind: 'text', value: result as string }
}

function listenForPreKey(): Promise<string | 'navigate' | null> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve(null)
      return
    }

    const wasRaw = process.stdin.isRaw
    process.stdin.setRawMode(true)
    process.stdin.resume()

    const onData = (data: Buffer) => {
      process.stdin.removeListener('data', onData)
      process.stdin.setRawMode(wasRaw ?? false)
      process.stdin.pause()

      const seq = data.toString()
      if (seq === '\x1b[D') {
        resolve('navigate')
      } else if (seq === '\x03') {
        resolve(null)
        process.emit('SIGINT' as any)
      } else {
        resolve(seq)
      }
    }

    process.stdin.on('data', onData)
  })
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

export type StageListResult =
  | { kind: 'select'; stageId: string }
  | { kind: 'review' }
  | { kind: 'cancel' }

export async function renderStageList(
  stages: StageEntry[],
  currentStageId: string | null,
  progress: StackProgress,
): Promise<StageListResult> {
  while (true) {
    const options: { value: string; label: string; hint?: string }[] = []

    for (const stage of stages) {
      let prefix: string
      if (stage.status === 'complete') prefix = '\u2713'
      else if (stage.status === 'skipped') prefix = '\u2013'
      else if (stage.id === currentStageId) prefix = '\u25cf'
      else prefix = '\u25cb'

      const hint = stage.summary ?? (stage.id === currentStageId ? 'current' : undefined)
      options.push({
        value: stage.id,
        label: `${prefix} ${stage.label}`,
        hint,
      })
    }

    const canReview = isComplete(progress)
    if (canReview) {
      options.push({
        value: '__review__',
        label: '\u2605 Review & Build',
      })
    } else {
      const remaining = requiredRemaining(progress)
      options.push({
        value: '__review__',
        label: '\u2605 Review & Build',
        hint: `${remaining} required decision${remaining !== 1 ? 's' : ''} remaining`,
      })
    }

    const result = await p.select({
      message: 'Stack Progress',
      options,
    })

    if (p.isCancel(result)) {
      return { kind: 'cancel' }
    }

    if (result === '__review__') {
      if (!canReview) {
        p.log.warn('Complete the required decisions first (frontend, database, deployment).')
        continue
      }
      return { kind: 'review' }
    }

    return { kind: 'select', stageId: result as string }
  }
}

function requiredRemaining(progress: StackProgress): number {
  let count = 0
  if (!progress.projectName) count++
  if (!progress.description) count++
  if (!progress.frontend) count++
  if (!progress.database) count++
  if (!progress.deployment) count++
  return count
}

export type ResumeResult = 'resume' | 'fresh' | 'cancel'

export async function renderResumePrompt(session: SavedSession): Promise<ResumeResult> {
  const lines: string[] = []

  for (const stage of session.stages) {
    if (stage.status === 'complete') {
      lines.push(`  \u2713 ${stage.label.padEnd(16)} \u2014 ${stage.summary ?? 'done'}`)
    }
  }

  const pending = session.stages.filter((s) => s.status === 'pending')
  if (pending.length > 0) {
    lines.push(`  \u25cb ${pending.map((s) => s.label).join(', ')}`)
  }

  const updatedAt = new Date(session.updatedAt)
  const ago = formatTimeAgo(updatedAt)
  lines.push('')
  lines.push(`  Last updated: ${ago}`)

  p.log.info(`Found saved progress for "${session.progress.projectName ?? 'unnamed project'}"\n${lines.join('\n')}`)

  const result = await p.select({
    message: 'Resume or start fresh?',
    options: [
      { value: 'resume', label: 'Resume', hint: 'continue where you left off' },
      { value: 'fresh', label: 'Start fresh', hint: 'discard saved progress' },
    ],
  })

  if (p.isCancel(result)) return 'cancel'
  return result as ResumeResult
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

export type ReviewResult = 'confirm' | 'adjust' | 'cancel'

export async function renderReviewScreen(progress: StackProgress): Promise<ReviewResult> {
  renderPlan(serializeProgress(progress))

  const result = await p.select({
    message: 'Ready to build?',
    options: [
      { value: 'confirm', label: 'Confirm & build' },
      { value: 'adjust', label: 'Go back and adjust' },
      { value: 'cancel', label: 'Cancel', hint: 'progress saved for next time' },
    ],
  })

  if (p.isCancel(result)) return 'cancel'
  return result as ReviewResult
}
