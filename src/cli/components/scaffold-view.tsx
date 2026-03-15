import React from 'react'
import { Box, Text } from 'ink'
import { Spinner } from '@inkjs/ui'
import type { ScaffoldStep } from '../bridge.js'

interface ScaffoldViewProps {
  steps: ScaffoldStep[]
}

export function ScaffoldView({ steps }: ScaffoldViewProps) {
  return (
    <Box flexDirection="column">
      {steps.map((step, i) => (
        <Box key={i} flexDirection="column">
          <Box>
            {step.status === 'running' && <Spinner />}
            {step.status === 'done' && <Text color="green">✓</Text>}
            {step.status === 'error' && <Text color="red">✗</Text>}
            <Text bold={step.status === 'running'}> {step.name}</Text>
          </Box>
          {step.status === 'done' && step.files && step.files.length > 0 && (
            <Box paddingLeft={3}>
              <Text dimColor>{step.files.join(', ')}</Text>
            </Box>
          )}
          {step.status === 'error' && step.error && (
            <Box paddingLeft={3}>
              <Text color="red">{step.error}</Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  )
}
