import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateScaffoldTool, validateScaffoldArgs, runScaffold } from '../../src/scaffold/base.js'

describe('validateScaffoldTool', () => {
  it('accepts allowlisted tools', () => {
    expect(() => validateScaffoldTool('create-next-app', 'create-next-app')).not.toThrow()
    expect(() => validateScaffoldTool('create-vite', 'create-vite')).not.toThrow()
    expect(() => validateScaffoldTool('create-remix', 'create-remix')).not.toThrow()
    expect(() => validateScaffoldTool('create-svelte', 'create-svelte')).not.toThrow()
    expect(() => validateScaffoldTool('create-astro', 'create-astro')).not.toThrow()
    expect(() => validateScaffoldTool('nuxi', 'nuxi')).not.toThrow()
  })

  it('rejects tools not in the allowlist', () => {
    expect(() => validateScaffoldTool('create-evil-app', 'create-evil-app')).toThrow(
      /allowlist/i,
    )
    expect(() => validateScaffoldTool('rm', 'rm')).toThrow(/allowlist/i)
    expect(() => validateScaffoldTool('npx', 'npx')).toThrow(/allowlist/i)
  })

  it('rejects a tool that is allowlisted but does not match approvedTool', () => {
    expect(() => validateScaffoldTool('create-vite', 'create-next-app')).toThrow(
      /approved/i,
    )
  })
})

describe('validateScaffoldArgs', () => {
  it('accepts safe flags for create-next-app', () => {
    expect(() =>
      validateScaffoldArgs('create-next-app', [
        '--typescript',
        '--tailwind',
        '--eslint',
        '--app',
        '--src-dir',
        '--use-npm',
      ]),
    ).not.toThrow()
  })

  it('accepts --template with a simple value for create-vite', () => {
    expect(() =>
      validateScaffoldArgs('create-vite', ['--template', 'react-ts']),
    ).not.toThrow()
  })

  it('rejects flags not in the create-next-app allowlist', () => {
    expect(() =>
      validateScaffoldArgs('create-next-app', ['--danger-flag']),
    ).toThrow(/allowlist/i)
  })

  it('rejects args with URL schemes (http:)', () => {
    expect(() =>
      validateScaffoldArgs('create-next-app', ['http://evil.com']),
    ).toThrow(/url scheme/i)
  })

  it('rejects args with URL schemes (https:)', () => {
    expect(() =>
      validateScaffoldArgs('create-vite', ['https://evil.com']),
    ).toThrow(/url scheme/i)
  })

  it('rejects args with URL schemes (git+)', () => {
    expect(() =>
      validateScaffoldArgs('create-remix', ['git+https://evil.com']),
    ).toThrow(/url scheme/i)
  })

  it('rejects args with URL schemes (file:)', () => {
    expect(() =>
      validateScaffoldArgs('create-svelte', ['file:///etc/passwd']),
    ).toThrow(/url scheme/i)
  })

  it('rejects args with shell metacharacters (semicolon)', () => {
    expect(() =>
      validateScaffoldArgs('create-next-app', ['--typescript;evil']),
    ).toThrow(/metacharacter/i)
  })

  it('rejects args with shell metacharacters (pipe)', () => {
    expect(() =>
      validateScaffoldArgs('create-next-app', ['--typescript|evil']),
    ).toThrow(/metacharacter/i)
  })

  it('rejects args with shell metacharacters (dollar sign)', () => {
    expect(() =>
      validateScaffoldArgs('create-next-app', ['--import-alias', '$HOME']),
    ).toThrow(/metacharacter/i)
  })

  it('rejects args with shell metacharacters (backtick)', () => {
    expect(() =>
      validateScaffoldArgs('create-next-app', ['`evil`']),
    ).toThrow(/metacharacter/i)
  })

  it('rejects args containing whitespace', () => {
    expect(() =>
      validateScaffoldArgs('create-next-app', ['--typescript --js']),
    ).toThrow(/whitespace/i)
  })

  it('rejects args with newline characters', () => {
    expect(() =>
      validateScaffoldArgs('create-next-app', ['--typescript\n--js']),
    ).toThrow(/whitespace/i)
  })

  it('accepts flags starting with -- for tools without strict allowlists', () => {
    expect(() =>
      validateScaffoldArgs('nuxi', ['--no-telemetry']),
    ).not.toThrow()
  })

  it('rejects non-flag args for tools without strict allowlists', () => {
    expect(() =>
      validateScaffoldArgs('nuxi', ['somevalue']),
    ).toThrow()
  })
})

describe('runScaffold', () => {
  it('throws when output directory exists and is non-empty', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const { tmpdir } = await import('node:os')

    const cwd = mkdtempSync(join(tmpdir(), 'scaffold-test-'))
    const projectDir = join(cwd, 'my-app')
    mkdirSync(projectDir)
    writeFileSync(join(projectDir, 'existing.txt'), 'data')

    expect(() =>
      runScaffold('create-next-app', ['--typescript'], 'create-next-app', 'my-app', cwd),
    ).toThrow(/not empty/i)
  })

  it('throws for a non-allowlisted tool before touching the filesystem', () => {
    expect(() =>
      runScaffold('evil-tool', [], 'evil-tool', 'my-app', '/tmp'),
    ).toThrow(/allowlist/i)
  })
})
