import React from 'react'
import { Box, Text } from 'ink'
import type { StageEntry } from '../../agent/stages.js'

interface HeaderProps {
  appName: string
  currentStage: StageEntry | null
  stages: StageEntry[]
  showDots?: boolean   // show during conversation, hide on stage list
}

export function Header({ appName, currentStage, stages, showDots = false }: HeaderProps) {
  const stageName = currentStage?.label ?? 'Stack Progress'

  return (
    <Box borderStyle="single" borderBottom={false} paddingX={1} justifyContent="space-between">
      <Box gap={2}>
        <Text bold color="cyan">{appName}</Text>
        <Text bold>{stageName}</Text>
      </Box>
      {showDots && (
        <Box gap={0}>
          {stages.map((s, i) => (
            <StageDot key={s.id} stage={s} isCurrent={s.id === currentStage?.id} />
          ))}
        </Box>
      )}
    </Box>
  )
}

function StageDot({ stage, isCurrent }: { stage: StageEntry; isCurrent: boolean }) {
  if (isCurrent) {
    return <Text color="cyan">●</Text>
  }
  if (stage.status === 'complete' && stage.confirmed) {
    return <Text color="green">●</Text>
  }
  if (stage.status === 'complete' && !stage.confirmed) {
    return <Text color="yellow">●</Text>
  }
  if (stage.status === 'skipped') {
    return <Text dimColor>–</Text>
  }
  return <Text dimColor>○</Text>
}
