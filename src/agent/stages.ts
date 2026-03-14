import type { ComponentChoice, StackProgress } from './progress.js'

export type StageStatus = 'pending' | 'complete' | 'skipped'

export interface StageEntry {
  id: string
  label: string
  status: StageStatus
  summary?: string
  confirmed?: boolean    // true = user reviewed/confirmed, false/undefined = LLM suggestion
  progressKeys: string[]
}

export interface InvalidationResult {
  clear: string[]
  add: StageEntry[]
  remove: string[]
}

export type InvalidationFn = (
  changedId: string,
  oldValue: ComponentChoice | null,
  newValue: ComponentChoice | null,
  progress: StackProgress,
  stages: StageEntry[],
) => Promise<InvalidationResult>

export const DEFAULT_STAGES: StageEntry[] = [
  { id: 'project_info', label: 'Project Info', status: 'pending', progressKeys: ['projectName', 'description'] },
  { id: 'frontend', label: 'Frontend', status: 'pending', progressKeys: ['frontend'] },
  { id: 'backend', label: 'Backend', status: 'pending', progressKeys: ['backend'] },
  { id: 'database', label: 'Database', status: 'pending', progressKeys: ['database'] },
  { id: 'auth', label: 'Auth', status: 'pending', progressKeys: ['auth'] },
  { id: 'payments', label: 'Payments', status: 'pending', progressKeys: ['payments'] },
  { id: 'ai', label: 'AI/LLM', status: 'pending', progressKeys: ['ai'] },
  { id: 'deployment', label: 'Deployment', status: 'pending', progressKeys: ['deployment'] },
  { id: 'extras', label: 'Extras', status: 'pending', progressKeys: ['extras'] },
]

export const STAGE_INSTRUCTIONS: Record<string, string> = {
  project_info: 'Ask for the project name and a brief description of what the user is building. Call set_project_info to record them.',
  frontend: 'Present 2-3 frontend framework options with trade-offs and your recommendation. Consider the project description when suggesting options.',
  backend: 'Present 2-3 backend/API options. Consider the chosen frontend — if it has built-in API routes (e.g., Next.js), that may be sufficient. If this stage is not needed, explain why and skip it.',
  database: 'Present 2-3 database options with ORM/query layer recommendations. Consider the chosen frontend and backend when suggesting options.',
  auth: 'Present 2-3 authentication options. If auth is not needed for this project, explain why and skip it.',
  payments: 'Present 2-3 payment processing options. If payments are not needed, explain why and skip it.',
  ai: 'Present 2-3 AI/LLM integration options. If AI is not needed, explain why and skip it.',
  deployment: 'Present 2-3 deployment platform options. Consider the chosen frontend and backend when suggesting options.',
  extras: 'Suggest any additional integrations that would benefit this project (analytics, email, monitoring, etc.). If none are needed, explain why and skip it.',
}
