import * as p from '@clack/prompts'
import { intro, outro, renderError, renderPostScaffold } from './cli/chat.js'
import { checkDeployReadiness } from './deploy/readiness.js'
import { runConversationLoop, runScaffoldLoop } from './agent/loop.js'

async function main() {
  intro()

  // Phase 1: Conversation
  const progress = await runConversationLoop()

  if (!progress) {
    outro('Setup cancelled.')
    return
  }

  // Review gate
  const confirmed = await p.confirm({
    message: 'Ready to build this stack?',
  })

  if (p.isCancel(confirmed) || !confirmed) {
    outro('No problem — run stack-agent again to start over.')
    return
  }

  // Phase 2: Scaffold
  const success = await runScaffoldLoop(progress)

  if (success) {
    const readiness = progress.deployment
      ? checkDeployReadiness(progress.deployment.component)
      : null
    renderPostScaffold(progress.projectName!, readiness)
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
