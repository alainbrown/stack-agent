# stack-agent

[![npm version](https://img.shields.io/npm/v/stack-agent)](https://www.npmjs.com/package/stack-agent)
[![CI](https://github.com/alainbrown/stack-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/alainbrown/stack-agent/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/node/v/stack-agent)](https://nodejs.org)

AI-powered CLI that helps developers choose and scaffold full-stack applications through a fullscreen terminal UI.

A senior software architect in your terminal — it recommends your entire stack, lets you review and refine each decision, then scaffolds the project with integration code.

## How it works

1. **Project info** — Enter your project name and description
2. **Recommendations** — The agent analyzes your project and recommends a full stack in one shot (frontend, database, auth, deployment, etc.)
3. **Review** — A color-coded stage list shows all decisions: green for confirmed, yellow for suggested, dim for skipped. Select any stage to discuss and refine.
4. **Build** — Confirm and the agent scaffolds your project with step-by-step progress in the terminal frame

## Quick start

```bash
export ANTHROPIC_API_KEY=your-key-here
npx stack-agent
```

## Features

- **Fullscreen TUI** — Persistent header/footer frame built with [ink](https://github.com/vadimdemedes/ink)
- **One-shot recommendations** — LLM pre-fills all stack decisions after you describe your project
- **Stage navigation** — Review, confirm, or change any decision from the stage list
- **Session persistence** — Progress auto-saves to `.stack-agent.json`. Resume anytime with `npx stack-agent`
- **Scaffold progress** — Real-time step-by-step progress with file lists during scaffolding
- **Structured logging** — Set `LOG_LEVEL=debug` for full LLM request/response visibility

## Usage

```bash
npx stack-agent            # Start or resume a session
npx stack-agent --fresh    # Clear saved progress and start over
```

### Navigation

- **Enter** — Select a stage or confirm
- **Esc** — Return to stage list
- **Arrow keys** — Navigate options

## Requirements

- Node.js 20+
- An [Anthropic API key](https://console.anthropic.com/settings/keys)

## Development

```bash
npm install
npm run dev          # Run with tsx
npm run mockup       # Run interactive TUI mockup (no LLM calls)
npm test             # Run tests (176 tests)
npm run build        # Build with tsup
```

## Architecture

```
src/
  cli/
    app.tsx                  # Root ink component, state machine
    bridge.ts                # Loop-to-UI communication bridge
    components/              # Header, Footer, StageList, OptionSelect, etc.
    mockup.tsx               # Interactive mockup for UX iteration
  agent/
    loop.ts                  # Per-stage conversation + scaffold loops
    stage-manager.ts         # Stage state, persistence, navigation
    stages.ts                # Stage types, defaults, instructions
    progress.ts              # Decision state, session serialization
    tools.ts                 # LLM tool definitions
    system-prompt.ts         # Per-stage system prompts with char limits
    recommend.ts             # One-shot LLM recommendation pass
  llm/
    client.ts                # Anthropic SDK wrapper with logging
  scaffold/
    base.ts                  # CLI scaffold runner (npx create-*)
    integrate.ts             # File writer, dependency merger
  deploy/
    readiness.ts             # Platform detection, CLI/auth checks
  util/
    logger.ts                # Pino-based structured logging
```

## License

MIT
