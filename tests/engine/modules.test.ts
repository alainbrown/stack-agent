import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { applyModule } from '../../src/engine/modules.js'
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('applyModule', () => {
  let moduleDir: string
  let projectDir: string

  beforeEach(async () => {
    moduleDir = await mkdtemp(join(tmpdir(), 'module-'))
    projectDir = await mkdtemp(join(tmpdir(), 'project-'))

    // Create module.json
    await writeFile(
      join(moduleDir, 'module.json'),
      JSON.stringify({
        name: 'auth-supabase',
        dependencies: { '@supabase/supabase-js': '^2.0.0' },
        devDependencies: {},
        env: ['SUPABASE_URL', 'SUPABASE_KEY'],
        files: {
          'lib/auth.ts': 'files/auth.ts',
          'middleware.ts': 'files/middleware.ts',
        },
      })
    )

    // Create module files
    await mkdir(join(moduleDir, 'files'), { recursive: true })
    await writeFile(
      join(moduleDir, 'files', 'auth.ts'),
      'export const auth = "__PROJECT_NAME__"'
    )
    await writeFile(
      join(moduleDir, 'files', 'middleware.ts'),
      'export const middleware = true'
    )

    // Create project package.json
    await writeFile(
      join(projectDir, 'package.json'),
      JSON.stringify({
        name: 'my-app',
        dependencies: { next: '^14.0.0' },
      }, null, 2)
    )
  })

  afterEach(async () => {
    await rm(moduleDir, { recursive: true, force: true })
    await rm(projectDir, { recursive: true, force: true })
  })

  it('copies module files to project', async () => {
    await applyModule(moduleDir, projectDir, { PROJECT_NAME: 'my-app' })

    const auth = await readFile(join(projectDir, 'lib', 'auth.ts'), 'utf-8')
    expect(auth).toContain('my-app')
  })

  it('replaces tokens in module files', async () => {
    await applyModule(moduleDir, projectDir, { PROJECT_NAME: 'my-app' })

    const auth = await readFile(join(projectDir, 'lib', 'auth.ts'), 'utf-8')
    expect(auth).toBe('export const auth = "my-app"')
  })

  it('merges dependencies into package.json', async () => {
    await applyModule(moduleDir, projectDir, { PROJECT_NAME: 'my-app' })

    const pkg = JSON.parse(
      await readFile(join(projectDir, 'package.json'), 'utf-8')
    )
    expect(pkg.dependencies['@supabase/supabase-js']).toBe('^2.0.0')
    expect(pkg.dependencies['next']).toBe('^14.0.0')
  })

  it('module dependency wins over existing version', async () => {
    // Add conflicting dependency to project
    const pkg = JSON.parse(
      await readFile(join(projectDir, 'package.json'), 'utf-8')
    )
    pkg.dependencies['@supabase/supabase-js'] = '^1.0.0'
    await writeFile(join(projectDir, 'package.json'), JSON.stringify(pkg, null, 2))

    await applyModule(moduleDir, projectDir, { PROJECT_NAME: 'my-app' })

    const updated = JSON.parse(
      await readFile(join(projectDir, 'package.json'), 'utf-8')
    )
    expect(updated.dependencies['@supabase/supabase-js']).toBe('^2.0.0')
  })

  it('creates .env.example with env vars', async () => {
    await applyModule(moduleDir, projectDir, { PROJECT_NAME: 'my-app' })

    const envExample = await readFile(
      join(projectDir, '.env.example'),
      'utf-8'
    )
    expect(envExample).toContain('SUPABASE_URL=')
    expect(envExample).toContain('SUPABASE_KEY=')
  })

  it('appends to existing .env.example', async () => {
    await writeFile(join(projectDir, '.env.example'), 'EXISTING_VAR=value\n')

    await applyModule(moduleDir, projectDir, { PROJECT_NAME: 'my-app' })

    const envExample = await readFile(
      join(projectDir, '.env.example'),
      'utf-8'
    )
    expect(envExample).toContain('EXISTING_VAR=value')
    expect(envExample).toContain('SUPABASE_URL=')
  })

  it('overwrites existing project files', async () => {
    await mkdir(join(projectDir, 'lib'), { recursive: true })
    await writeFile(join(projectDir, 'lib', 'auth.ts'), 'old content')

    await applyModule(moduleDir, projectDir, { PROJECT_NAME: 'my-app' })

    const auth = await readFile(join(projectDir, 'lib', 'auth.ts'), 'utf-8')
    expect(auth).toBe('export const auth = "my-app"')
  })
})
