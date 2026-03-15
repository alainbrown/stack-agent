# stack-agent

[![npm version](https://img.shields.io/npm/v/stack-agent)](https://www.npmjs.com/package/stack-agent)
[![CI](https://github.com/alainbrown/stack-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/alainbrown/stack-agent/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/node/v/stack-agent)](https://nodejs.org)

AI-powered CLI that helps developers choose and scaffold full-stack applications through a fullscreen terminal UI.

A senior software architect in your terminal — it recommends your entire stack, lets you review and refine each decision, then scaffolds the project with integration code.

## Usage

```bash
export ANTHROPIC_API_KEY=your-key-here
npx stack-agent            # Start or resume a session
```

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

## Claude Code skill

Prefer Claude Code? There's a [skill version](https://github.com/alainbrown/stack-agent-skill) that runs natively inside Claude Code — same workflow, no separate tool.

## License

MIT
