import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { replaceTokens, findUnresolvedTokens } from '../utils/tokens.js'

async function copyDir(
  src: string,
  dest: string,
  tokenValues: Record<string, string>,
  skip: string[],
): Promise<string[]> {
  const allUnresolved: string[] = []
  await mkdir(dest, { recursive: true })

  const entries = await readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    if (skip.includes(entry.name)) continue

    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)

    if (entry.isDirectory()) {
      const nested = await copyDir(srcPath, destPath, tokenValues, skip)
      allUnresolved.push(...nested)
    } else {
      const content = await readFile(srcPath, 'utf-8')
      const replaced = replaceTokens(content, tokenValues)
      const unresolved = findUnresolvedTokens(replaced)
      allUnresolved.push(...unresolved)
      await writeFile(destPath, replaced)
    }
  }

  return allUnresolved
}

export async function scaffoldTemplate(
  templateDir: string,
  outputDir: string,
  tokenValues: Record<string, string>,
): Promise<string[]> {
  const warnings = await copyDir(templateDir, outputDir, tokenValues, ['template.json'])
  return [...new Set(warnings)]
}
