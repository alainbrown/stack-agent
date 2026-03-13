import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { replaceTokens, findUnresolvedTokens } from '../utils/tokens.js'
import type { ModuleMetadata } from '../llm/schemas.js'

export async function applyModule(
  moduleDir: string,
  projectDir: string,
  tokenValues: Record<string, string>,
): Promise<string[]> {
  const metaRaw = await readFile(join(moduleDir, 'module.json'), 'utf-8')
  const meta: ModuleMetadata = JSON.parse(metaRaw)

  const allUnresolved: string[] = []

  // Copy and token-replace module files
  for (const [destRelative, srcRelative] of Object.entries(meta.files)) {
    const srcPath = join(moduleDir, srcRelative)
    const destPath = join(projectDir, destRelative)

    await mkdir(dirname(destPath), { recursive: true })

    const content = await readFile(srcPath, 'utf-8')
    const replaced = replaceTokens(content, tokenValues)
    const unresolved = findUnresolvedTokens(replaced)
    allUnresolved.push(...unresolved)

    await writeFile(destPath, replaced)
  }

  // Merge dependencies into package.json
  const pkgPath = join(projectDir, 'package.json')
  const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))

  if (Object.keys(meta.dependencies).length > 0) {
    pkg.dependencies = { ...pkg.dependencies, ...meta.dependencies }
  }

  if (Object.keys(meta.devDependencies).length > 0) {
    pkg.devDependencies = { ...pkg.devDependencies, ...meta.devDependencies }
  }

  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

  // Append env vars to .env.example
  if (meta.env.length > 0) {
    const envPath = join(projectDir, '.env.example')
    let existing = ''
    try {
      existing = await readFile(envPath, 'utf-8')
    } catch {
      // File doesn't exist yet — that's fine
    }

    const newVars = meta.env
      .map((v) => `${v}=`)
      .join('\n')

    const separator = existing && !existing.endsWith('\n') ? '\n' : ''
    await writeFile(envPath, existing + separator + newVars + '\n')
  }

  return [...new Set(allUnresolved)]
}
