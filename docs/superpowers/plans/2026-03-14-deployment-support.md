# Deployment Support Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deploy readiness checks, deploy script generation, README generation, and enhanced post-scaffold output so users can deploy their scaffolded apps with a single command.

**Architecture:** Extend the existing `add_integration` tool with `scripts` merging, update the scaffold system prompt to instruct Claude to generate `deploy.sh` and `README.md`, add a new `src/deploy/readiness.ts` module for CLI detection, and replace the hardcoded post-scaffold output in `src/index.ts` with a readiness-aware renderer.

**Tech Stack:** TypeScript, Node.js `child_process` (execFileSync), vitest, @clack/prompts

**Spec:** `docs/superpowers/specs/2026-03-14-deployment-support-design.md`

---

## Chunk 1: Extend `add_integration` with `scripts` Merging

### Task 1: Add `scripts` merging to `writeIntegration`

**Files:**
- Modify: `src/scaffold/integrate.ts:4-9` (IntegrationInput interface)
- Modify: `src/scaffold/integrate.ts:24-60` (writeIntegration function)
- Test: `tests/scaffold/integrate.test.ts`

- [ ] **Step 1: Write failing test — scripts merging into existing package.json**

Add to `tests/scaffold/integrate.test.ts` inside the `writeIntegration` describe block:

```typescript
it('merges scripts into package.json', () => {
  const pkgPath = join(projectDir, 'package.json')
  writeFileSync(
    pkgPath,
    JSON.stringify({ name: 'test-app', scripts: { dev: 'next dev' } }, null, 2),
    'utf8',
  )

  writeIntegration(projectDir, {
    files: {},
    scripts: { deploy: 'bash deploy.sh' },
  })

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
    scripts: Record<string, string>
  }
  expect(pkg.scripts['dev']).toBe('next dev')
  expect(pkg.scripts['deploy']).toBe('bash deploy.sh')
})
```

- [ ] **Step 2: Write failing test — scripts-only call (no dependencies) still writes package.json**

```typescript
it('writes scripts to package.json even when no dependencies are provided', () => {
  const pkgPath = join(projectDir, 'package.json')
  writeFileSync(pkgPath, JSON.stringify({ name: 'test-app' }, null, 2), 'utf8')

  writeIntegration(projectDir, {
    files: {},
    scripts: { deploy: 'bash deploy.sh' },
  })

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
    scripts: Record<string, string>
  }
  expect(pkg.scripts['deploy']).toBe('bash deploy.sh')
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/scaffold/integrate.test.ts`
Expected: 2 FAIL — `scripts` not recognized by TypeScript / not processed

- [ ] **Step 4: Add `scripts` to `IntegrationInput` and `writeIntegration`**

In `src/scaffold/integrate.ts`:

Change the `IntegrationInput` interface to:
```typescript
export interface IntegrationInput {
  files: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  scripts?: Record<string, string>
  envVars?: string[]
}
```

Change the destructuring on line 25 to:
```typescript
const { files, dependencies, devDependencies, scripts, envVars } = input
```

Change the guard condition on line 38 to:
```typescript
if (dependencies !== undefined || devDependencies !== undefined || scripts !== undefined) {
```

Add scripts merging after the `devDependencies` block (after line 57, before `writeFileSync`):
```typescript
    if (scripts !== undefined) {
      pkg.scripts = {
        ...(pkg.scripts as Record<string, string> | undefined),
        ...scripts,
      }
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/scaffold/integrate.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/scaffold/integrate.ts tests/scaffold/integrate.test.ts
git commit -m "feat: add scripts merging to writeIntegration"
```

---

### Task 2: Add `scripts` to `add_integration` tool schema and loop passthrough

**Files:**
- Modify: `src/agent/tools.ts:119-149` (add_integration schema)
- Modify: `src/agent/loop.ts:259-268` (writeIntegration call)
- Test: `tests/agent/tools.test.ts`

- [ ] **Step 1: Write failing test — add_integration schema includes scripts property**

Add to `tests/agent/tools.test.ts` inside the `scaffoldToolDefinitions` describe block:

```typescript
it('add_integration schema includes scripts property', () => {
  const tools = scaffoldToolDefinitions()
  const addIntegration = tools.find((t) => t.name === 'add_integration')!
  const properties = addIntegration.input_schema.properties as Record<string, unknown>
  expect(properties).toHaveProperty('scripts')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/agent/tools.test.ts`
