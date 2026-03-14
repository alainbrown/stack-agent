import { describe, it, expect } from 'vitest'
import { normalizePlatform, type PlatformConfig } from '../../src/deploy/readiness.js'

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
