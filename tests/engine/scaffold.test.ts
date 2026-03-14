import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { scaffoldTemplate } from '../../src/engine/scaffold.js'
import { mkdtemp, rm, mkdir, writeFile, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('scaffoldTemplate', () => {
  let templateDir: string
  let outputDir: string

  beforeEach(async () => {
    templateDir = await mkdtemp(join(tmpdir(), 'template-'))
    outputDir = await mkdtemp(join(tmpdir(), 'output-'))

    // Create template.json
    await writeFile(
      join(templateDir, 'template.json'),
      JSON.stringify({
        name: 'test-template',
        description: 'A test template',
        tokens: ['PROJECT_NAME', 'DESCRIPTION'],
        compatibleModules: [],
      })
    )

    // Create a template file with tokens
    await writeFile(
      join(templateDir, 'README.md'),
      '# __PROJECT_NAME__\n\n__DESCRIPTION__'
    )

    // Create a nested file
    await mkdir(join(templateDir, 'src'), { recursive: true })
    await writeFile(
      join(templateDir, 'src', 'index.ts'),
      'console.log("__PROJECT_NAME__")'
    )
  })

  afterEach(async () => {
    await rm(templateDir, { recursive: true, force: true })
    await rm(outputDir, { recursive: true, force: true })
  })

  it('copies template files to output directory', async () => {
    await scaffoldTemplate(templateDir, outputDir, {
      PROJECT_NAME: 'my-app',
      DESCRIPTION: 'A cool app',
    })

    const readme = await readFile(join(outputDir, 'README.md'), 'utf-8')
    expect(readme).toBe('# my-app\n\nA cool app')
  })

  it('replaces tokens in nested files', async () => {
    await scaffoldTemplate(templateDir, outputDir, {
      PROJECT_NAME: 'my-app',
      DESCRIPTION: 'A cool app',
    })

    const index = await readFile(join(outputDir, 'src', 'index.ts'), 'utf-8')
    expect(index).toBe('console.log("my-app")')
  })

  it('does not copy template.json to output', async () => {
    await scaffoldTemplate(templateDir, outputDir, {
      PROJECT_NAME: 'my-app',
      DESCRIPTION: 'A cool app',
    })

    const files = await readdir(outputDir)
    expect(files).not.toContain('template.json')
  })

  it('returns warnings for unresolved tokens', async () => {
    await writeFile(
      join(templateDir, 'config.ts'),
      'const url = "__API_URL__"'
    )

    const warnings = await scaffoldTemplate(templateDir, outputDir, {
      PROJECT_NAME: 'my-app',
      DESCRIPTION: 'A cool app',
    })

    expect(warnings).toContain('__API_URL__')
  })
})
