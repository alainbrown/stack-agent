import { describe, it, expect, vi } from 'vitest'
import { createBridge } from '../../src/cli/bridge.js'

describe('ConversationBridge', () => {
  it('waitForInput resolves when resolveInput is called', async () => {
    const bridge = createBridge()
    const promise = bridge.waitForInput()
    bridge.resolveInput({ kind: 'text', value: 'hello' })
    const result = await promise
    expect(result).toEqual({ kind: 'text', value: 'hello' })
  })

  it('waitForInput can be called multiple times sequentially', async () => {
    const bridge = createBridge()
    const p1 = bridge.waitForInput()
    bridge.resolveInput({ kind: 'text', value: 'first' })
    expect(await p1).toEqual({ kind: 'text', value: 'first' })
    const p2 = bridge.waitForInput()
    bridge.resolveInput({ kind: 'cancel' })
    expect(await p2).toEqual({ kind: 'cancel' })
  })

  it('onStreamText calls registered listener', () => {
    const bridge = createBridge()
    const listener = vi.fn()
    bridge.subscribe('streamText', listener)
    bridge.onStreamText('hello ')
    bridge.onStreamText('world')
    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener).toHaveBeenCalledWith('hello ')
    expect(listener).toHaveBeenCalledWith('world')
  })

  it('onPresentOptions calls registered listener', () => {
    const bridge = createBridge()
    const listener = vi.fn()
    bridge.subscribe('presentOptions', listener)
    const options = [{ label: 'Next.js', description: 'Full-stack React' }]
    bridge.onPresentOptions(options)
    expect(listener).toHaveBeenCalledWith(options)
  })

  it('onError calls registered listener', () => {
    const bridge = createBridge()
    const listener = vi.fn()
    bridge.subscribe('error', listener)
    bridge.onError(new Error('API failed'))
    expect(listener).toHaveBeenCalledWith(expect.any(Error))
  })

  it('onSpinnerStart calls registered listener', () => {
    const bridge = createBridge()
    const listener = vi.fn()
    bridge.subscribe('spinnerStart', listener)
    bridge.onSpinnerStart()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('onStreamEnd calls registered listener', () => {
    const bridge = createBridge()
    const listener = vi.fn()
    bridge.subscribe('streamEnd', listener)
    bridge.onStreamEnd('full text')
    expect(listener).toHaveBeenCalledWith('full text')
  })

  it('unsubscribe removes listener', () => {
    const bridge = createBridge()
    const listener = vi.fn()
    const unsub = bridge.subscribe('streamText', listener)
    bridge.onStreamText('first')
    unsub()
    bridge.onStreamText('second')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
