# create-stack — Design Specification

## Overview

An AI-assisted developer CLI that scaffolds full-stack applications through interactive prompts, LLM-driven architecture decisions, and deterministic template-based execution.

Core principle: **LLM decides what, system decides how.**

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM provider | Claude (Anthropic SDK) | Structured output via tool use, strong architectural reasoning |
| CLI framework | `@clack/prompts` | Modern terminal UX, built-in spinners, clean visual style |
| Initial scope | 1 template (`nextjs-basic`) + 1 module (`auth-supabase`) | Proves full pipeline end-to-end |
| Template distribution | Bundled in package, designed for extraction later | Ships fast, keeps door open for remote fetching |
| API key management | `ANTHROPIC_API_KEY` env var | Standard convention, no config system needed for v1 |
| Dev tooling | TypeScript + `tsx` (dev) + `tsup` (build) | Fast dev iteration, clean distributable |
| Testing | Vitest | Native TS/ESM support, pairs with toolchain |
| Scaffolding strategy | File copy + simple token replacement | Predictable, no templating engine overhead |
| Architecture | Linear pipeline with single retry on validation failure | Simple, debuggable, matches deterministic execution principle |
| Model | `claude-sonnet-4-6` | Fast, cheap, sufficient for constrained JSON selection |
| Stack Graph | Omitted for v1; replaced by `compatibleModules` validation | One template + one module doesn't need a graph layer; validation guard prevents invalid combos |
| LLM error recovery | Deferred to v2 | v1 scope is narrow enough that deterministic error messages suffice; LLM-assisted recovery adds complexity without proportional value yet |

## Architecture

```
CLI prompts → LLM call → validate JSON (1 retry) → execute steps sequentially
```

The system is a linear pipeline. Each stage is a pure function: collect input, call Claude, parse structured response, pass to execution engine. On JSON validation failure, the LLM is retried once with the error appended. On second failure, the process exits.

## Project Structure

