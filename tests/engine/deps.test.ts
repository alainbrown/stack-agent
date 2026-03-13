import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { detectPackageManager } from '../../src/engine/deps.js'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('detectPackageManager', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'detect-pm-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('detects pnpm from pnpm-lock.yaml', async () => {
    await writeFile(join(dir, 'pnpm-lock.yaml'), '')
    expect(await detectPackageManager(dir)).toBe('pnpm')
  })

  it('detects yarn from yarn.lock', async () => {
    await writeFile(join(dir, 'yarn.lock'), '')
    expect(await detectPackageManager(dir)).toBe('yarn')
  })

  it('detects bun from bun.lock', async () => {
    await writeFile(join(dir, 'bun.lock'), '')
    expect(await detectPackageManager(dir)).toBe('bun')
  })

  it('detects bun from legacy bun.lockb', async () => {
    await writeFile(join(dir, 'bun.lockb'), '')
    expect(await detectPackageManager(dir)).toBe('bun')
  })

  it('defaults to npm when no lockfile found', async () => {
    expect(await detectPackageManager(dir)).toBe('npm')
  })

  it('pnpm takes priority over yarn', async () => {
    await writeFile(join(dir, 'pnpm-lock.yaml'), '')
    await writeFile(join(dir, 'yarn.lock'), '')
    expect(await detectPackageManager(dir)).toBe('pnpm')
  })
})
