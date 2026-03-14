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

The deployment support consists of five pieces:

| Piece | Change Type | Location |
|-------|------------|----------|
| Extend `add_integration` with `scripts` | Tool schema + integration update | `src/agent/tools.ts`, `src/scaffold/integrate.ts` |
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

### 0. Extend `add_integration` with `scripts` Merging

**Change type:** Tool schema and integration logic update.

The existing `add_integration` tool supports merging `dependencies` and `devDependencies` into `package.json`, but has no mechanism for merging `scripts`. Since Claude needs to add `"deploy": "bash deploy.sh"` to the scripts block, this must be extended.

**Changes to `src/agent/tools.ts`:**

Add a `scripts` property to the `add_integration` input schema:

```typescript
scripts: {
  type: 'object',
  additionalProperties: { type: 'string' },
  description: 'Map of script names to commands to merge into package.json scripts.',
},
```

**Changes to `src/scaffold/integrate.ts`:**

Add `scripts?: Record<string, string>` to the `IntegrationInput` interface. The guard condition for the package.json read/write block must be expanded to include `scripts`:

```typescript
if (dependencies !== undefined || devDependencies !== undefined || scripts !== undefined) {
```

Then merge scripts into `package.json` the same way dependencies are merged:

```typescript
if (scripts !== undefined) {
  pkg.scripts = {
    ...(pkg.scripts as Record<string, string> | undefined),
    ...scripts,
  }
}
```

Without this guard expansion, an `add_integration` call with only `files` and `scripts` (no dependencies) — which is exactly the deploy script use case — would silently skip the package.json update.

**Changes to `src/agent/loop.ts`:**

Pass `scripts` from the tool input through to `writeIntegration`. In the `add_integration` handler (around line 259), add `scripts` to the object passed to `writeIntegration`:

```typescript
writeIntegration(projectDir, {
  files: (toolBlock.input.files as Record<string, string>) ?? {},
  dependencies: toolBlock.input.dependencies as Record<string, string> | undefined,
  devDependencies: toolBlock.input.devDependencies as Record<string, string> | undefined,
  scripts: toolBlock.input.scripts as Record<string, string> | undefined,
  envVars: toolBlock.input.envVars as string[] | undefined,
})
```

This is a small, consistent extension of the existing pattern — not a new tool.

---

### 1. README Generation

**Change type:** Scaffold system prompt update only.

The `buildScaffoldPrompt` in `src/agent/system-prompt.ts` gets updated to instruct Claude to generate a comprehensive README.md via `add_integration`. This should be the **last** `add_integration` call, after deploy.sh and all other integrations, so the README can reference all generated files.

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
1. Start with `set -euo pipefail` to prevent silent failures
2. Check that the required CLI tool is installed (exit 1 with a helpful message if not)
3. Check authentication status (exit 1 with auth instructions if not)
4. Print what it's about to do
5. Execute the deploy command
6. Be simple — no elaborate bash framework

**`package.json` addition:**

```json
{
  "scripts": {
    "deploy": "bash deploy.sh"
  }
}
```

The script file is written via `add_integration`'s `files` property. The `scripts.deploy` entry is written via the new `scripts` property added in Section 0. The `bash deploy.sh` invocation means the file does not need the executable bit set — but the README should note that `npm run deploy` is the intended invocation.

`deploy.sh` should be committed to version control — it is generated project infrastructure, not a build artifact.

### 3. Deploy Readiness Check

**Change type:** New module `src/deploy/readiness.ts`.

After Phase 2 (scaffold) completes successfully, a lightweight readiness check runs before printing next steps.

**Interface:**

```typescript
export interface ReadinessResult {
  platform: string
  cliInstalled: boolean
  cliName: string
  authenticated: boolean | null  // null = cannot determine or timed out
  installCmd: string
  authCmd: string
  deployCmd: string
  envVarCmd: string             // platform command for setting env vars
}

export function checkDeployReadiness(
  deploymentComponent: string
): ReadinessResult
```

**Platform detection matrix:**

| Platform | CLI binary | Auth check command | Install command |
|----------|-----------|-------------------|-----------------|
| Vercel | `vercel` | `vercel whoami` | `npm i -g vercel` |
| AWS (general) | `aws` | `aws sts get-caller-identity` | See docs.aws.amazon.com |
| AWS Amplify | `amplify` | `amplify status` | `npm i -g @aws-amplify/cli` |
| AWS CDK | `cdk` | `aws sts get-caller-identity` | `npm i -g aws-cdk` |
| AWS SST | `npx sst` | `aws sts get-caller-identity` | (uses npx, no global install) |
| GCP | `gcloud` | `gcloud auth print-identity-token` | See cloud.google.com/sdk |
| Docker | `docker` | `docker info` | Platform-specific |
| Railway | `railway` | `railway whoami` | `npm i -g @railway/cli` |
| Fly.io | `fly` | `fly auth whoami` | See fly.io/docs |

