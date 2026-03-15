export interface ToolOption {
  label: string
  description: string
  recommended?: boolean
}

export type InputResult =
  | { kind: 'text'; value: string }
  | { kind: 'cancel' }
  | { kind: 'navigate' }
  | { kind: 'select'; value: string }

type BridgeEvent =
  | 'streamText'
  | 'streamEnd'
  | 'presentOptions'
  | 'spinnerStart'
  | 'stageComplete'
  | 'error'

export interface ConversationBridge {
  onStreamText: (delta: string) => void
  onStreamEnd: (fullText: string) => void
  onPresentOptions: (options: ToolOption[]) => void
  onSpinnerStart: () => void
  onStageComplete: (summary: string) => void
  onError: (error: Error) => void
  waitForInput: () => Promise<InputResult>
  resolveInput: (result: InputResult) => void
  subscribe: (event: BridgeEvent, listener: (...args: any[]) => void) => () => void
}

export interface ScaffoldStep {
  name: string
  status: 'running' | 'done' | 'error'
  files?: string[]
  error?: string
}

export type ScaffoldProgressCallback = (steps: ScaffoldStep[]) => void

export function createBridge(): ConversationBridge {
  const listeners = new Map<BridgeEvent, Set<(...args: any[]) => void>>()
  let pendingResolve: ((result: InputResult) => void) | null = null

  function emit(event: BridgeEvent, ...args: any[]) {
    const set = listeners.get(event)
    if (set) {
      for (const fn of set) fn(...args)
    }
  }

  return {
    onStreamText: (delta) => emit('streamText', delta),
    onStreamEnd: (fullText) => emit('streamEnd', fullText),
    onPresentOptions: (options) => emit('presentOptions', options),
    onSpinnerStart: () => emit('spinnerStart'),
    onStageComplete: (summary) => emit('stageComplete', summary),
    onError: (error) => emit('error', error),
    waitForInput: () => new Promise<InputResult>((resolve) => { pendingResolve = resolve }),
    resolveInput: (result) => {
      if (pendingResolve) {
        const resolve = pendingResolve
        pendingResolve = null
        resolve(result)
      }
    },
    subscribe: (event, listener) => {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(listener)
      return () => { listeners.get(event)?.delete(listener) }
    },
  }
}
