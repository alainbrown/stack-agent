# create-stack v2 — Design Specification

## Overview

An AI-assisted developer CLI that helps developers choose and scaffold full-stack applications through conversational interaction with a Claude-powered agent. The agent uses MCP servers (e.g., Context7) for current documentation, delegates base scaffolding to official framework tools, and generates integration/glue code grounded by up-to-date docs.

Core principle: **The agent is the architect. Official tools and current docs are its building materials.**

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Knowledge source | MCP servers (Context7, etc.) | Up-to-date docs without maintaining a registry |
| Conversation style | Guided stages with flexible conversation within each | Structure that converges without being rigid |
| Explanation depth | Trade-off context, opinionated recommendations | Developers want to understand why, not get a lecture |
| Scaffolding strategy | Dry-run conversation → review → scaffold once | AI decides what, system executes after human approval |
| Base scaffolding | Delegate to official tools (create-next-app, create-vite, etc.) | They're maintained, always current, and battle-tested |
| Integration layers | Claude-generated code grounded by MCP docs | Avoids maintaining templates for well-documented tools |
| Component composition | Independent integration files + LLM-generated glue | The LLM handles the combinatorial wiring problem |
| Agent architecture | Claude tool_use loop with lightweight progress tracking | Simple — Claude drives the conversation, CLI renders it |
| Context management | Structured decisions always committed; conversation summarized by Claude only when needed | Keeps context clean without premature optimization |
| MCP organization | Single registry server with pluggable backends | Clean agent interface, extensible behind the scenes |
| Maintained templates | None for v2 — add only if real usage reveals gaps | Popular components have excellent docs; MCP + Claude covers them |

## Architecture

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  CLI Shell   │ ←→  │  Claude Agent Loop    │ ←→  │  MCP Servers    │
│  (terminal)  │     │  (multi-turn + tools) │     │  (Context7 etc) │
└─────────────┘     └──────────────────────┘     └─────────────────┘
                              ↓
                     ┌────────────────┐
                     │  Stack Plan    │
                     │  (structured)  │
                     └───────┬────────┘
                             ↓
                     ┌────────────────┐
                     │  Scaffold      │
                     │  Engine        │
                     └────────────────┘
                        │         │
              ┌─────────┘         └──────────┐
              ↓                              ↓
     ┌─────────────────┐          ┌──────────────────┐
     │  Official CLI    │          │  Claude-generated │
     │  (create-next-   │          │  integration code │
     │   app, etc.)     │          │  (grounded by MCP)│
     └─────────────────┘          └──────────────────┘
```

**Three main systems:**

1. **CLI Shell** — Chat interface in the terminal. Renders agent messages, captures free-text user input, displays option lists. Uses `@clack/prompts` for styled output. Not a form — a conversation.

2. **Claude Agent Loop** — Multi-turn conversation with Claude using tool_use. Claude drives the conversation, asks questions, explains trade-offs, and commits decisions via tools. The CLI tracks committed decisions as structured state (StackProgress) and injects current progress into the system prompt each turn.

3. **MCP Servers** — External MCP servers (starting with Context7) provide current documentation and best practices. The agent queries these when it needs up-to-date information for recommendations or code generation.

**MCP integration model:** For v2, use the Anthropic API's native MCP connector via `client.beta.messages.create()` with the `mcp_servers` parameter (requires `anthropic-beta: mcp-client-2025-11-20` header). This works with remote HTTPS MCP servers — Context7 provides a hosted endpoint. The API handles tool discovery and execution transparently; MCP tools appear alongside local tools as `mcp_tool_use` / `mcp_tool_result` blocks. The `@modelcontextprotocol/sdk` client library is not needed for v2 — it's a future extension for local/custom MCP servers via stdio transport.

## Agent Loop

### Loop Structure

**Phase 1 — Conversation loop (choosing the stack):**

```
1. Build system prompt (persona + stage definitions + current progress)
2. Send message history to Claude
3. Claude responds with text and/or tool_use blocks
4. For each tool_use → execute tool → append tool_result
5. If Claude responded with text → render to terminal, get user input
6. Append user message → go to 2
7. When Claude calls present_plan → exit loop, show plan for review
```

**Phase 2 — Scaffold loop (building the project):**

After user approves the plan, a second agent loop runs with a scaffold-focused system prompt. Claude has access to `run_scaffold`, `add_integration`, and MCP tools. This loop does not take user input — it executes the plan autonomously, streaming progress to the terminal. If an error occurs, Claude can retry or report the failure.

```
1. Build scaffold system prompt (plan + available tools)
2. Send to Claude
3. Claude calls run_scaffold (base), then add_integration (each layer)
4. For each tool_use → execute → append tool_result → continue
5. When Claude stops calling tools → scaffold complete
```

The `max_tokens` for the conversation loop is 4096 (sufficient for explanations and option presentation). The scaffold loop uses 16384 (Claude generates complete integration files which can be large).

### System Prompt

The system prompt instructs Claude to:
- Act as a senior software architect helping a developer set up a project
- Walk through stack decisions conversationally
- Present 2-3 concrete options with brief trade-off context plus "something else" for each component category
- Be opinionated — lead with a recommendation and explain why
- Use MCP tools to get current documentation when generating integration code
- Use `set_decision` to commit each decision to structured state
- Use `summarize_stage` when a stage conversation has gotten long or circular
- Call `present_plan` when all relevant decisions are made

The system prompt includes the current `StackProgress` state so Claude knows what's been decided and what remains.

### Progress State

```typescript
interface StackProgress {
  projectName: string | null
  description: string | null
  frontend: ComponentChoice | null
  backend: ComponentChoice | null
  database: ComponentChoice | null
  auth: ComponentChoice | null
  payments: ComponentChoice | null
  deployment: ComponentChoice | null
  extras: ComponentChoice[]
}

