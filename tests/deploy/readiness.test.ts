import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { normalizePlatform, checkDeployReadiness, type PlatformConfig, type ReadinessResult } from '../../src/deploy/readiness.js'
import * as childProcess from 'node:child_process'

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}))

describe('normalizePlatform', () => {
  it('maps "Vercel" to vercel platform', () => {
    const result = normalizePlatform('Vercel')
    expect(result.platform).toBe('Vercel')
    expect(result.cliName).toBe('vercel')
  })

  it('maps "vercel" (lowercase) to vercel platform', () => {
    const result = normalizePlatform('vercel')
    expect(result.platform).toBe('Vercel')
  })

  it('maps "AWS Lambda + API Gateway" to AWS (general)', () => {
    const result = normalizePlatform('AWS Lambda + API Gateway')
    expect(result.platform).toBe('AWS')
    expect(result.cliName).toBe('aws')
  })

  it('maps "AWS Amplify" to AWS Amplify (not general AWS)', () => {
    const result = normalizePlatform('AWS Amplify')
    expect(result.platform).toBe('AWS Amplify')
    expect(result.cliName).toBe('amplify')
  })

  it('maps "AWS with CDK" to AWS CDK', () => {
    const result = normalizePlatform('AWS with CDK')
    expect(result.platform).toBe('AWS CDK')
    expect(result.cliName).toBe('cdk')
  })

  it('maps "Docker" to Docker', () => {
    const result = normalizePlatform('Docker')
    expect(result.platform).toBe('Docker')
    expect(result.cliName).toBe('docker')
  })

  it('maps "GCP Cloud Run" to GCP', () => {
    const result = normalizePlatform('GCP Cloud Run')
    expect(result.platform).toBe('GCP')
    expect(result.cliName).toBe('gcloud')
  })

  it('maps "Google Cloud Run" to GCP', () => {
    const result = normalizePlatform('Google Cloud Run')
    expect(result.platform).toBe('GCP')
    expect(result.cliName).toBe('gcloud')
  })

  it('maps "Fly.io" to Fly.io', () => {
    const result = normalizePlatform('Fly.io')
    expect(result.platform).toBe('Fly.io')
    expect(result.cliName).toBe('fly')
  })

  it('maps "Railway" to Railway', () => {
    const result = normalizePlatform('Railway')
    expect(result.platform).toBe('Railway')
    expect(result.cliName).toBe('railway')
  })

  it('maps "SST on AWS" to AWS SST', () => {
    const result = normalizePlatform('SST on AWS')
    expect(result.platform).toBe('AWS SST')
    expect(result.cliName).toBe('sst')
  })

  it('returns fallback for unknown platform', () => {
    const result = normalizePlatform('Some Unknown Platform')
    expect(result.platform).toBe('Unknown')
    expect(result.cliName).toBe('')
  })
})

describe('checkDeployReadiness', () => {
  it('returns a ReadinessResult with all required fields', () => {
    const result = checkDeployReadiness('Vercel')
    expect(result).toHaveProperty('platform')
    expect(result).toHaveProperty('cliInstalled')
    expect(result).toHaveProperty('cliName')
    expect(result).toHaveProperty('authenticated')
    expect(result).toHaveProperty('installCmd')
    expect(result).toHaveProperty('authCmd')
    expect(result).toHaveProperty('deployCmd')
    expect(result).toHaveProperty('envVarCmd')
  })

  it('returns fallback result for unknown platform', () => {
    const result = checkDeployReadiness('Some Unknown Platform')
    expect(result.platform).toBe('Unknown')
    expect(result.cliInstalled).toBe(false)
    expect(result.authenticated).toBeNull()
  })

  it('sets deployCmd to npm run deploy', () => {
    const result = checkDeployReadiness('Vercel')
    expect(result.deployCmd).toBe('npm run deploy')
  })

  describe('with mocked execFileSync', () => {
    let execSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
      execSpy = vi.mocked(childProcess.execFileSync)
      execSpy.mockReset()
    })

    afterEach(() => {
      execSpy.mockReset()
    })

    it('reports cliInstalled=true and authenticated=true when both succeed', () => {
      execSpy.mockReturnValue(Buffer.from(''))
      const result = checkDeployReadiness('Vercel')
      expect(result.cliInstalled).toBe(true)
      expect(result.authenticated).toBe(true)
    })

    it('reports cliInstalled=false when which throws ENOENT', () => {
      const err = new Error('not found') as NodeJS.ErrnoException
      err.code = 'ENOENT'
      execSpy.mockImplementation(() => { throw err })
      const result = checkDeployReadiness('Vercel')
      expect(result.cliInstalled).toBe(false)
      expect(result.authenticated).toBeNull()
    })

    it('reports authenticated=false when auth check exits non-zero', () => {
      let callCount = 0
      execSpy.mockImplementation(() => {
        callCount++
        if (callCount === 1) return Buffer.from('')
        const err = new Error('auth failed') as NodeJS.ErrnoException & { status: number }
        err.status = 1
        throw err
      })
      const result = checkDeployReadiness('Vercel')
      expect(result.cliInstalled).toBe(true)
      expect(result.authenticated).toBe(false)
    })

    it('reports authenticated=null when auth check times out', () => {
      let callCount = 0
      execSpy.mockImplementation(() => {
        callCount++
        if (callCount === 1) return Buffer.from('')
        const err = new Error('timed out') as NodeJS.ErrnoException
        err.code = 'ETIMEDOUT'
        throw err
      })
      const result = checkDeployReadiness('Vercel')
      expect(result.cliInstalled).toBe(true)
      expect(result.authenticated).toBeNull()
    })
  })
})
