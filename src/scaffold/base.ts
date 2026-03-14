import { execFileSync, type ExecFileSyncOptions } from 'node:child_process'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const TOOL_ALLOWLIST = new Set([
  'create-next-app',
  'create-vite',
  'create-remix',
  'create-svelte',
  'create-astro',
  'nuxi',
])

// Per-tool allowlists of safe flags (without values; bare flags only for most tools)
const TOOL_FLAG_ALLOWLISTS: Record<string, Set<string>> = {
  'create-next-app': new Set([
    '--typescript',
    '--js',
    '--tailwind',
    '--no-tailwind',
    '--eslint',
    '--no-eslint',
    '--app',
    '--src-dir',
    '--no-src-dir',
    '--import-alias',
    '--use-npm',
    '--use-pnpm',
    '--use-yarn',
    '--use-bun',
  ]),
  'create-vite': new Set(['--template']),
}

const URL_SCHEME_RE = /https?:|git\+|file:/i
const SHELL_META_RE = /[;&|`$(){}[\]<>!#~*?\n\r]/
const WHITESPACE_RE = /\s/

export function validateScaffoldTool(tool: string, approvedTool: string): void {
  if (!TOOL_ALLOWLIST.has(tool)) {
    throw new Error(`Scaffold tool not in allowlist: "${tool}"`)
  }
  if (tool !== approvedTool) {
    throw new Error(`Scaffold tool "${tool}" does not match approved tool "${approvedTool}"`)
  }
}

export function validateScaffoldArgs(tool: string, args: string[]): void {
  const strictAllowlist = TOOL_FLAG_ALLOWLISTS[tool]

  for (const arg of args) {
    if (URL_SCHEME_RE.test(arg)) {
      throw new Error(`Scaffold arg contains a URL scheme: "${arg}"`)
    }
    if (WHITESPACE_RE.test(arg)) {
      throw new Error(`Scaffold arg contains whitespace: "${arg}"`)
    }
    if (SHELL_META_RE.test(arg)) {
      throw new Error(`Scaffold arg contains shell metacharacters: "${arg}"`)
    }

    if (strictAllowlist !== undefined) {
      // For tools with strict allowlists, flag names must be in the set.
      // Values that follow a flag (i.e. don't start with --) are checked for
      // dangerous patterns above, but are otherwise permitted so that flags
      // like --template react-ts or --import-alias @/* can work.
      const isFlag = arg.startsWith('--')
      if (isFlag && !strictAllowlist.has(arg)) {
        throw new Error(`Scaffold arg "${arg}" is not in the allowlist for tool "${tool}"`)
      }
      // Non-flag values (template values, alias values, etc.) pass through
      // as long as they are not dangerous.
    } else {
      // For other tools: only flags starting with -- are permitted
      if (!arg.startsWith('--')) {
        throw new Error(
          `Scaffold arg "${arg}" must start with "--" for tool "${tool}"`,
        )
      }
    }
  }
}

export function runScaffold(
  tool: string,
  args: string[],
  approvedTool: string,
  projectName: string,
  cwd: string,
): string {
  validateScaffoldTool(tool, approvedTool)
  validateScaffoldArgs(tool, args)

  const outputDir = join(cwd, projectName)

  if (existsSync(outputDir)) {
    const entries = readdirSync(outputDir)
    if (entries.length > 0) {
      throw new Error(
        `Output directory "${outputDir}" already exists and is not empty`,
      )
    }
  }

  const spawnArgs = [`${tool}@latest`, projectName, ...args]
  const opts: ExecFileSyncOptions = { cwd, stdio: 'pipe' }

  execFileSync('npx', spawnArgs, opts)

  return outputDir
}
