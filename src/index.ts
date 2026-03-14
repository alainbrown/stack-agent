import * as p from '@clack/prompts'
import { intro, outro, renderError, renderPostScaffold } from './cli/chat.js'
import {
  renderResumePrompt,
  renderStageList,
  renderReviewScreen,
} from './cli/chat.js'
import { checkDeployReadiness } from './deploy/readiness.js'
import { runStageLoop } from './agent/loop.js'
import { runScaffoldLoop } from './agent/loop.js'
import { StageManager } from './agent/stage-manager.js'
import { serializeProgress } from './agent/progress.js'
import { chat } from './llm/client.js'
import type { InvalidationFn } from './agent/stages.js'

const INVALIDATION_PROMPT = `You are evaluating whether changing a technology stack decision affects other decisions.

The user changed their decision. Given the current state of all decisions, determine which OTHER decisions (if any) are now invalid and should be reconsidered.

Rules:
- Only include stages that are GENUINELY affected by the change.
- Only affect stages AFTER the changed stage in the ordered list.
- Consider whether each decision was dependent on the changed decision.
- If nothing needs to change, return empty arrays.

Examples:

Changed frontend from Next.js to Astro (backend was "Next.js API routes"):
{"clear":["backend"],"add":[],"remove":[]}
Reason: Backend was tied to Next.js. If backend had been "Express" (independent), it would NOT be cleared.

Changed auth from Clerk to Auth.js:
{"clear":[],"add":[],"remove":[]}
Reason: Swapping auth providers doesn't affect other decisions.

Changed frontend from Next.js to static HTML:
{"clear":["backend","auth","ai"],"add":[],"remove":["payments"]}
Reason: Static site fundamentally changes what's viable.

Respond with ONLY a JSON object: {"clear": [...], "add": [...], "remove": [...]}
`

function createInvalidationFn(): InvalidationFn {
  return async (changedId, oldValue, newValue, progress, stages) => {
    const stageList = stages.map((s) => `${s.id} (${s.status}): ${s.summary ?? 'no decision'}`).join('\n')

    const userPrompt = `The user changed "${changedId}" from "${oldValue?.component ?? 'none'}" to "${newValue?.component ?? 'none'}".

Current decisions:
${serializeProgress(progress)}

Current stages:
${stageList}

What needs to change?`

    try {
      const response = await chat({
        system: INVALIDATION_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 1024,
      })

      const text = response.content
        .filter((b: { type: string }) => b.type === 'text')
        .map((b) => (b as unknown as { type: string; text: string }).text)
        .join('')

      const parsed = JSON.parse(text)
      return {
        clear: Array.isArray(parsed.clear) ? parsed.clear : [],
        add: Array.isArray(parsed.add) ? parsed.add : [],
        remove: Array.isArray(parsed.remove) ? parsed.remove : [],
      }
    } catch {
      return { clear: [], add: [], remove: [] }
    }
  }
}

async function main() {
  intro()

  const cwd = process.cwd()
  const invalidationFn = createInvalidationFn()

  // Check for existing session
  let manager: StageManager
  const existingSession = StageManager.detect(cwd)

  if (existingSession) {
    const resumeResult = await renderResumePrompt(existingSession)
    if (resumeResult === 'cancel') {
      outro('See you next time.')
      return
    }
    if (resumeResult === 'fresh') {
      const tempManager = StageManager.resume(cwd)
      tempManager?.cleanup()
      manager = StageManager.start(cwd, invalidationFn)
    } else {
      const resumed = StageManager.resume(cwd, invalidationFn)
      if (!resumed) {
        p.log.warn('Could not restore session. Starting fresh.')
        manager = StageManager.start(cwd, invalidationFn)
      } else {
        manager = resumed
      }
    }
  } else {
    manager = StageManager.start(cwd, invalidationFn)
  }

  // Phase 1: Stage-driven conversation loop
  while (true) {
    const stage = manager.currentStage()

    if (!stage) {
      const reviewResult = await renderReviewScreen(manager.progress)
      if (reviewResult === 'confirm') {
        break
      } else if (reviewResult === 'adjust') {
        const listResult = await renderStageList(manager.stages, null, manager.progress)
        if (listResult.kind === 'cancel') {
          manager.save()
          outro('Progress saved. Run stack-agent again to resume.')
          return
        }
        if (listResult.kind === 'select') {
          manager.navigateTo(listResult.stageId)
        }
        continue
      } else {
        manager.save()
        outro('Progress saved. Run stack-agent again to resume.')
        return
      }
    }

    const result = await runStageLoop(stage, manager)

    switch (result.outcome) {
      case 'complete': {
        const wasNavigation = manager.isNavigating()
        const oldValue = manager.getPendingOldValue()
        manager.completeStage(stage.id, result.summary)
        manager.save()

        if (wasNavigation) {
          await manager.invalidateAfter(stage.id, oldValue)
          manager.save()
        }
        break
      }
      case 'skipped':
        manager.skipStage(stage.id)
        manager.save()
        break
      case 'navigate': {
        const listResult = await renderStageList(manager.stages, stage.id, manager.progress)
        if (listResult.kind === 'cancel') {
          manager.restorePendingNavigation()
          continue
        }
        if (listResult.kind === 'review') {
          continue
        }
        if (listResult.kind === 'select') {
          if (listResult.stageId !== stage.id) {
            manager.navigateTo(listResult.stageId)
          }
        }
        break
      }
      case 'cancel':
        manager.save()
        outro('Progress saved. Run stack-agent again to resume.')
        return
    }
  }

  // Phase 2: Scaffold
  const success = await runScaffoldLoop(manager.progress)

  if (success) {
    const readiness = manager.progress.deployment
      ? checkDeployReadiness(manager.progress.deployment.component)
      : null
    renderPostScaffold(manager.progress.projectName!, readiness)
    manager.cleanup()
    outro('Happy building!')
  } else {
    renderError('Scaffolding encountered errors. Check the output above.')
    outro('You may need to fix issues manually.')
  }
}

const command = process.argv[2]

if (!command || command === 'init') {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
} else {
  console.error(`Unknown command: ${command}`)
  console.error('Usage: stack-agent [init]')
  process.exit(1)
}
