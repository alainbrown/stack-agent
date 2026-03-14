import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js'
import type { StageEntry } from './stages.js'

export interface ComponentChoice {
  component: string
  reasoning: string
  scaffoldTool?: string
  scaffoldArgs?: string[]
}

export interface StackProgress {
  projectName: string | null
  description: string | null
  frontend: ComponentChoice | null
  backend: ComponentChoice | null
  database: ComponentChoice | null
  auth: ComponentChoice | null
  payments: ComponentChoice | null
  ai: ComponentChoice | null
  deployment: ComponentChoice | null
  extras: ComponentChoice[]
}

export type ProgressCategory =
  | 'frontend'
  | 'backend'
  | 'database'
  | 'auth'
  | 'payments'
  | 'ai'
  | 'deployment'
  | 'extras'

export function createProgress(): StackProgress {
  return {
    projectName: null,
    description: null,
    frontend: null,
    backend: null,
    database: null,
    auth: null,
    payments: null,
    ai: null,
    deployment: null,
    extras: [],
  }
}

export function setDecision(
  progress: StackProgress,
  category: ProgressCategory,
  choice: ComponentChoice,
): StackProgress {
  if (category === 'extras') {
    return { ...progress, extras: [...progress.extras, choice] }
  }
  return { ...progress, [category]: choice }
}

export function clearDecision(
  progress: StackProgress,
  category: ProgressCategory,
): StackProgress {
  if (category === 'extras') {
    return { ...progress, extras: [] }
  }
  return { ...progress, [category]: null }
}

export function clearProjectInfo(progress: StackProgress): StackProgress {
  return { ...progress, projectName: null, description: null }
}

export function isComplete(progress: StackProgress): boolean {
  return (
    progress.projectName !== null &&
    progress.description !== null &&
    progress.frontend !== null &&
    progress.database !== null &&
    progress.deployment !== null
  )
}

function formatChoice(choice: ComponentChoice | null): string {
  if (choice === null) return 'not yet decided'
  return choice.component
}

export function serializeProgress(progress: StackProgress): string {
  const lines: string[] = [
    `Project Name: ${progress.projectName ?? 'not yet decided'}`,
    `Description: ${progress.description ?? 'not yet decided'}`,
    `Frontend: ${formatChoice(progress.frontend)}`,
    `Backend: ${formatChoice(progress.backend)}`,
    `Database: ${formatChoice(progress.database)}`,
    `Auth: ${formatChoice(progress.auth)}`,
    `Payments: ${formatChoice(progress.payments)}`,
    `AI/LLM: ${formatChoice(progress.ai)}`,
    `Deployment: ${formatChoice(progress.deployment)}`,
    `Extras: ${progress.extras.length > 0 ? progress.extras.map((e) => e.component).join(', ') : 'not yet decided'}`,
  ]
  return lines.join('\n')
}

export interface SavedSession {
  version: 1
  createdAt: string
  updatedAt: string
  progress: StackProgress
  stages: StageEntry[]
  messages: MessageParam[]
}

export function serializeSession(session: SavedSession): string {
  return JSON.stringify(session, null, 2)
}

export function deserializeSession(json: string): SavedSession | null {
  try {
    const data = JSON.parse(json)
    if (data.version !== 1) return null
    if (!data.progress || !Array.isArray(data.stages) || !Array.isArray(data.messages)) return null
    return data as SavedSession
  } catch {
    return null
  }
}
