import { execFileSync, type ExecFileSyncOptions } from 'node:child_process'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export function runScaffold(
  tool: string,
  args: string[],
  projectName: string,
  cwd: string,
): string {
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