**Behavior:**

- Uses `execFileSync` with `{ stdio: 'pipe', timeout: 5000 }` for both CLI presence and auth checks
- Error handling by error type:
  - **ENOENT** (binary not found): `cliInstalled: false`, `authenticated: null`
  - **Non-zero exit** (binary exists but auth failed): `cliInstalled: true`, `authenticated: false`
  - **Timeout** (command hung): `cliInstalled: true`, `authenticated: null` (indeterminate)
  - **Other errors**: `cliInstalled: true`, `authenticated: null`
- Never crashes the agent — all `execFileSync` calls are wrapped in try/catch
- Pure detection: never modifies system state, never writes files, never deploys
- Returns a structured result that the terminal output renderer consumes

**Mapping deployment component to platform:** The `deploymentComponent` string from progress is free-text (e.g., "Vercel", "AWS Lambda + API Gateway", "GCP Cloud Run", "Docker"). Normalization strategy:

1. Lowercase the component string
2. Check for keywords in priority order:
   - Contains `"amplify"` → AWS Amplify
   - Contains `"cdk"` → AWS CDK
   - Contains `"sst"` → AWS SST
   - Contains `"vercel"` → Vercel
   - Contains `"aws"` or `"lambda"` or `"ec2"` → AWS (general)
   - Contains `"gcp"` or `"google cloud"` or `"cloud run"` → GCP
   - Contains `"docker"` or `"container"` → Docker
   - Contains `"railway"` → Railway
   - Contains `"fly.io"` or equals `"fly"` or starts with `"fly "` → Fly.io
3. No match → return a fallback result with `cliInstalled: false`, `authenticated: null`, and a message pointing users to the README for deployment instructions

This keyword-based approach is simple and handles the common variations Claude might produce during conversation.

### 4. Enhanced Terminal Output

**Change type:** Updates to `src/cli/chat.ts` and `src/index.ts`.

**New function in `src/cli/chat.ts`:**

```typescript
export function renderPostScaffold(
  projectName: string,
  readiness: ReadinessResult | null
): void
```

When `readiness` is `null`, only the local development section is rendered (no deployment section).

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
  const readiness = progress.deployment
    ? checkDeployReadiness(progress.deployment.component)
    : null
  renderPostScaffold(progress.projectName!, readiness)
  outro('Happy building!')
}
```

If `progress.deployment` is null (unlikely — `isComplete()` requires it, but defensive against bugs where Claude finishes the scaffold loop without a deployment decision), the readiness check is skipped and only the local development section is rendered.

Uses existing `@clack/prompts` helpers (`p.log.step`, `p.log.info`, `p.log.warn`). No new dependencies.

**Note on `npm install`:** The `add_integration` tool merges dependencies into `package.json` but does not run `npm install`. The initial scaffold CLI (e.g., `create-next-app`) installs its own dependencies, but any dependencies added by subsequent `add_integration` calls will be missing from `node_modules`. The "Local Development" output must include `npm install` as a step. This is already reflected in the output mockups above.

## Files Changed

| File | Change |
|------|--------|
| `src/agent/tools.ts` | Add `scripts` property to `add_integration` input schema |
| `src/scaffold/integrate.ts` | Add `scripts` to `IntegrationInput`, merge into `package.json` |
| `src/agent/loop.ts` | Pass `scripts` from tool input through to `writeIntegration` |
| `src/agent/system-prompt.ts` | Update `buildScaffoldPrompt` — add README and deploy.sh generation instructions |
| `src/deploy/readiness.ts` | **New file** — deploy readiness check (~100-120 lines) |
| `src/cli/chat.ts` | Add `renderPostScaffold` function (~30-40 lines) |
| `src/index.ts` | Replace hardcoded next steps with readiness check + enhanced output; add imports for `checkDeployReadiness` and `renderPostScaffold` (~10 lines) |
| `tests/deploy/readiness.test.ts` | **New file** — tests for readiness check and platform normalization (see key test cases below) |
| `tests/scaffold/integrate.test.ts` | Add tests for `scripts` merging |

## Key Test Cases for Platform Normalization

The `tests/deploy/readiness.test.ts` file must cover these normalization scenarios:

| Input | Expected Platform |
|-------|------------------|
| `"Vercel"` | Vercel |
| `"AWS Lambda + API Gateway"` | AWS (general) |
| `"AWS Amplify"` | AWS Amplify (not general AWS — priority ordering) |
| `"AWS with CDK"` | AWS CDK |
| `"Docker"` | Docker |
| `"GCP Cloud Run"` | GCP |
| `"Google Cloud Run"` | GCP |
| `"Fly.io"` | Fly.io |
| `"Some Unknown Platform"` | Fallback |
| `"vercel"` (lowercase) | Vercel (case-insensitive) |

## Estimated Size

~150-180 lines of new runtime code. The system prompt updates are text changes that add ~20-30 lines of prompt instructions.
