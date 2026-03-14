import { chat } from '../llm/client.js'
import { createLogger } from '../util/logger.js'

const log = createLogger('recommend')
import {
  setDecision,
  type StackProgress,
  type ProgressCategory,
} from './progress.js'
import type { StageEntry } from './stages.js'

const RECOMMEND_PROMPT = `You are a senior software architect. Based on the project description, recommend a complete technology stack.

For each category, provide your recommendation as a JSON object. If a category is not needed for this project, set it to null.

Respond with ONLY a JSON object in this exact format:
{
  "frontend": { "component": "Next.js", "reasoning": "Best for SaaS with built-in API routes" },
  "backend": null,
  "database": { "component": "Postgres + Drizzle", "reasoning": "Relational with great TypeScript support" },
  "auth": { "component": "Clerk", "reasoning": "Drop-in auth with good DX" },
  "payments": null,
  "ai": null,
  "deployment": { "component": "Vercel", "reasoning": "Native Next.js support" },
  "extras": null
}

Rules:
- Be opinionated. Pick the best option, not the most popular.
- Set categories to null if they are genuinely not needed for this project.
- Keep reasoning under 80 characters.
- component names should be max 30 characters.`

interface Recommendation {
  component: string
  reasoning: string
}

type RecommendationResult = Record<string, Recommendation | null>

export async function getRecommendations(
  projectName: string,
  description: string,
): Promise<RecommendationResult> {
  try {
    const response = await chat({
      system: RECOMMEND_PROMPT,
      messages: [{
        role: 'user',
        content: `Project: "${projectName}"\nDescription: ${description}`,
      }],
      maxTokens: 1024,
    })

    const text = response.content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b) => (b as unknown as { type: string; text: string }).text)
      .join('')

    log.info({ rawLength: text.length }, 'received recommendation response')
    log.debug({ rawText: text }, 'recommendation raw text')

    // Strip markdown code fences if present
    const jsonStr = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
    const parsed = JSON.parse(jsonStr) as RecommendationResult

    const categories = Object.keys(parsed).filter((k) => parsed[k] !== null)
    log.info({ recommended: categories, skipped: Object.keys(parsed).filter((k) => parsed[k] === null) }, 'parsed recommendations')

    return parsed
  } catch (err) {
    log.error({ err }, 'recommendation pass failed')
    return {}
  }
}

export function applyRecommendations(
  progress: StackProgress,
  stages: StageEntry[],
  recommendations: RecommendationResult,
): { progress: StackProgress; stages: StageEntry[] } {
  let updated = { ...progress }

  const categories: ProgressCategory[] = [
    'frontend', 'backend', 'database', 'auth', 'payments', 'ai', 'deployment',
  ]

  for (const category of categories) {
    // Only touch stages that the LLM explicitly included in its response
    if (!(category in recommendations)) continue

    const rec = recommendations[category]
    const stage = stages.find((s) => s.id === category)
    if (!stage) continue

    if (rec) {
      updated = setDecision(updated, category, {
        component: rec.component,
        reasoning: rec.reasoning,
      })
      stage.status = 'complete'
      stage.summary = rec.component
      stage.confirmed = false // LLM suggestion, not user confirmed
    } else {
      // LLM explicitly says not needed
      stage.status = 'skipped'
      stage.summary = 'not needed'
      stage.confirmed = false
    }
  }

  // Handle extras — skip by default
  const extrasStage = stages.find((s) => s.id === 'extras')
  if (extrasStage && !recommendations['extras']) {
    extrasStage.status = 'skipped'
    extrasStage.summary = 'none suggested'
    extrasStage.confirmed = false
  }

  return { progress: updated, stages }
}
