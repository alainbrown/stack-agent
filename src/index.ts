import React from 'react'
import { withFullScreen } from 'fullscreen-ink'
import { App } from './cli/app.js'
import { StageManager } from './agent/stage-manager.js'
import { serializeProgress } from './agent/progress.js'
import { chat } from './llm/client.js'
import { runScaffoldLoop } from './agent/loop.js'
import { renderPostScaffold } from './cli/chat.js'
import { checkDeployReadiness } from './deploy/readiness.js'
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

async function main(fresh = false) {
  const cwd = process.cwd()
  const invalidationFn = createInvalidationFn()

  // Handle SIGINT gracefully — atomic save handles mid-write safety
  process.on('SIGINT', () => {
    process.exit(0)
  })

  // Handle --fresh: delete saved session
  if (fresh) {
    const tempManager = StageManager.resume(cwd)
    tempManager?.cleanup()
    console.log('Session cleared. Starting fresh.\n')
  }

  // Handle resume before fullscreen
  let manager: StageManager
  const existingSession = fresh ? null : StageManager.detect(cwd)

  if (existingSession) {
    console.log(`\nFound saved progress for "${existingSession.progress.projectName ?? 'unnamed'}"`)
    console.log('Run with --fresh to start over.\n')
    const resumed = StageManager.resume(cwd, invalidationFn)
    if (!resumed) {
      console.log('Could not restore session. Starting fresh.')
      manager = StageManager.start(cwd, invalidationFn)
    } else {
      manager = resumed
    }
  } else {
    manager = StageManager.start(cwd, invalidationFn)
  }

  // Phase 1: Fullscreen conversation
  let shouldBuild = false

  const ink = withFullScreen(
    React.createElement(App, {
      manager,
      onBuild: () => { shouldBuild = true },
      onExit: () => { shouldBuild = false },
    }),
  )
  await ink.start()
  await ink.waitUntilExit()

  // Phase 2: Scaffold (normal stdout, outside fullscreen)
  if (shouldBuild) {
    console.log('\nScaffolding your project...\n')
    const success = await runScaffoldLoop(manager.progress)

    if (success) {
      const readiness = manager.progress.deployment
        ? checkDeployReadiness(manager.progress.deployment.component)
        : null
      renderPostScaffold(manager.progress.projectName!, readiness)
      manager.cleanup()
      console.log('\nHappy building!\n')
    } else {
      console.error('\nScaffolding encountered errors. Check the output above.\n')
    }
  }
}

const args = process.argv.slice(2)
const command = args[0]
const isFresh = args.includes('--fresh')

if (!command || command === 'init' || command === '--fresh') {
  main(isFresh).catch((err) => {
    console.error(err)
    process.exit(1)
  })
} else {
  console.error(`Unknown command: ${command}`)
  console.error('Usage: stack-agent [init] [--fresh]')
  process.exit(1)
}