Expected: FAIL — `scripts` not in schema

- [ ] **Step 3: Add `scripts` to tool schema and loop passthrough**

In `src/agent/tools.ts`, add inside the `add_integration` `properties` object (after `devDependencies`, before `envVars`):

```typescript
          scripts: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'Map of script names to commands to merge into package.json scripts.',
          },
```

In `src/agent/loop.ts`, change the `writeIntegration` call (lines 259-268) to:

```typescript
          writeIntegration(projectDir, {
            files: (toolBlock.input.files as Record<string, string>) ?? {},
            dependencies: toolBlock.input.dependencies as
              | Record<string, string>
              | undefined,
            devDependencies: toolBlock.input.devDependencies as
              | Record<string, string>
              | undefined,
            scripts: toolBlock.input.scripts as
              | Record<string, string>
              | undefined,
            envVars: toolBlock.input.envVars as string[] | undefined,
          })
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/agent/tools.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/agent/tools.ts src/agent/loop.ts tests/agent/tools.test.ts
git commit -m "feat: add scripts property to add_integration tool schema"
```

---

## Chunk 2: Deploy Readiness Check

### Task 3: Platform normalization logic

**Files:**
- Create: `src/deploy/readiness.ts`
- Create: `tests/deploy/readiness.test.ts`

- [ ] **Step 1: Write failing tests for platform normalization**

Create `tests/deploy/readiness.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { normalizePlatform, type PlatformConfig } from '../../src/deploy/readiness.js'

describe('normalizePlatform', () => {
  it('maps "Vercel" to vercel platform', () => {
    const result = normalizePlatform('Vercel')
    expect(result.platform).toBe('Vercel')
    expect(result.cliName).toBe('vercel')
  })

  it('maps "vercel" (lowercase) to vercel platform', () => {
    const result = normalizePlatform('vercel')
    expect(result.platform).toBe('Vercel')
  })

  it('maps "AWS Lambda + API Gateway" to AWS (general)', () => {
    const result = normalizePlatform('AWS Lambda + API Gateway')
    expect(result.platform).toBe('AWS')
    expect(result.cliName).toBe('aws')
  })

  it('maps "AWS Amplify" to AWS Amplify (not general AWS)', () => {
    const result = normalizePlatform('AWS Amplify')
    expect(result.platform).toBe('AWS Amplify')
    expect(result.cliName).toBe('amplify')
  })

  it('maps "AWS with CDK" to AWS CDK', () => {
    const result = normalizePlatform('AWS with CDK')
    expect(result.platform).toBe('AWS CDK')
    expect(result.cliName).toBe('cdk')
  })

  it('maps "Docker" to Docker', () => {
    const result = normalizePlatform('Docker')
    expect(result.platform).toBe('Docker')
    expect(result.cliName).toBe('docker')
  })

  it('maps "GCP Cloud Run" to GCP', () => {
    const result = normalizePlatform('GCP Cloud Run')
    expect(result.platform).toBe('GCP')
    expect(result.cliName).toBe('gcloud')
  })

  it('maps "Google Cloud Run" to GCP', () => {
    const result = normalizePlatform('Google Cloud Run')
    expect(result.platform).toBe('GCP')
    expect(result.cliName).toBe('gcloud')
  })

  it('maps "Fly.io" to Fly.io', () => {
    const result = normalizePlatform('Fly.io')
    expect(result.platform).toBe('Fly.io')
    expect(result.cliName).toBe('fly')
  })

  it('maps "Railway" to Railway', () => {
    const result = normalizePlatform('Railway')
    expect(result.platform).toBe('Railway')
    expect(result.cliName).toBe('railway')
  })

  it('maps "SST on AWS" to AWS SST', () => {
    const result = normalizePlatform('SST on AWS')
    expect(result.platform).toBe('AWS SST')
    expect(result.cliName).toBe('sst')
  })

  it('returns fallback for unknown platform', () => {
    const result = normalizePlatform('Some Unknown Platform')
    expect(result.platform).toBe('Unknown')
    expect(result.cliName).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/deploy/readiness.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Implement `normalizePlatform` and `PlatformConfig`**

Create the `src/deploy/` directory first: `mkdir -p src/deploy`

Create `src/deploy/readiness.ts`:

```typescript
import { execFileSync } from 'node:child_process'

export interface PlatformConfig {
  platform: string
  cliName: string
  cliBinary: string
  authCheckCmd: string[]
  installCmd: string
  authCmd: string
  deployCmd: string
  envVarCmd: string
}

