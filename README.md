# stack-agent

[![npm version](https://img.shields.io/npm/v/stack-agent)](https://www.npmjs.com/package/stack-agent)
[![CI](https://github.com/alainbrown/stack-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/alainbrown/stack-agent/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/node/v/stack-agent)](https://nodejs.org)

AI-powered CLI that helps developers choose and scaffold full-stack applications through conversational interaction.

A senior software architect in your terminal — it walks you through stack decisions, explains trade-offs, and scaffolds your project using official framework tools.

## How it works

1. **Conversation** — The agent asks what you're building, then guides you through frontend, backend, database, auth, payments, AI/LLM, and deployment choices
2. **Recommendations** — Each stage presents 2-3 options with a recommended pick and trade-off context
3. **Review** — Once all decisions are made, the agent presents your full stack for approval
4. **Scaffold** — The agent runs official tools (create-next-app, create-vite, etc.) and generates integration code grounded by current documentation

## Quick start

```bash
export ANTHROPIC_API_KEY=your-key-here
npx stack-agent
```

## Requirements

- Node.js 20+
- An [Anthropic API key](https://console.anthropic.com/settings/keys)

## What it does

- Delegates base scaffolding to official framework CLIs (create-next-app, create-vite, etc.)
- Generates integration code (auth, database, payments) using Claude, grounded by up-to-date documentation via MCP
- Writes `.env.example` with required environment variables
- Installs dependencies automatically

## Development

```bash
npm install
npm run dev          # Run with tsx
npm test             # Run tests
npm run build        # Build with tsup
```

## License

MIT
