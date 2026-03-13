import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs'
import { resolve, relative, dirname, isAbsolute } from 'node:path'

export interface IntegrationInput {
  files: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  envVars?: string[]
}

export function validateFilePaths(projectRoot: string, files: Record<string, string>): void {
  for (const filePath of Object.keys(files)) {
    if (isAbsolute(filePath)) {
      throw new Error(`File path must be relative, got: "${filePath}"`)
    }
    const resolved = resolve(projectRoot, filePath)
    const rel = relative(projectRoot, resolved)
    if (rel.startsWith('..')) {
      throw new Error(`File path "${filePath}" resolves outside project root`)
    }
  }
}

export function writeIntegration(projectDir: string, input: IntegrationInput): void {
  const { files, dependencies, devDependencies, envVars } = input

  // 1. Validate file paths
  validateFilePaths(projectDir, files)

  // 2. Write each file (create parent directories as needed)
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = resolve(projectDir, filePath)
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, content, 'utf8')
  }

  // 3. Merge dependencies into package.json if provided
  if (dependencies !== undefined || devDependencies !== undefined) {
    const pkgPath = resolve(projectDir, 'package.json')
    let pkg: Record<string, unknown> = {}
    if (existsSync(pkgPath)) {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>
    }

    if (dependencies !== undefined) {
      pkg.dependencies = {
        ...(pkg.dependencies as Record<string, string> | undefined),
        ...dependencies,
      }
    }

    if (devDependencies !== undefined) {
      pkg.devDependencies = {
        ...(pkg.devDependencies as Record<string, string> | undefined),
        ...devDependencies,
      }
    }

    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
  }

  // 4. Append env vars to .env.example (create if it doesn't exist)
  if (envVars !== undefined && envVars.length > 0) {
    const envPath = resolve(projectDir, '.env.example')
    const lines = envVars.map((v) => `${v}=`).join('\n') + '\n'
    appendFileSync(envPath, lines, 'utf8')
  }
}