export interface ReadinessResult {
  platform: string
  cliInstalled: boolean
  cliName: string
  authenticated: boolean | null
  installCmd: string
  authCmd: string
  deployCmd: string
  envVarCmd: string
}

const PLATFORMS: PlatformConfig[] = [
  {
    platform: 'AWS Amplify',
    cliName: 'amplify',
    cliBinary: 'amplify',
    authCheckCmd: ['amplify', 'status'],
    installCmd: 'npm i -g @aws-amplify/cli',
    authCmd: 'amplify configure',
    deployCmd: 'npm run deploy',
    envVarCmd: 'See AWS Amplify console for environment variables',
  },
  {
    platform: 'AWS CDK',
    cliName: 'cdk',
    cliBinary: 'cdk',
    authCheckCmd: ['aws', 'sts', 'get-caller-identity'],
    installCmd: 'npm i -g aws-cdk',
    authCmd: 'aws configure',
    deployCmd: 'npm run deploy',
    envVarCmd: 'aws ssm put-parameter --name KEY --value VAL --type String',
  },
  {
    platform: 'AWS SST',
    cliName: 'sst',
    cliBinary: 'npx',
    authCheckCmd: ['aws', 'sts', 'get-caller-identity'],
    installCmd: '(uses npx — no global install needed)',
    authCmd: 'aws configure',
    deployCmd: 'npm run deploy',
    envVarCmd: 'aws ssm put-parameter --name KEY --value VAL --type String',
  },
  {
    platform: 'Vercel',
    cliName: 'vercel',
    cliBinary: 'vercel',
    authCheckCmd: ['vercel', 'whoami'],
    installCmd: 'npm i -g vercel',
    authCmd: 'vercel login',
    deployCmd: 'npm run deploy',
    envVarCmd: 'vercel env add',
  },
  {
    platform: 'AWS',
    cliName: 'aws',
    cliBinary: 'aws',
    authCheckCmd: ['aws', 'sts', 'get-caller-identity'],
    installCmd: 'See https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html',
    authCmd: 'aws configure',
    deployCmd: 'npm run deploy',
    envVarCmd: 'aws ssm put-parameter --name KEY --value VAL --type String',
  },
  {
    platform: 'GCP',
    cliName: 'gcloud',
    cliBinary: 'gcloud',
    authCheckCmd: ['gcloud', 'auth', 'print-identity-token'],
    installCmd: 'See https://cloud.google.com/sdk/docs/install',
    authCmd: 'gcloud auth login',
    deployCmd: 'npm run deploy',
    envVarCmd: 'gcloud run services update SERVICE --set-env-vars KEY=VAL',
  },
  {
    platform: 'Docker',
    cliName: 'docker',
    cliBinary: 'docker',
    authCheckCmd: ['docker', 'info'],
    installCmd: 'See https://docs.docker.com/get-docker/',
    authCmd: 'docker login',
    deployCmd: 'npm run deploy',
    envVarCmd: 'Set variables in docker-compose.yml or .env',
  },
  {
    platform: 'Railway',
    cliName: 'railway',
    cliBinary: 'railway',
    authCheckCmd: ['railway', 'whoami'],
    installCmd: 'npm i -g @railway/cli',
    authCmd: 'railway login',
    deployCmd: 'npm run deploy',
    envVarCmd: 'railway variables set KEY=VAL',
  },
  {
    platform: 'Fly.io',
    cliName: 'fly',
    cliBinary: 'fly',
    authCheckCmd: ['fly', 'auth', 'whoami'],
    installCmd: 'See https://fly.io/docs/flyctl/install/',
    authCmd: 'fly auth login',
    deployCmd: 'npm run deploy',
    envVarCmd: 'fly secrets set KEY=VAL',
  },
]

