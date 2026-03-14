import { z } from 'zod'

export const stackDecisionSchema = z.object({
  frontend: z.string(),
  backend: z.string(),
  database: z.string(),
  auth: z.string(),
  deployment: z.string(),
  template: z.string(),
  modules: z.array(z.string()),
  reasoning: z.string(),
})

export type StackDecision = z.infer<typeof stackDecisionSchema>

export interface UserRequirements {
  projectName: string
  description: string
  scale: 'hobby' | 'startup' | 'enterprise'
  frontend: 'nextjs' | 'react-spa' | 'none'
  needsAuth: boolean
  needsPayments: boolean
}

export interface TemplateMetadata {
  name: string
  description: string
  tokens: string[]
  compatibleModules: string[]
}

export interface ModuleMetadata {
  name: string
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  env: string[]
  files: Record<string, string>
}
