import { describe, it, expect } from 'vitest'
import { replaceTokens, findUnresolvedTokens } from '../../src/utils/tokens.js'

describe('replaceTokens', () => {
  it('replaces __TOKEN__ patterns with values', () => {
    const content = 'Welcome to __PROJECT_NAME__!'
    const result = replaceTokens(content, { PROJECT_NAME: 'my-app' })
    expect(result).toBe('Welcome to my-app!')
  })

  it('replaces multiple different tokens', () => {
    const content = '__PROJECT_NAME__ - __DESCRIPTION__'
    const result = replaceTokens(content, {
      PROJECT_NAME: 'my-app',
      DESCRIPTION: 'A cool app',
    })
    expect(result).toBe('my-app - A cool app')
  })

  it('replaces all occurrences of the same token', () => {
    const content = '__PROJECT_NAME__ and __PROJECT_NAME__'
    const result = replaceTokens(content, { PROJECT_NAME: 'my-app' })
    expect(result).toBe('my-app and my-app')
  })

  it('leaves content unchanged when no tokens match', () => {
    const content = 'no tokens here'
    const result = replaceTokens(content, { PROJECT_NAME: 'my-app' })
    expect(result).toBe('no tokens here')
  })
})

describe('findUnresolvedTokens', () => {
  it('returns empty array when no unresolved tokens', () => {
    expect(findUnresolvedTokens('hello world')).toEqual([])
  })

  it('finds unresolved __TOKEN__ patterns', () => {
    const content = 'hello __UNRESOLVED__ world'
    expect(findUnresolvedTokens(content)).toEqual(['__UNRESOLVED__'])
  })

  it('finds multiple unresolved tokens', () => {
    const content = '__FOO__ and __BAR__'
    const result = findUnresolvedTokens(content)
    expect(result).toContain('__FOO__')
    expect(result).toContain('__BAR__')
  })

  it('returns unique tokens only', () => {
    const content = '__FOO__ and __FOO__'
    expect(findUnresolvedTokens(content)).toEqual(['__FOO__'])
  })
})