const KEYWORD_MATCHERS: Array<{ test: (s: string) => boolean; platform: PlatformConfig }> = (() => {
  const byPlatform = (name: string) => PLATFORMS.find((p) => p.platform === name)!
  return [
    { test: (s) => s.includes('amplify'), platform: byPlatform('AWS Amplify') },
    { test: (s) => s.includes('cdk'), platform: byPlatform('AWS CDK') },
    { test: (s) => s.includes('sst'), platform: byPlatform('AWS SST') },
    { test: (s) => s.includes('vercel'), platform: byPlatform('Vercel') },
    { test: (s) => s.includes('aws') || s.includes('lambda') || s.includes('ec2'), platform: byPlatform('AWS') },
    { test: (s) => s.includes('gcp') || s.includes('google cloud') || s.includes('cloud run'), platform: byPlatform('GCP') },
    { test: (s) => s.includes('docker') || s.includes('container'), platform: byPlatform('Docker') },
    { test: (s) => s.includes('railway'), platform: byPlatform('Railway') },
    { test: (s) => s.includes('fly.io') || s === 'fly' || s.startsWith('fly '), platform: byPlatform('Fly.io') },
  ]
})()

const FALLBACK_CONFIG: PlatformConfig = {
  platform: 'Unknown',
  cliName: '',
  cliBinary: '',
  authCheckCmd: [],
  installCmd: '',
  authCmd: '',
  deployCmd: 'npm run deploy',
  envVarCmd: 'See README.md for environment variable instructions',
}

