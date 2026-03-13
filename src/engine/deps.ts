import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

const lockfiles: [string, PackageManager][] = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lockb', 'bun'],
]

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function detectPackageManager(
  cwd: string,
): Promise<PackageManager> {
  for (const [lockfile, pm] of lockfiles) {
    if (await fileExists(join(cwd, lockfile))) {
      return pm
    }
  }
  return 'npm'
}

export async function installDependencies(projectDir: string): Promise<void> {
  const pm = await detectPackageManager(process.cwd())
  execSync(`${pm} install`, {
    cwd: projectDir,
    stdio: 'inherit',
  })
}
