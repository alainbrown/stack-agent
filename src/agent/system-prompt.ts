import { serializeProgress, type StackProgress } from './progress.js'
import { STAGE_INSTRUCTIONS, type StageEntry } from './stages.js'

export function buildConversationPrompt(
  progress: StackProgress,
  stageId: string,
  stages: StageEntry[],
): string {
  const stage = stages.find((s) => s.id === stageId)
  const stageLabel = stage?.label ?? stageId
  const instruction = STAGE_INSTRUCTIONS[stageId] ?? `Discuss the ${stageLabel} stage with the user.`

  const completedSummaries = stages
    .filter((s) => s.status === 'complete' && s.summary)
    .map((s) => `- ${s.label}: ${s.summary}`)
    .join('\n')

  const contextSection = completedSummaries
    ? `\n\nContext from previous stages:\n${completedSummaries}`
    : ''

  return `You are a senior software architect helping a developer set up a new project.

Current project state:
${serializeProgress(progress)}

## Current Stage: ${stageLabel}

You are currently discussing the ${stageLabel} stage.
${instruction}

Response guidelines:
- When presenting technology choices, call \`present_options\` with 2-3 options. Do NOT write numbered lists in text.
- Option labels: max 30 characters (just the name).
- Option descriptions: max 80 characters (one-line trade-off summary).
- Mark at most one option as recommended.
- After a user selects an option, confirm in one short sentence (max 60 chars) and call set_decision immediately.
- When answering questions, keep responses under 500 characters. Most answers should be 1-2 sentences. Only approach 500 chars for genuinely complex comparisons.
- Never congratulate or explain why a choice is great. Just confirm and move on.
${contextSection}

Guidelines:
- Focus on ${stageLabel}. Do not discuss other undecided stages.
- When the user has made their choice, call \`set_decision\` to commit it, then call \`summarize_stage\` to summarize what was decided.
- If this stage is not relevant to the project, briefly explain why and call \`summarize_stage\` to skip it.
- Do not ask the user to confirm each tool call — just make the calls naturally as decisions are reached.`
}

export function buildScaffoldPrompt(progress: StackProgress): string {
  return `You are scaffolding a new software project based on an approved plan.

Approved plan:
${serializeProgress(progress)}

Instructions:
1. Call \`run_scaffold\` first to bootstrap the project using the appropriate scaffold CLI tool (e.g. create-next-app, create-vite, etc.).
2. After scaffolding, call \`add_integration\` for each integration (database, auth, payments, deployment config, extras) to write necessary files, install dependencies, and declare required environment variables.
3. Use MCP tools to look up current documentation for any libraries or frameworks you integrate, ensuring you use up-to-date APIs and configuration patterns.
4. Generate complete, working code — no stubs, no placeholders, no TODO comments. Every file should be production-ready.
5. Generate a \`deploy.sh\` script at the project root via \`add_integration\`. The script must:
   - Start with \`set -euo pipefail\`
   - Check that the required CLI tool is installed (exit 1 with a helpful message if not)
   - Check authentication status (exit 1 with auth instructions if not)
   - Print what it is about to do
   - Execute the deploy command for the chosen platform
   - Be 15-30 lines max — no elaborate bash framework
   Use the \`scripts\` property of \`add_integration\` to add \`"deploy": "bash deploy.sh"\` to package.json.
6. As the LAST \`add_integration\` call, generate a comprehensive \`README.md\` with these sections:
   - **Project title and description**
   - **Tech stack overview** — what was chosen and why
   - **Prerequisites** — Node.js version, required CLI tools
   - **Local development setup** — clone, \`npm install\`, configure \`.env\` from \`.env.example\`, \`npm run dev\`
   - **Environment variables** — table with: variable name, what it is for, where to get it, required vs optional. Clearly state that \`.env\` is for local development only.
   - **Deployment** — platform-specific instructions:
     - How to install and authenticate the platform CLI
     - How to set env vars ON THE PLATFORM (e.g. \`vercel env add\`, \`gcloud run services update --set-env-vars\`, AWS Parameter Store). Production env vars are NOT set via \`.env\` — they are configured through platform-native tools.
     - The deploy command: \`npm run deploy\`
     - Post-deploy verification steps
   - **Project structure** — brief description of key directories and files

Do not ask for confirmation. Proceed through all steps automatically.`
}
