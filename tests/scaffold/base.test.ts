import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runScaffold } from '../../src/scaffold/base.js'

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
      runScaffold('create-next-app', ['--typescript'], 'my-app', cwd),
    ).toThrow(/not empty/i)
  })
})
