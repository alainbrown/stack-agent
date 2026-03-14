import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { ConfirmInput } from '@inkjs/ui'
import type { StageEntry } from '../../agent/stages.js'
import { isComplete, type StackProgress } from '../../agent/progress.js'

export type StageListResult =
  | { kind: 'select'; stageId: string }
  | { kind: 'build' }
  | { kind: 'cancel' }

interface StageListViewProps {
  stages: StageEntry[]
  currentStageId: string | null
  progress: StackProgress
  onResult: (result: StageListResult) => void
}

export function StageListView({ stages, currentStageId, progress, onResult }: StageListViewProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [showWarning, setShowWarning] = useState('')
  const [cursor, setCursor] = useState(0)
  const canBuild = isComplete(progress)

  // Items: all stages + Build
  const itemCount = stages.length + 1

  useInput((input, key) => {
    if (showConfirm) return

    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1))
      setShowWarning('')
    }
    if (key.downArrow) {
      setCursor((c) => Math.min(itemCount - 1, c + 1))
      setShowWarning('')
    }
    if (key.return) {
      if (cursor < stages.length) {
        onResult({ kind: 'select', stageId: stages[cursor].id })
      } else {
        // Build
        if (canBuild) {
          setShowConfirm(true)
        } else {
          const missing = getMissingDecisions(progress)
          setShowWarning(`Complete ${missing.join(', ')} first.`)
        }
      }
    }
    if (key.escape) {
      onResult({ kind: 'cancel' })
    }
  })

  if (showConfirm) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold>Ready to build this stack?</Text>
        <Box marginTop={1}>
          <ConfirmInput
            defaultChoice="confirm"
            onConfirm={() => onResult({ kind: 'build' })}
            onCancel={() => setShowConfirm(false)}
          />
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {showWarning && (
        <Box marginBottom={1}>
          <Text color="yellow">{showWarning}</Text>
        </Box>
      )}
      {stages.map((stage, i) => {
        const isHighlighted = cursor === i
        const pointer = isHighlighted ? '❯ ' : '  '

        return (
          <Box key={stage.id}>
            <Text>{pointer}</Text>
            <StageLabel stage={stage} isCurrent={stage.id === currentStageId} />
          </Box>
        )
      })}
      {/* Build option */}
      <Box marginTop={1}>
        <Text>{cursor === stages.length ? '❯ ' : '  '}</Text>
        <Text color={canBuild ? 'green' : 'yellow'} bold={cursor === stages.length}>
          ★ Build
        </Text>
        {!canBuild && (
          <Text dimColor> ({requiredRemaining(progress)} remaining)</Text>
        )}
      </Box>
    </Box>
  )
}

function StageLabel({ stage, isCurrent }: { stage: StageEntry; isCurrent: boolean }) {
  // User-confirmed decisions: green
  if (stage.status === 'complete' && stage.confirmed) {
    return (
      <Text>
        <Text color="green">✓ {stage.label}</Text>
        <Text dimColor> — {stage.summary}</Text>
      </Text>
    )
  }

  // LLM-suggested but not yet reviewed: yellow/dim
  if (stage.status === 'complete' && !stage.confirmed) {
    return (
      <Text>
        <Text color="yellow">◆ {stage.label}</Text>
        <Text color="yellow" dimColor> — {stage.summary} (suggested)</Text>
      </Text>
    )
  }

  // Skipped by LLM
  if (stage.status === 'skipped') {
    return (
      <Text dimColor>– {stage.label} — skipped</Text>
    )
  }

  // Current stage needing input
  if (isCurrent) {
    return (
      <Text>
        <Text color="cyan" bold>● {stage.label}</Text>
        <Text color="cyan"> ← needs your input</Text>
      </Text>
    )
  }

  // Pending
  return <Text dimColor>○ {stage.label}</Text>
}

function requiredRemaining(progress: StackProgress): number {
  let count = 0
  if (!progress.projectName) count++
  if (!progress.description) count++
  if (!progress.frontend) count++
  if (!progress.database) count++
  if (!progress.deployment) count++
  return count
}

function getMissingDecisions(progress: StackProgress): string[] {
  const missing: string[] = []
  if (!progress.projectName || !progress.description) missing.push('Project Info')
  if (!progress.frontend) missing.push('Frontend')
  if (!progress.database) missing.push('Database')
  if (!progress.deployment) missing.push('Deployment')
  return missing
}
