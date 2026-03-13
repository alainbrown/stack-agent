import { runInit } from './commands/init.js'

const command = process.argv[2]

if (!command || command === 'init') {
  runInit().catch((err) => {
    console.error(err)
    process.exit(1)
  })
} else {
  console.error(`Unknown command: ${command}`)
  console.error('Usage: create-stack [init]')
  process.exit(1)
}
