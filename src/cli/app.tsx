import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import { useScreenSize } from 'fullscreen-ink'
import { Header } from './components/header.js'
import { Footer, type FooterMode } from './components/footer.js'
import { ConversationView } from './components/conversation.js'
import { OptionSelect } from './components/option-select.js'
import { StageListView, type StageListResult } from './components/stage-list.js'
import { TextInput, Spinner } from '@inkjs/ui'
import { ProjectInfoForm } from './components/project-info-form.js'
import { createBridge, type ConversationBridge, type ToolOption, type InputResult } from './bridge.js'
import { runStageLoop, type StageLoopResult } from '../agent/loop.js'
import { getRecommendations, applyRecommendations } from '../agent/recommend.js'
import type { StageManager } from '../agent/stage-manager.js'
import type { StageEntry } from '../agent/stages.js'
import type { StackProgress } from '../agent/progress.js'

type AppView = 'project_info' | 'loading' | 'stage_list' | 'conversation' | 'input' | 'options' | 'error'

interface AppProps {
  manager: StageManager
  onBuild: () => void
  onExit: () => void
}

export function App({ manager, onBuild, onExit }: AppProps) {
  const app = useApp()
  const { width, height } = useScreenSize()

  const [view, setView] = useState<AppView>(
    manager.progress.projectName ? 'stage_list' : 'project_info'
  )
  const [bridge] = useState(() => createBridge())
  const [currentStage, setCurrentStage] = useState<StageEntry | null>(manager.currentStage())
  const [progress, setProgress] = useState<StackProgress>(manager.progress)
  const [stages, setStages] = useState<StageEntry[]>([...manager.stages])
  const [options, setOptions] = useState<ToolOption[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  // Sync state from manager
  const syncState = useCallback(() => {
    setProgress({ ...manager.progress })
    setStages([...manager.stages])
    setCurrentStage(manager.currentStage())
  }, [manager])

  // Subscribe to bridge events
  useEffect(() => {
    const unsubs = [
      bridge.subscribe('presentOptions', (opts: ToolOption[]) => {
        setOptions(opts)
        setView('options')
      }),
      bridge.subscribe('streamEnd', () => {
        // Stream ended without options — show text input for user response
        setView('input')
      }),
      bridge.subscribe('spinnerStart', () => {
        setView('conversation')
      }),
      bridge.subscribe('error', (err: Error) => {
        setErrorMsg(err.message)
        setView('error')
      }),
    ]
    return () => unsubs.forEach((fn) => fn())
  }, [bridge])

  // Handle Esc globally — return to stage list
  useInput((_input, key) => {
    if (key.escape && view !== 'stage_list') {
      // Cancel current conversation and return to stage list
      bridge.resolveInput({ kind: 'cancel' })
      setView('stage_list')
      syncState()
    }
  }, { isActive: view === 'conversation' || view === 'error' })

  // Run a stage conversation
  const runStage = useCallback(async (stageId: string) => {
    const stage = manager.stages.find((s) => s.id === stageId)
    if (!stage) return

    setCurrentStage(stage)
    setView('conversation')

    try {
      const result = await runStageLoop(stage, manager, bridge)

      switch (result.outcome) {
        case 'complete':
          manager.completeStage(stageId, result.summary)
          // Mark as confirmed since user interacted with it
          const completedStage = manager.stages.find((s) => s.id === stageId)
          if (completedStage) completedStage.confirmed = true
          manager.save()
          break
        case 'skipped':
          manager.skipStage(stageId)
          manager.save()
          break
        case 'cancel':
          manager.restorePendingNavigation()
          break
      }
    } catch (err) {
      setErrorMsg((err as Error).message)
      setView('error')
      return
    }

    syncState()
    setView('stage_list')
  }, [manager, bridge, syncState])

  // Handle stage list selection
  const handleStageResult = useCallback((result: StageListResult) => {
    if (result.kind === 'select') {
      // If the stage has a decision, navigate to it for review
      const stage = manager.stages.find((s) => s.id === result.stageId)
      if (stage && (stage.status === 'complete' || stage.status === 'skipped')) {
        manager.navigateTo(result.stageId)
        syncState()
      }
      runStage(result.stageId)
    } else if (result.kind === 'build') {
      onBuild()
      app.exit()
    } else if (result.kind === 'cancel') {
      manager.save()
      onExit()
      app.exit()
    }
  }, [manager, runStage, syncState, onBuild, onExit, app])

  // Handle option selection
  const handleOptionSelect = useCallback((result: InputResult) => {
    setView('conversation')
    bridge.resolveInput(result)
  }, [bridge])

  // Handle text input submission
  const handleTextSubmit = useCallback((value: string) => {
    setView('conversation')
    bridge.resolveInput({ kind: 'text', value })
  }, [bridge])

  // Handle project info form submission
  const handleProjectInfo = useCallback(async (name: string, description: string) => {
    // Save project info
    manager.progress = {
      ...manager.progress,
      projectName: name,
      description,
    }
    const stage = manager.stages.find((s) => s.id === 'project_info')
    if (stage) {
      stage.status = 'complete'
      stage.confirmed = true
      stage.summary = `${name}: ${description}`
    }
    manager.save()
    syncState()

    // Get LLM recommendations for all stages
    setView('loading')
    try {
      const recommendations = await getRecommendations(name, description)
      const { progress: updatedProgress } = applyRecommendations(
        manager.progress,
        manager.stages,
        recommendations,
      )
      manager.progress = updatedProgress
      manager.save()
    } catch (err) {
      // If recommendations fail, just go to stage list — user fills in manually
      // Log for debugging but don't block the user
      console.error('Recommendation pass failed:', err)
    }
    syncState()

    setView('stage_list')
  }, [manager, syncState])

  const footerMode: FooterMode = view === 'stage_list' ? 'stage_list' : view === 'options' ? 'options' : view === 'input' || view === 'project_info' ? 'input' : 'decisions'
  // Header = 2 lines (border-top + content, no border-bottom)
  // Footer = 2 lines (content + border-bottom, no border-top)
  const contentHeight = height - 4

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Header
        appName="stack-agent"
        currentStage={view === 'stage_list' ? null : currentStage}
        stages={stages}
        showDots={view !== 'stage_list'}
      />

      <Box flexDirection="column" height={contentHeight} paddingX={1} borderStyle="single" borderTop={false} borderBottom={false}>
        {view === 'project_info' && (
          <ProjectInfoForm onSubmit={handleProjectInfo} />
        )}

        {view === 'loading' && (
          <Box flexDirection="column">
            <Spinner label="Analyzing your project and recommending a stack..." />
          </Box>
        )}

        {view === 'stage_list' && (
          <StageListView
            stages={stages}
            currentStageId={currentStage?.id ?? null}
            progress={progress}
            onResult={handleStageResult}
          />
        )}

        {view === 'conversation' && (
          <ConversationView bridge={bridge} maxLines={contentHeight} />
        )}

        {view === 'input' && (
          <Box flexDirection="column">
            <ConversationView bridge={bridge} maxLines={contentHeight - 3} />
            <Box marginTop={1}>
              <TextInput
                placeholder="Type your response..."
                onSubmit={handleTextSubmit}
              />
            </Box>
          </Box>
        )}

        {view === 'options' && (
          <Box flexDirection="column">
            <ConversationView bridge={bridge} maxLines={contentHeight - 8} />
            <OptionSelect options={options} onSelect={handleOptionSelect} />
          </Box>
        )}

        {view === 'error' && (
          <Box flexDirection="column">
            <Text color="red" bold>Error: {errorMsg}</Text>
            <Text dimColor>Press Esc to return to stage list</Text>
          </Box>
        )}
      </Box>

      <Footer
        progress={progress}
        stages={stages}
        terminalWidth={width}
        mode={footerMode}
      />
    </Box>
  )
}
