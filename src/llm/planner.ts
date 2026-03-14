import { callClaude } from './client.js'
import {
  stackDecisionSchema,
  type StackDecision,
  type UserRequirements,
  type TemplateMetadata,
  type ModuleMetadata,
} from './schemas.js'

function buildSystemPrompt(
  templates: TemplateMetadata[],
  modules: ModuleMetadata[],
): string {
  return `You are a software architect. Given a developer's project requirements, choose the best architecture from the available templates and modules.

Available templates:
${JSON.stringify(templates, null, 2)}

Available modules:
${JSON.stringify(modules, null, 2)}

Return a JSON object matching this exact schema:
{
  "frontend": "string - framework name",
  "backend": "string - runtime/framework",
  "database": "string - database name",
  "auth": "string - auth provider",
  "deployment": "string - hosting platform",
  "template": "string - must be one of the available template names",
  "modules": ["string[] - must be from available module names, only include if relevant"],
  "reasoning": "string - 1-2 sentences explaining why this stack was chosen"
}

Return ONLY the JSON object. No markdown, no explanation outside the JSON.`
}

function buildUserMessage(requirements: UserRequirements): string {
  return `Project: ${requirements.projectName}
Description: ${requirements.description}
Scale: ${requirements.scale}
Frontend preference: ${requirements.frontend}
Needs authentication: ${requirements.needsAuth}
Needs payments: ${requirements.needsPayments}`
}

function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (fenceMatch) return fenceMatch[1].trim()
  return text.trim()
}

function validateCompatibility(
  decision: StackDecision,
  templates: TemplateMetadata[],
): void {
  const template = templates.find((t) => t.name === decision.template)
  if (!template) {
    throw new Error(`Template "${decision.template}" not found in available templates`)
  }

  for (const mod of decision.modules) {
    if (!template.compatibleModules.includes(mod)) {
      throw new Error(
        `Module "${mod}" is not compatible with template "${decision.template}". ` +
        `Compatible modules: ${template.compatibleModules.join(', ')}`
      )
    }
  }
}

export async function planStack(
  requirements: UserRequirements,
  templates: TemplateMetadata[],
  modules: ModuleMetadata[],
): Promise<StackDecision> {
  const systemPrompt = buildSystemPrompt(templates, modules)
  const userMessage = buildUserMessage(requirements)

  let lastError: Error | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt =
      attempt === 0
        ? userMessage
        : `${userMessage}\n\nPrevious attempt failed with error: ${lastError?.message}\nPlease fix the issue and return valid JSON.`

    try {
      const raw = await callClaude(systemPrompt, prompt)
      const json = extractJson(raw)
      const parsed = JSON.parse(json)
      const decision = stackDecisionSchema.parse(parsed)
      validateCompatibility(decision, templates)
      return decision
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  throw new Error(`Failed to get valid stack decision after 2 attempts: ${lastError?.message}`)
}
