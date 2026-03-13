import * as p from '@clack/prompts'
import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectRequirements } from '../cli/prompts.js'
import { planStack } from '../llm/planner.js'
import { scaffoldTemplate } from '../engine/scaffold.js'
import { applyModule } from '../engine/modules.js'
import { installDependencies } from '../engine/deps.js'
import type { TemplateMetadata, ModuleMetadata } from '../llm/schemas.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

function getProjectRoot(): string {
  // In dist (tsup bundles to dist/index.js): __dirname = dist/ → ../ = project root
  // In dev (tsx src/commands/init.ts): __dirname = src/commands/ → ../../ = project root
  const distRoot = resolve(__dirname, '..')
  if (existsSync(join(distRoot, 'templates'))) return distRoot
  return resolve(__dirname, '..', '..')
}

async function loadTemplates(rootDir: string): Promise<TemplateMetadata[]> {
  const templatesDir = join(rootDir, 'templates')
  const entries = await readdir(templatesDir, { withFileTypes: true })
  const templates: TemplateMetadata[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const metaPath = join(templatesDir, entry.name, 'template.json')
    const raw = await readFile(metaPath, 'utf-8')
    templates.push(JSON.parse(raw))
  }

  return templates
}

async function loadModules(rootDir: string): Promise<ModuleMetadata[]> {
  const modulesDir = join(rootDir, 'modules')
  const entries = await readdir(modulesDir, { withFileTypes: true })
  const modules: ModuleMetadata[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const metaPath = join(modulesDir, entry.name, 'module.json')
    const raw = await readFile(metaPath, 'utf-8')
    modules.push(JSON.parse(raw))
  }

  return modules
}

export async function runInit(): Promise<void> {
  p.intro('create-stack')

  const requirements = await collectRequirements()
  const outputDir = resolve(process.cwd(), requirements.projectName)

  const rootDir = getProjectRoot()
  const templates = await loadTemplates(rootDir)
  const modules = await loadModules(rootDir)

  const spinner = p.spinner()

  spinner.start('Planning your stack with AI...')
  let decision
  try {
    decision = await planStack(requirements, templates, modules)
  } catch (err) {
    spinner.stop('Planning failed')
    p.log.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
  spinner.stop('Stack planned')

  p.log.info(`Recommended stack:
  Frontend:   ${decision.frontend}
  Backend:    ${decision.backend}
  Database:   ${decision.database}
  Auth:       ${decision.auth}
  Deployment: ${decision.deployment}
  Template:   ${decision.template}
  Modules:    ${decision.modules.join(', ') || 'none'}

${decision.reasoning}`)

  const confirmed = await p.confirm({
    message: 'Proceed with this stack?',
  })

  if (p.isCancel(confirmed) || !confirmed) {
    p.outro('No problem — run create-stack again to start over.')
    return
  }

  // Scaffold template
  const templateDir = join(rootDir, 'templates', decision.template)
  const tokenValues = {
    PROJECT_NAME: requirements.projectName,
    DESCRIPTION: requirements.description,
  }

  spinner.start('Scaffolding project...')
  const scaffoldWarnings = await scaffoldTemplate(templateDir, outputDir, tokenValues)
  spinner.stop('Project scaffolded')

  if (scaffoldWarnings.length > 0) {
    p.log.warn(`Unresolved tokens found: ${scaffoldWarnings.join(', ')}`)
  }

  // Apply modules
  for (const moduleName of decision.modules) {
    const moduleDir = join(rootDir, 'modules', moduleName)
    spinner.start(`Applying module: ${moduleName}...`)
    const moduleWarnings = await applyModule(moduleDir, outputDir, tokenValues)
    spinner.stop(`Module applied: ${moduleName}`)

    if (moduleWarnings.length > 0) {
      p.log.warn(`Unresolved tokens in ${moduleName}: ${moduleWarnings.join(', ')}`)
    }
  }

  // Install dependencies
  spinner.start('Installing dependencies...')
  try {
    await installDependencies(outputDir)
    spinner.stop('Dependencies installed')
  } catch (err) {
    spinner.stop('Dependency installation failed')
    p.log.error(
      'Failed to install dependencies. You can install them manually:\n' +
      `  cd ${requirements.projectName}\n  npm install`
    )
  }

  // Collect env vars from applied modules
  const envVars = decision.modules.flatMap((modName) => {
    const mod = modules.find((m) => m.name === modName)
    return mod ? mod.env : []
  })

  const nextSteps = [`cd ${requirements.projectName}`]
  if (envVars.length > 0) {
    nextSteps.push('cp .env.example .env  # fill in your values')
  }
  nextSteps.push('npm run dev')

  p.log.step('Next steps:\n  ' + nextSteps.join('\n  '))
  p.outro('Happy building!')
}