interface ComponentChoice {
  component: string    // e.g. "clerk"
  reasoning: string    // e.g. "Best DX for auth, prebuilt components"
  scaffoldTool?: string  // e.g. "create-next-app" (for base framework)
  scaffoldArgs?: string[] // e.g. ["--typescript", "--tailwind", "--app"]
}
```

Progress is updated when Claude calls `set_decision`. It's injected into the system prompt every turn so Claude sees the current state as structured facts.

### Context Management

- **Every turn:** System prompt is rebuilt with current progress state
- **Within a stage:** Full conversation history preserved
- **Across stages:** Structured decisions are the source of truth
- **Summarization:** Claude has a `summarize_stage` tool it can call when a stage conversation has gotten long or circular. Most stages are brief (2-3 exchanges) and don't need summarization. When called, the `agent/loop.ts` message history manager replaces the detailed conversation turns for that stage with a single `assistant` message containing the summary. The replacement must maintain valid alternating `user`/`assistant` role structure in the message array — if needed, insert a synthetic `user` message like "[Continuing to next topic]" to preserve alternation.
- **Going back:** If the user wants to revisit a decision, the CLI clears that decision from progress state. Claude sees it as "not yet decided" and reopens the topic.

### Tools

**Conversation phase tools** (available during Phase 1 — stack selection):

| Tool | Input Schema | Purpose |
|------|-------------|---------|
| `set_decision` | `{ category: string, component: string, reasoning: string, scaffoldTool?: string, scaffoldArgs?: string[] }` | Commit a stack decision to structured state |
| `summarize_stage` | `{ category: string, summary: string }` | Replace a stage's conversation turns with a concise summary |
| `present_plan` | `{}` (no params) | Signal all decisions are made, trigger review step |

**Scaffold phase tools** (available during Phase 2 — project generation):

| Tool | Input Schema | Purpose |
|------|-------------|---------|
| `run_scaffold` | `{ tool: string, args: string[] }` | Execute an official scaffold CLI command (e.g., `create-next-app`) |
| `add_integration` | `{ files: Record<string, string>, dependencies?: Record<string, string>, devDependencies?: Record<string, string>, envVars?: string[] }` | Write files (keys = dest paths relative to project root, values = file contents), install deps, append env vars to `.env.example` |

**MCP tools** (available in both phases): Context7 and other MCP server tools are discovered automatically via the Anthropic API's MCP connector. They appear as `mcp_tool_use` blocks alongside local tools.

**`set_decision` category values:** Use the `StackProgress` field names: `"frontend"`, `"backend"`, `"database"`, `"auth"`, `"payments"`, `"deployment"`. For extras, use `"extras"` — multiple `set_decision` calls with `category: "extras"` append to the `extras` array rather than overwriting.

## Conversation Stages

Stages define the interaction mode, not a rigid progression:

| Stage | Interaction | Purpose |
|-------|-------------|---------|
| Discovery | Free text | Understand what the user is building |
| Frontend | Options + "something else" | Choose frontend framework |
| Backend | Options + "something else" | Choose backend/API approach (may be implicit from frontend choice, e.g., Next.js includes API routes) |
| Database | Options + "something else" | Choose database + ORM/query layer |
| Auth | Options + "something else" | Choose auth provider |
| Payments | Options + "skip for now" | Choose payments provider or defer |
| Deployment | Options + "something else" | Choose hosting/deployment |
| Extras | Agent-suggested based on context | Anything else relevant (analytics, email, etc.) |
| Review | Structured plan display + yes/no | Confirm before scaffolding |

The agent can skip stages that aren't relevant (e.g., no backend stage if frontend choice already includes it), reorder based on conversation flow, and add stages for extras that emerge from the discovery conversation.

## Scaffold Engine

Three phases, executed after the user approves the stack plan:

### Phase 1: Base Scaffold

Run the official framework CLI tool. The `scaffoldTool` and `scaffoldArgs` from the frontend's `ComponentChoice` determine the command:

```bash
# Example: create-next-app with flags decided during conversation
npx create-next-app@latest my-reservation-app --typescript --tailwind --eslint --app --src-dir
```

The CLI runs this command, streams output to the terminal, and confirms the base project was created. If it fails, the agent sees the error and can suggest fixes.

### Phase 2: Integration Layers

For each integration (database, auth, payments, etc.), the agent:

1. Queries MCP (Context7) for current setup documentation
2. Generates integration files — e.g., Drizzle config, schema file, Clerk middleware
3. Calls `add_integration` to write files and install dependencies
4. Each integration is applied independently

### Phase 3: Glue Code

The agent generates connecting code:
- Import statements in layout/config files
- Provider wrappers (e.g., `ClerkProvider` in root layout)
- Middleware chains
- Environment variable documentation (`.env.example`)

This is also done via `add_integration` calls. The distinction from Phase 2 is conceptual — Phase 2 adds each integration's own files, Phase 3 connects them to the base and to each other.

## CLI UX

The CLI is a chat interface using `@clack/prompts` for styled output:

- **Agent messages** render as styled text blocks
- **Option lists** render as numbered items the user can select by number or respond with free text
- **User input** is always a text field — the user can type a number, a question, or a full sentence
- **The final review** displays a structured plan summary and asks for explicit confirmation
- **Scaffold progress** shows spinner/status for each phase

The user can always:
- Type a number to select an option quickly
- Type a question to get more info before deciding
- Type "go back" or similar to revisit an earlier decision
- Type anything — Claude handles ambiguity naturally

## Project Structure

```
create-stack/
├── src/
│   ├── index.ts                  # Entry point — parse args, launch agent
│   ├── cli/
│   │   └── chat.ts               # Terminal chat interface (render, input, options)
│   ├── agent/
│   │   ├── loop.ts               # Multi-turn conversation loop
│   │   ├── system-prompt.ts      # Build system prompt with persona + progress
│   │   ├── tools.ts              # Tool definitions and execution
│   │   └── progress.ts           # StackProgress state management
│   ├── llm/
│   │   └── client.ts             # Anthropic SDK wrapper (multi-turn + tool_use)
│   └── scaffold/
│       ├── base.ts               # Run official scaffold CLIs
│       └── integrate.ts          # Write integration files, install deps
├── tests/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

