import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { validateFilePaths, writeIntegration } from '../../src/scaffold/integrate.js'

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'integrate-test-'))
}

describe('validateFilePaths', () => {
  it('accepts paths within the project root', () => {
    expect(() =>
      validateFilePaths('/project', {
        'src/index.ts': '',
        'lib/utils.ts': '',
        'README.md': '',
      }),
    ).not.toThrow()
  })

  it('rejects path traversal via ../', () => {
    expect(() =>
      validateFilePaths('/project', {
        '../../etc/passwd': 'evil',
      }),
    ).toThrow(/outside/i)
  })

  it('rejects a single step traversal', () => {
    expect(() =>
      validateFilePaths('/project/sub', {
        '../sibling/file.ts': 'content',
      }),
    ).toThrow(/outside/i)
  })

  it('rejects absolute paths', () => {
    expect(() =>
      validateFilePaths('/project', {
        '/etc/passwd': 'evil',
      }),
    ).toThrow(/relative/i)
  })

  it('accepts an empty files map', () => {
    expect(() => validateFilePaths('/project', {})).not.toThrow()
  })
})

describe('writeIntegration', () => {
  let projectDir: string

  beforeEach(() => {
    projectDir = makeTempDir()
  })

  it('writes files to the project directory', () => {
    writeIntegration(projectDir, {
      files: {
        'src/index.ts': 'export default {}',
        'src/utils/helper.ts': 'export const helper = () => {}',
      },
    })

    expect(readFileSync(join(projectDir, 'src/index.ts'), 'utf8')).toBe('export default {}')
    expect(readFileSync(join(projectDir, 'src/utils/helper.ts'), 'utf8')).toBe(
      'export const helper = () => {}',
    )
  })

  it('creates nested directories as needed', () => {
    writeIntegration(projectDir, {
      files: {
        'deep/nested/dir/file.ts': 'content',
      },
    })

    expect(existsSync(join(projectDir, 'deep/nested/dir/file.ts'))).toBe(true)
  })

  it('merges dependencies into package.json', () => {
    // Create an initial package.json
    const pkgPath = join(projectDir, 'package.json')
    writeFileSync(
      pkgPath,
      JSON.stringify({ name: 'test-app', dependencies: { react: '^18.0.0' } }, null, 2),
      'utf8',
    )

    writeIntegration(projectDir, {
      files: {},
      dependencies: { 'prisma-client': '^5.0.0' },
    })

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      dependencies: Record<string, string>
    }
    expect(pkg.dependencies['react']).toBe('^18.0.0')
    expect(pkg.dependencies['prisma-client']).toBe('^5.0.0')
  })

  it('merges devDependencies into package.json', () => {
    const pkgPath = join(projectDir, 'package.json')
    writeFileSync(pkgPath, JSON.stringify({ name: 'test-app' }, null, 2), 'utf8')

    writeIntegration(projectDir, {
      files: {},
      devDependencies: { vitest: '^4.0.0' },
    })

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      devDependencies: Record<string, string>
    }
    expect(pkg.devDependencies['vitest']).toBe('^4.0.0')
  })

  it('creates package.json if it does not exist when merging deps', () => {
    writeIntegration(projectDir, {
      files: {},
      dependencies: { express: '^4.0.0' },
    })

    const pkgPath = join(projectDir, 'package.json')
    expect(existsSync(pkgPath)).toBe(true)
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      dependencies: Record<string, string>
    }
    expect(pkg.dependencies['express']).toBe('^4.0.0')
  })

  it('creates .env.example when envVars are provided', () => {
    writeIntegration(projectDir, {
      files: {},
      envVars: ['DATABASE_URL', 'API_KEY'],
    })

    const envPath = join(projectDir, '.env.example')
    expect(existsSync(envPath)).toBe(true)
    const content = readFileSync(envPath, 'utf8')
    expect(content).toContain('DATABASE_URL=')
    expect(content).toContain('API_KEY=')
  })

  it('appends to an existing .env.example', () => {
    const envPath = join(projectDir, '.env.example')
    writeFileSync(envPath, 'EXISTING_VAR=\n', 'utf8')

    writeIntegration(projectDir, {
      files: {},
      envVars: ['NEW_VAR'],
    })

    const content = readFileSync(envPath, 'utf8')
    expect(content).toContain('EXISTING_VAR=')
    expect(content).toContain('NEW_VAR=')
  })

  it('throws when a file path traverses outside the project root', () => {
    expect(() =>
      writeIntegration(projectDir, {
        files: { '../../evil.ts': 'bad' },
      }),
    ).toThrow(/outside/i)
  })

  it('throws when a file path is absolute', () => {
    expect(() =>
      writeIntegration(projectDir, {
        files: { '/etc/passwd': 'bad' },
      }),
    ).toThrow(/relative/i)
  })
})
