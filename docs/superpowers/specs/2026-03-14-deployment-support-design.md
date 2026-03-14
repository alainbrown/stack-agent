# Deployment Support for Scaffolded Projects

**Date:** 2026-03-14
**Status:** Approved

## Problem

stack-agent guides users through selecting a deployment target (Vercel, AWS, GCP, Docker, etc.) and generates deployment configuration files during scaffolding. But the post-scaffold experience is minimal:

```
cd <projectName>
cp .env.example .env  # fill in your values
npm run dev
```

Users are left to figure out deployment on their own. The agent already knows the full stack context — it should use that knowledge to get users as close to a working deploy as possible without actually executing one.

Additionally, there is no README or project documentation generated. Users get a pile of files with no guide to understanding or operating the project.

## Goals

1. Generate a comprehensive README covering local dev, env vars, and deployment
2. Generate a platform-specific `deploy.sh` script and `npm run deploy` command
3. Check deployment readiness (CLI installed, authenticated) and print clear guidance
4. Make the distinction between local `.env` and production env var management explicit

## Non-Goals

- Actually executing deployments
- Automating env var configuration on platforms
- Supporting every possible deployment target (cover the common ones, Claude handles the rest)

## Design

### Overview

The deployment support consists of four pieces, two of which require no new runtime code:

| Piece | Change Type | Location |
|-------|------------|----------|
| README generation | System prompt update | `src/agent/system-prompt.ts` |
| deploy.sh + npm script | System prompt update | `src/agent/system-prompt.ts` |
| Deploy readiness check | New module | `src/deploy/readiness.ts` |
| Enhanced terminal output | Code update | `src/cli/chat.ts`, `src/index.ts` |

### Architecture

```
Phase 1 (conversation) → Review gate → Phase 2 (scaffold) → Phase 3 (deploy readiness) → Enhanced output → Done
```

Phase 3 is not a separate Claude loop. It is deterministic logic driven by `progress.deployment.component`.

---

### 1. README Generation

**Change type:** Scaffold system prompt update only.

The `buildScaffoldPrompt` in `src/agent/system-prompt.ts` gets updated to instruct Claude to generate a comprehensive README.md as the final `add_integration` call during the scaffold phase.

**Required README sections:**

1. **Project title & description** — from `progress.projectName` and `progress.description`
2. **Tech stack overview** — what was chosen and why, sourced from progress decisions
3. **Prerequisites** — Node.js version, required CLI tools (vercel, gcloud, aws, docker, etc.)
4. **Local development setup** — clone, install deps, configure `.env`, run dev server
5. **Environment variables** — table format for every env var from `.env.example`:
   - Variable name
   - What it's for
   - Where to get it (e.g., "Stripe Dashboard → API Keys")
   - Required vs optional
6. **Deployment** — platform-specific section based on deployment decision:
   - How to install and authenticate the platform CLI
   - How to set env vars **on the platform** (not in `.env`)
     - Vercel: `vercel env add VAR_NAME`
     - GCP: `gcloud run services update --set-env-vars KEY=VAL`
     - AWS: Systems Manager Parameter Store or Secrets Manager
     - Docker: docker-compose `.env` or secrets
   - The deploy command (`npm run deploy`)
   - Post-deploy verification steps
7. **Project structure** — brief description of key directories and files generated

**Critical distinction:** The README must clearly separate local development (`.env` file) from production deployment (platform-native env var/secrets management). The `.env.example` file is a development artifact. Production env vars are configured through platform tools.

### 2. Deploy Script Generation

**Change type:** Scaffold system prompt update only.

The `buildScaffoldPrompt` gets updated to instruct Claude to generate:

**`deploy.sh`** at the project root (~15-30 lines), tailored to the deployment decision:

- **Vercel:** `vercel --prod`
- **AWS Amplify:** `amplify publish`
- **AWS CDK:** `cdk deploy`
- **AWS SST:** `npx sst deploy --stage production`
- **GCP Cloud Run:** `gcloud run deploy <project> --source . --region us-central1`
- **Docker:** `docker compose up -d --build`
- **Railway:** `railway up`
- **Fly.io:** `fly deploy`

The script must:
1. Check that the required CLI tool is installed (exit with a helpful message if not)
2. Check authentication status
3. Print what it's about to do
4. Execute the deploy command
5. Be simple — no elaborate bash framework

**`package.json` addition:**

```json
{
  "scripts": {
    "deploy": "bash deploy.sh"
  }
}
```

