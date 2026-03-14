import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import { Spinner } from '@inkjs/ui'
import type { ConversationBridge } from '../bridge.js'

interface ConversationViewProps {
  bridge: ConversationBridge
  maxLines: number
}

export function ConversationView({ bridge, maxLines }: ConversationViewProps) {
  const [text, setText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [showSpinner, setShowSpinner] = useState(false)

  useEffect(() => {
    const unsubs = [
      bridge.subscribe('spinnerStart', () => {
        setShowSpinner(true)
        setIsStreaming(false)
        setText('')
      }),
      bridge.subscribe('streamText', (delta: string) => {
        setShowSpinner(false)
        setIsStreaming(true)
        setText((prev) => prev + delta)
      }),
      bridge.subscribe('streamEnd', () => {
        setIsStreaming(false)
      }),
    ]
    return () => unsubs.forEach((fn) => fn())
  }, [bridge])

  if (showSpinner) {
    return (
      <Box paddingX={1}>
        <Spinner label="Thinking..." />
      </Box>
    )
  }

  const lines = text.split('\n')
  const visible = lines.slice(-maxLines)

  return (
    <Box flexDirection="column" paddingX={1}>
      {visible.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
    </Box>
  )
}