```
create-stack/
├── src/
│   ├── index.ts              # Entry point — parse args, route to command
│   ├── commands/
│   │   └── init.ts           # Main create-stack flow (orchestrator)
│   ├── cli/
│   │   └── prompts.ts        # Clack-based interactive prompts
│   ├── llm/
│   │   ├── client.ts         # Anthropic SDK wrapper
│   │   ├── planner.ts        # Requirements → StackDecision
│   │   └── schemas.ts        # Zod schemas for LLM output validation
│   ├── engine/
│   │   ├── scaffold.ts       # Copy template, replace tokens
│   │   ├── modules.ts        # Apply module (copy files, merge deps)
│   │   └── deps.ts           # Run package manager install
│   └── utils/
│       └── tokens.ts         # __TOKEN__ replacement logic
├── templates/
│   └── nextjs-basic/
│       └── template.json     # Metadata: name, description, tokens, compatible modules
├── modules/
│   └── auth-supabase/
│       ├── module.json       # Metadata: deps, env vars, file mappings
│       └── files/            # Files to copy into the project
├── tests/
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

Templates are stored as real, runnable projects with token placeholders. They can be tested independently.

## Component Design

### CLI Prompts (`src/cli/prompts.ts`)

Exports a single function that runs the interactive session and returns:

```typescript
interface UserRequirements {
  projectName: string
  description: string
  scale: 'hobby' | 'startup' | 'enterprise'
  frontend: 'nextjs' | 'react-spa' | 'none'
  needsAuth: boolean
  needsPayments: boolean
}
```

Output directory is always `./<projectName>` relative to cwd. It is not prompted — it is derived from `projectName`.

Prompt flow:
1. `text()` — Project name (validated as valid npm package name)
2. `text()` — Description
3. `select()` — Scale (hobby / startup / enterprise)
4. `select()` — Frontend framework
5. `confirm()` — Auth needed?
6. `confirm()` — Payments needed?

Ctrl+C at any prompt exits cleanly with "Setup cancelled."

### LLM Planning (`src/llm/`)

**`schemas.ts`** — Zod schema for LLM response:

```typescript
interface StackDecision {
  frontend: string           // e.g. "nextjs"
  backend: string            // e.g. "node"
  database: string           // e.g. "postgres"
  auth: string               // e.g. "supabase"
  deployment: string         // e.g. "vercel"
  template: string           // resolved template name, e.g. "nextjs-basic"
  modules: string[]          // resolved module names, e.g. ["auth-supabase"]
  reasoning: string          // why this stack was chosen (shown to user)
}
```

The schema preserves the original spec's architectural fields (`frontend`, `backend`, `database`, `auth`, `deployment`) so the LLM expresses intent, not just file paths. The `template` and `modules` fields map that intent to concrete templates/modules. Environment variables are derived from `module.json` — the LLM does not redundantly declare them.

**`client.ts`** — Reads `ANTHROPIC_API_KEY` from env. Exposes `callClaude(systemPrompt, userMessage)`. Exits with clear error if key is missing.

**`planner.ts`**:
1. Takes `UserRequirements` + available templates/modules (read from disk)
2. Builds system prompt: "You are a software architect. Choose from available templates and modules. Return JSON matching this schema."
3. Includes each `template.json` and `module.json` in the prompt so the LLM only picks from what exists. (Note: this full-metadata injection is a v1 simplification. At scale with many templates/modules, this will need to be replaced with a summarization or pre-filtering step.)
4. Validates response against Zod schema
5. **Validates `StackDecision.modules` against the selected template's `compatibleModules` list.** If a module is not compatible, the validation fails and triggers the retry.
6. On validation failure: retries once with error appended
7. On second failure: exits with error

### Execution Engine (`src/engine/`)

**`scaffold.ts`** — Template scaffolding:
1. Reads `template.json` from selected template
2. Recursively copies template to output directory
3. Runs `string.replaceAll()` for each token (`__PROJECT_NAME__` → actual value). **Token validation:** after replacement, warns if any `__UNRESOLVED_TOKEN__` patterns remain in output files (detected via regex). This catches tokens declared in files but missing from `template.json` or `UserRequirements`.
4. Skips `template.json` (metadata only)

Template metadata format:
```json
{
  "name": "nextjs-basic",
  "description": "Basic Next.js application",
  "tokens": ["PROJECT_NAME", "DESCRIPTION"],
  "compatibleModules": ["auth-supabase"]
}
```

**`modules.ts`** — Module application:
1. Reads `module.json` from selected module
2. Copies files into scaffolded project at specified paths. **Module files always overwrite template files** — templates should be designed to not conflict, but if they do, the module wins. This is intentional: modules are specializations applied on top of the base template.
3. Merges dependencies into `package.json`
4. Appends env vars to `.env.example`

Module metadata format:
```json
{
  "name": "auth-supabase",
  "dependencies": { "@supabase/supabase-js": "^2.0.0" },
  "devDependencies": {},
  "env": ["SUPABASE_URL", "SUPABASE_KEY"],
  "files": {
    "lib/auth.ts": "files/auth.ts",
    "middleware.ts": "files/middleware.ts"
  }
}
```

**`deps.ts`** — Dependency installation:
1. Detects package manager by checking the **user's cwd** (not the scaffolded project) for lockfiles: `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` → bun, otherwise defaults to `npm`. The scaffolded project is new and has no lockfiles, so detection is based on the user's existing environment.
2. Runs install in scaffolded project
3. Streams output with clack spinner

### Command Orchestrator (`src/commands/init.ts`)

Full pipeline:
1. `clack.intro("create-stack")`
2. Run prompts → `UserRequirements`
3. Load available templates & modules from disk
4. Spinner → call `planner()` → `StackDecision`
5. Present recommendation to user (template, modules, reasoning)
6. `confirm()` — "Proceed with this stack?" (human approval gate)
7. Spinner → scaffold template
8. Spinner → apply each module
9. Spinner → install dependencies
10. Show next steps (cd, env setup, dev command)
11. `clack.outro("Happy building!")`

### Entry Point (`src/index.ts`)

Parses `process.argv[2]`. Default/`init` runs the init flow. Unknown commands exit with error. Structure supports adding `add`, `doctor`, `explain` commands later.

**`package.json` bin field:**
```json
{ "bin": { "create-stack": "./dist/index.js" } }
```

Enables both `npx create-stack` and global install.

## Error Handling

- Each engine step throws on failure
- Orchestrator catches errors, shows clear message via `clack.log.error()`, exits
- No LLM involvement in error recovery for v1
- Missing API key produces actionable error message

## Future Extension Points

- Additional commands (`add`, `doctor`, `explain`) via new files in `commands/`
- New templates and modules added to their directories with metadata files
- Template distribution can be swapped to remote fetching by changing resolution in `scaffold.ts`
- LLM provider can be abstracted behind the `client.ts` interface
- Multi-stage planning (Approach C) if single-call struggles with complex decisions
- Prompt construction will need summarization/pre-filtering when template/module count grows beyond what fits comfortably in context
- LLM-assisted error recovery (deferred from v1) for handling dependency conflicts and scaffolding failures