Both the script file and the `scripts.deploy` entry are written via the existing `add_integration` tool. No new tools or modules needed.

### 3. Deploy Readiness Check

**Change type:** New module `src/deploy/readiness.ts`.

After Phase 2 (scaffold) completes successfully, a lightweight readiness check runs before printing next steps.

**Interface:**

```typescript
export interface ReadinessResult {
  platform: string
  cliInstalled: boolean
  cliName: string
  authenticated: boolean | null  // null = cannot determine
  installCmd: string
  authCmd: string
  deployCmd: string
}

export function checkDeployReadiness(
  deploymentComponent: string
): ReadinessResult
```

**Platform detection matrix:**

| Platform | CLI binary | Auth check command | Install command |
|----------|-----------|-------------------|-----------------|
| Vercel | `vercel` | `vercel whoami` | `npm i -g vercel` |
| AWS | `aws` | `aws sts get-caller-identity` | See docs.aws.amazon.com |
| GCP | `gcloud` | `gcloud auth print-identity-token` | See cloud.google.com/sdk |
| Docker | `docker` | `docker info` | Platform-specific |
| Railway | `railway` | `railway whoami` | `npm i -g @railway/cli` |
| Fly.io | `fly` | `fly auth whoami` | See fly.io/docs |

**Behavior:**

- Uses `execFileSync` with `{ stdio: 'pipe' }` to check CLI presence and auth
- Catches errors gracefully — a failed check means "not ready", never crashes the agent
- Pure detection: never modifies system state, never writes files, never deploys
- Returns a structured result that the terminal output renderer consumes

**Mapping deployment component to platform:** The `deploymentComponent` string from progress (e.g., "Vercel", "AWS Lambda", "GCP Cloud Run", "Docker") is normalized to match the platform detection matrix. Unrecognized platforms get a generic result pointing users to the README.

### 4. Enhanced Terminal Output

**Change type:** Updates to `src/cli/chat.ts` and `src/index.ts`.

**New function in `src/cli/chat.ts`:**

```typescript
export function renderPostScaffold(
  projectName: string,
  readiness: ReadinessResult
): void
```

**Output format when ready:**

```
─── Local Development ───────────────────
  cd my-app
  cp .env.example .env   # fill in your values
  npm install
  npm run dev

─── Deployment (Vercel) ─────────────────
  ✓ Ready to deploy
  → npm run deploy

  ℹ Set production env vars with: vercel env add
  ℹ See README.md → Deployment for full instructions
```

**Output format when not ready:**

```
─── Local Development ───────────────────
  cd my-app
  cp .env.example .env   # fill in your values
  npm install
  npm run dev

─── Deployment (Vercel) ─────────────────
  ✗ vercel CLI not found
    Install: npm i -g vercel
    Then: vercel login
    Then: npm run deploy

  ℹ Set production env vars with: vercel env add
  ℹ See README.md → Deployment for full instructions
```

**Integration in `src/index.ts`:**

The current success block:

```typescript
if (success) {
  const nextSteps = [`cd ${progress.projectName}`]
  nextSteps.push('cp .env.example .env  # fill in your values')
  nextSteps.push('npm run dev')
  p.log.step('Next steps:\n  ' + nextSteps.join('\n  '))
  outro('Happy building!')
}
```

Gets replaced with:

```typescript
if (success) {
  const readiness = checkDeployReadiness(progress.deployment!.component)
  renderPostScaffold(progress.projectName!, readiness)
  outro('Happy building!')
}
```

Uses existing `@clack/prompts` helpers (`p.log.step`, `p.log.info`, `p.log.warn`). No new dependencies.

## Files Changed

| File | Change |
|------|--------|
| `src/agent/system-prompt.ts` | Update `buildScaffoldPrompt` — add README and deploy.sh generation instructions |
| `src/deploy/readiness.ts` | **New file** — deploy readiness check (~80-100 lines) |
| `src/cli/chat.ts` | Add `renderPostScaffold` function (~30-40 lines) |
| `src/index.ts` | Replace hardcoded next steps with readiness check + enhanced output (~10 lines) |
| `tests/deploy/readiness.test.ts` | **New file** — tests for readiness check |
| `tests/cli/chat.test.ts` | Tests for `renderPostScaffold` (if chat tests exist, otherwise new file) |

## Estimated Size

~120-150 lines of new runtime code. Two of the four pieces are system prompt text changes only.