export function normalizePlatform(deploymentComponent: string): PlatformConfig {
  const lower = deploymentComponent.toLowerCase()
  for (const matcher of KEYWORD_MATCHERS) {
    if (matcher.test(lower)) {
      return matcher.platform
    }
  }
  return FALLBACK_CONFIG
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/deploy/readiness.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/deploy/readiness.ts tests/deploy/readiness.test.ts
git commit -m "feat: add platform normalization for deploy readiness"
```

---

### Task 4: CLI detection and auth check logic

**Files:**
- Modify: `src/deploy/readiness.ts` (add `checkDeployReadiness`)
- Modify: `tests/deploy/readiness.test.ts`

- [ ] **Step 1: Write failing tests for `checkDeployReadiness`**

Add to `tests/deploy/readiness.test.ts`. Update the import at the top of the file to:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { normalizePlatform, checkDeployReadiness, type PlatformConfig, type ReadinessResult } from '../../src/deploy/readiness.js'
import * as childProcess from 'node:child_process'
```

Then add the test block:

```typescript
describe('checkDeployReadiness', () => {
  it('returns a ReadinessResult with all required fields', () => {
    const result = checkDeployReadiness('Vercel')
    expect(result).toHaveProperty('platform')
    expect(result).toHaveProperty('cliInstalled')
    expect(result).toHaveProperty('cliName')
    expect(result).toHaveProperty('authenticated')
    expect(result).toHaveProperty('installCmd')
    expect(result).toHaveProperty('authCmd')
    expect(result).toHaveProperty('deployCmd')
    expect(result).toHaveProperty('envVarCmd')
  })

  it('returns fallback result for unknown platform', () => {
    const result = checkDeployReadiness('Some Unknown Platform')
    expect(result.platform).toBe('Unknown')
    expect(result.cliInstalled).toBe(false)
    expect(result.authenticated).toBeNull()
  })

  it('sets deployCmd to npm run deploy', () => {
    const result = checkDeployReadiness('Vercel')
    expect(result.deployCmd).toBe('npm run deploy')
  })

  describe('with mocked execFileSync', () => {
    let execSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      execSpy = vi.spyOn(childProcess, 'execFileSync')
    })

    afterEach(() => {
      execSpy.mockRestore()
    })

    it('reports cliInstalled=true and authenticated=true when both succeed', () => {
      execSpy.mockReturnValue(Buffer.from(''))
      const result = checkDeployReadiness('Vercel')
      expect(result.cliInstalled).toBe(true)
      expect(result.authenticated).toBe(true)
    })

    it('reports cliInstalled=false when which throws ENOENT', () => {
      const err = new Error('not found') as NodeJS.ErrnoException
      err.code = 'ENOENT'
      execSpy.mockImplementation(() => { throw err })
      const result = checkDeployReadiness('Vercel')
      expect(result.cliInstalled).toBe(false)
      expect(result.authenticated).toBeNull()
    })

    it('reports authenticated=false when auth check exits non-zero', () => {
      // First call (which) succeeds, second call (auth) fails with non-zero exit
      let callCount = 0
      execSpy.mockImplementation(() => {
        callCount++
        if (callCount === 1) return Buffer.from('')
        const err = new Error('auth failed') as NodeJS.ErrnoException & { status: number }
        err.status = 1
        throw err
      })
      const result = checkDeployReadiness('Vercel')
      expect(result.cliInstalled).toBe(true)
      expect(result.authenticated).toBe(false)
    })

    it('reports authenticated=null when auth check times out', () => {
      let callCount = 0
      execSpy.mockImplementation(() => {
        callCount++
        if (callCount === 1) return Buffer.from('')
        const err = new Error('timed out') as NodeJS.ErrnoException
        err.code = 'ETIMEDOUT'
        throw err
      })
      const result = checkDeployReadiness('Vercel')
      expect(result.cliInstalled).toBe(true)
      expect(result.authenticated).toBeNull()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/deploy/readiness.test.ts`
Expected: FAIL — `checkDeployReadiness` not exported

- [ ] **Step 3: Implement `checkDeployReadiness`**

Add to `src/deploy/readiness.ts`:

```typescript
function isCliInstalled(binary: string): boolean {
  try {
    execFileSync('which', [binary], { stdio: 'pipe', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

// Note: `which` is Unix-only. This tool targets Unix-like systems (deploy scripts use bash).
function checkAuth(cmd: string[]): boolean | null {
  if (cmd.length === 0) return null
  try {
    execFileSync(cmd[0], cmd.slice(1), { stdio: 'pipe', timeout: 5000 })
    return true
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException
    if (nodeErr.code === 'ENOENT' || nodeErr.code === 'ETIMEDOUT') {
      // Binary not found or command timed out = indeterminate
      return null
    }
    // Non-zero exit or other failure = auth check failed
    return false
  }
}

export function checkDeployReadiness(deploymentComponent: string): ReadinessResult {
  const config = normalizePlatform(deploymentComponent)

  if (config.platform === 'Unknown' || config.cliBinary === '') {
    return {
      platform: config.platform,
      cliInstalled: false,
      cliName: config.cliName,
      authenticated: null,
      installCmd: config.installCmd,
      authCmd: config.authCmd,
      deployCmd: config.deployCmd,
      envVarCmd: config.envVarCmd,
    }
  }

  const cliInstalled = isCliInstalled(config.cliBinary)

  let authenticated: boolean | null = null
  if (cliInstalled) {
    authenticated = checkAuth(config.authCheckCmd)
  }

  return {
    platform: config.platform,
    cliInstalled,
    cliName: config.cliName,
    authenticated,
    installCmd: config.installCmd,
    authCmd: config.authCmd,
    deployCmd: config.deployCmd,
    envVarCmd: config.envVarCmd,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/deploy/readiness.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/deploy/readiness.ts tests/deploy/readiness.test.ts
git commit -m "feat: add checkDeployReadiness with CLI detection and auth checks"
```

---

## Chunk 3: Enhanced Terminal Output and Integration

### Task 5: Add `renderPostScaffold` to CLI chat module

**Files:**
- Modify: `src/cli/chat.ts`

- [ ] **Step 1: Add `renderPostScaffold` function**

First, add the following import to the top of `src/cli/chat.ts`, after the existing imports (after line 3):

```typescript
import type { ReadinessResult } from '../deploy/readiness.js'
```

Then add the following function to the bottom of `src/cli/chat.ts`:

```typescript
export function renderPostScaffold(
  projectName: string,
  readiness: ReadinessResult | null,
): void {
  const localSteps = [
    `cd ${projectName}`,
    'cp .env.example .env   # fill in your values',
    'npm install',
    'npm run dev',
  ]
  p.log.step('Local Development\n  ' + localSteps.join('\n  '))

  if (readiness === null) return

  const lines: string[] = []

  if (readiness.cliInstalled && readiness.authenticated === true) {
    lines.push('\u2713 Ready to deploy')
    lines.push(`\u2192 ${readiness.deployCmd}`)
  } else if (!readiness.cliInstalled) {
    lines.push(`\u2717 ${readiness.cliName || 'CLI'} not found`)
    if (readiness.installCmd) lines.push(`  Install: ${readiness.installCmd}`)
    if (readiness.authCmd) lines.push(`  Then: ${readiness.authCmd}`)
    lines.push(`  Then: ${readiness.deployCmd}`)
  } else {
    // CLI installed but not authenticated (or indeterminate)
    lines.push(`\u2713 ${readiness.cliName} CLI installed`)
    if (readiness.authenticated === false) {
      lines.push(`\u2717 Not authenticated`)
      lines.push(`  Run: ${readiness.authCmd}`)
    } else {
      lines.push('? Authentication status unknown')
      lines.push(`  Try: ${readiness.authCmd}`)
    }
    lines.push(`  Then: ${readiness.deployCmd}`)
  }

  lines.push('')
  if (readiness.envVarCmd) {
    lines.push(`\u2139 Set production env vars with: ${readiness.envVarCmd}`)
  }
  lines.push('\u2139 See README.md \u2192 Deployment for full instructions')

  p.log.info(`Deployment (${readiness.platform})\n  ${lines.join('\n  ')}`)
}
```

Note: the import for `ReadinessResult` must be added at the top of the file.

- [ ] **Step 2: Verify build succeeds**

Run: `npx tsup`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add src/cli/chat.ts
git commit -m "feat: add renderPostScaffold for deployment readiness output"
```

---

### Task 6: Wire up readiness check and enhanced output in `src/index.ts`

**Files:**
- Modify: `src/index.ts:1-3` (imports)
- Modify: `src/index.ts:29-35` (success block)

- [ ] **Step 1: Update imports**

Change line 2 of `src/index.ts` from:

```typescript
import { intro, outro, renderError } from './cli/chat.js'
```

to:

```typescript
import { intro, outro, renderError, renderPostScaffold } from './cli/chat.js'
import { checkDeployReadiness } from './deploy/readiness.js'
```

- [ ] **Step 2: Replace the success block**

Change the success block (lines 29-35) from:

```typescript
  if (success) {
    const nextSteps = [`cd ${progress.projectName}`]
    nextSteps.push('cp .env.example .env  # fill in your values')
    nextSteps.push('npm run dev')

    p.log.step('Next steps:\n  ' + nextSteps.join('\n  '))
    outro('Happy building!')
  }
```

to:

```typescript
  if (success) {
    const readiness = progress.deployment
      ? checkDeployReadiness(progress.deployment.component)
      : null
    renderPostScaffold(progress.projectName!, readiness)
    outro('Happy building!')
  }
```

- [ ] **Step 3: Remove unused `p` import if no longer needed**

Check if `p` (from `@clack/prompts`) is still used directly in `src/index.ts`. After this change, `p.confirm` is still used on line 17, so keep the import.

- [ ] **Step 4: Verify build succeeds**

Run: `npx tsup`
Expected: Build succeeds with no errors

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire up deploy readiness check in post-scaffold output"
```

---

## Chunk 4: Scaffold System Prompt Updates

### Task 7: Update `buildScaffoldPrompt` for deploy.sh and README generation

**Files:**
- Modify: `src/agent/system-prompt.ts:23-36` (buildScaffoldPrompt)
- Test: `tests/agent/system-prompt.test.ts`

- [ ] **Step 1: Write failing test — scaffold prompt mentions deploy.sh and README**

Check the existing test file first. The existing file defines a `makeFullProgress()` helper — use it for consistency. Add to `tests/agent/system-prompt.test.ts` inside the existing `buildScaffoldPrompt` describe block:

```typescript
  it('instructs Claude to generate deploy.sh', () => {
    const prompt = buildScaffoldPrompt(makeFullProgress())
    expect(prompt).toContain('deploy.sh')
    expect(prompt).toContain('set -euo pipefail')
  })

  it('instructs Claude to generate README.md', () => {
    const prompt = buildScaffoldPrompt(makeFullProgress())
    expect(prompt).toContain('README.md')
    expect(prompt).toContain('Environment variables')
    expect(prompt).toContain('.env')
  })

  it('instructs Claude to use scripts property for npm run deploy', () => {
    const prompt = buildScaffoldPrompt(makeFullProgress())
    expect(prompt).toContain('scripts')
    expect(prompt).toContain('npm run deploy')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/agent/system-prompt.test.ts`
Expected: FAIL — prompt does not contain these strings

- [ ] **Step 3: Update `buildScaffoldPrompt`**

Replace the `buildScaffoldPrompt` function in `src/agent/system-prompt.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/agent/system-prompt.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Verify build**

Run: `npx tsup`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/agent/system-prompt.ts tests/agent/system-prompt.test.ts
git commit -m "feat: update scaffold prompt for deploy.sh and README generation"
```

---

## Chunk 5: Final Verification

### Task 8: Full build and test verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS — no regressions

- [ ] **Step 2: Run build**

Run: `npx tsup`
Expected: Build succeeds, `dist/index.js` generated

- [ ] **Step 3: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Final commit (if any fixes needed)**

Only commit if Steps 1-3 required fixes. Otherwise, no commit needed.
