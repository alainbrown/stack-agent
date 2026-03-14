import React from 'react'
import { Box, Text } from 'ink'
import type { StageEntry } from '../../agent/stages.js'
import type { StackProgress } from '../../agent/progress.js'

export type FooterMode = 'decisions' | 'stage_list' | 'options' | 'input'

interface FooterProps {
  progress: StackProgress
  stages: StageEntry[]
  terminalWidth: number
  mode?: FooterMode
}

export function Footer({ progress, stages, terminalWidth, mode = 'decisions' }: FooterProps) {
  let display: string

  switch (mode) {
    case 'stage_list':
      display = '↑↓ navigate · Enter select · Esc back'
      break
    case 'options':
      display = '↑↓ navigate · Enter select · Esc stages'
      break
    case 'input':
      display = 'Enter submit · Esc stages'
      break
    default:
      display = buildDecisionsDisplay(progress, stages, terminalWidth)
      break
  }

  return (
    <Box borderStyle="single" borderTop={false} paddingX={1}>
      <Text dimColor>{display}</Text>
    </Box>
  )
}

function buildDecisionsDisplay(progress: StackProgress, stages: StageEntry[], terminalWidth: number): string {
  const decisions: string[] = []

  if (progress.projectName) decisions.push(`Project: ${progress.projectName}`)
  if (progress.frontend) decisions.push(`Frontend: ${progress.frontend.component}`)
  if (progress.backend) decisions.push(`Backend: ${progress.backend.component}`)
  if (progress.database) decisions.push(`DB: ${progress.database.component}`)
  if (progress.auth) decisions.push(`Auth: ${progress.auth.component}`)
  if (progress.payments) decisions.push(`Pay: ${progress.payments.component}`)
  if (progress.ai) decisions.push(`AI: ${progress.ai.component}`)
  if (progress.deployment) decisions.push(`Deploy: ${progress.deployment.component}`)

  const nextStage = stages.find((s) => s.status === 'pending')
  const nextText = nextStage ? `Next: ${nextStage.label}` : ''

  const separator = ' │ '
  let display = decisions.map((d) => `✓ ${d}`).join(separator)
  if (nextText) {
    display = display ? `${display}${separator}${nextText}` : nextText
  }

  const maxWidth = terminalWidth - 4
  if (display.length > maxWidth) {
    display = display.slice(0, maxWidth - 1) + '…'
  }

  return display
}