## What Changes From v1

**Deleted:**
- `src/` — entire v1 source (replaced with new architecture)
- `tests/` — entire v1 tests
- `templates/` — no longer needed
- `modules/` — no longer needed

**Kept:**
- `package.json` — updated dependencies
- `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts` — kept as-is
- `docs/` — preserved as history
- `.gitignore`

**New dependencies:**
- None for v2 — MCP is handled via the Anthropic API's native MCP connector (no separate SDK needed)

**Removed dependencies:**
- None significant (keep `@clack/prompts`, `@anthropic-ai/sdk`, `zod`, etc.)

## Error Handling

- **MCP server unavailable:** Agent falls back to its training knowledge. Warns the user that docs may not be fully current.
- **MCP server auth failure:** If Context7 or another MCP server requires an API key and it's missing or invalid, the agent logs a warning and proceeds without that MCP server. The conversation can still work — recommendations come from Claude's training knowledge, just without the latest docs grounding.
- **Official scaffold tool fails:** Agent sees the error output, explains it, suggests fixes.
- **Target directory already exists:** Before running the base scaffold, the CLI checks if the output directory exists. If non-empty, it fails with a clear error: "Directory `<name>` already exists and is not empty. Choose a different name or delete it first." No `--overwrite` flag for v2.
- **Integration code generation fails:** Agent reports the issue, can retry with different approach.
- **User cancels mid-conversation:** Exit cleanly, no files written (scaffold hasn't happened yet).
- **API key missing:** Clear error with setup instructions. Required: `ANTHROPIC_API_KEY`. Optional: MCP server credentials (e.g., Context7 API key) — the tool works without them but with reduced doc freshness.

## Future Extension Points

- Additional MCP servers for specialized domains
- Community-contributed MCP backends
- Local template overrides for teams with specific standards
- Resume interrupted conversations
- `create-stack add <integration>` to add layers to existing projects
- `create-stack explain` to describe an existing project's architecture
