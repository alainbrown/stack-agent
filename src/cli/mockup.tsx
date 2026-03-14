import React, { useState, useCallback } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import { withFullScreen, useScreenSize } from 'fullscreen-ink'
import { Spinner } from '@inkjs/ui'
import { Header } from './components/header.js'
import { Footer, type FooterMode } from './components/footer.js'
import { StageListView } from './components/stage-list.js'
import { OptionSelect } from './components/option-select.js'
import { createProgress, setDecision, type StackProgress } from '../agent/progress.js'
import { DEFAULT_STAGES, type StageEntry } from '../agent/stages.js'

type MockView = 'home' | 'options' | 'stage_list' | 'streaming'

const FAKE_OPTIONS = [
  { label: 'Next.js', description: 'Server components, API routes built in', recommended: true },
  { label: 'Vite + React', description: 'Fast builds, maximum flexibility' },
  { label: 'Astro', description: 'Content-first, island architecture' },
]

function MockApp() {
  const app = useApp()
  const { width, height } = useScreenSize()
  const [view, setView] = useState<MockView>('home')
  const [streamText, setStreamText] = useState('')
  const [showSpinner, setShowSpinner] = useState(false)

  const [stages] = useState<StageEntry[]>(() => {
    const s = structuredClone(DEFAULT_STAGES)
    // User confirmed
    s[0].status = 'complete'
    s[0].summary = 'my-app: a task management SaaS'
    s[0].confirmed = true
    // User confirmed
    s[1].status = 'complete'
    s[1].summary = 'Next.js'
    s[1].confirmed = true
    // LLM suggested (not yet reviewed)
    s[2].status = 'complete'
    s[2].summary = 'Next.js API routes'
    // s[2].confirmed is undefined — LLM suggestion
    // LLM suggested
    s[3].status = 'complete'
    s[3].summary = 'Postgres + Drizzle'
    // Current — needs input
    // s[4] stays pending (Auth)
    // Skipped by LLM
    s[5].status = 'skipped'
    s[5].summary = 'not needed'
    // LLM suggested
    s[6].status = 'complete'
    s[6].summary = 'OpenAI'
    // LLM suggested
    s[7].status = 'complete'
    s[7].summary = 'Vercel'
    // Skipped
    s[8].status = 'skipped'
    return s
  })
  const [progress] = useState<StackProgress>(() => {
    let p = createProgress()
    p = { ...p, projectName: 'my-app', description: 'a task management SaaS' }
    p = setDecision(p, 'frontend', { component: 'Next.js', reasoning: 'Best for SaaS' })
    return p
  })

  // Streaming demo
  const demoStreaming = useCallback(() => {
    setView('streaming')
    setShowSpinner(true)
    setStreamText('')

    setTimeout(() => {
      setShowSpinner(false)
      const text = 'For a task manager, you\'ll want a relational database with good JSON support.'
      let i = 0
      const interval = setInterval(() => {
        if (i < text.length) {
          setStreamText((prev) => prev + text[i])
          i++
        } else {
          clearInterval(interval)
          setTimeout(() => setView('options'), 500)
        }
      }, 20)
    }, 1500)
  }, [])

  const isInteractive = view === 'options' || view === 'stage_list'

  useInput((input, key) => {
    if (input === 'q') app.exit()
    if (input === '1') setView('home')
    if (input === '2') setView('options')
    if (input === '3') setView('stage_list')
    if (input === '6') demoStreaming()
    if (key.escape) setView('stage_list')
  }, { isActive: !isInteractive })

  const currentStage = stages.find((s) => s.status === 'pending') ?? null
  const completedCount = stages.filter((s) => s.status === 'complete').length

  // Header = 2 lines, Footer = 2 lines
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
        {/* HOME — key guide */}
        {view === 'home' && (
          <Box flexDirection="column">
            <Text>Great, Next.js it is!</Text>
            <Text> </Text>
            <Text>Now let's pick a database.</Text>
            <Text> </Text>
            <Text dimColor>────────── Mockup Controls ──────────</Text>
            <Text> </Text>
            <Text>  <Text bold>2</Text> = Options (with inline text field)</Text>
            <Text>  <Text bold>3</Text> = Stage list</Text>
            <Text>  <Text bold>6</Text> = Streaming demo</Text>
            <Text>  <Text bold>Esc</Text> = Stage list          <Text bold>q</Text> = Quit</Text>
          </Box>
        )}

        {/* OPTIONS — selectable choices with inline text field */}
        {view === 'options' && (
          <Box flexDirection="column">
            <OptionSelect
              options={FAKE_OPTIONS}
              onSelect={() => {
                setView('home')
              }}
            />
          </Box>
        )}

        {/* STREAMING DEMO — spinner then character-by-character */}
        {view === 'streaming' && (
          <Box flexDirection="column">
            {showSpinner ? (
              <Spinner label="Thinking..." />
            ) : (
              <Text>{streamText}<Text dimColor>▊</Text></Text>
            )}
          </Box>
        )}

        {/* STAGE LIST — now includes Build with confirmation */}
        {view === 'stage_list' && (
          <StageListView
            stages={stages}
            currentStageId={currentStage?.id ?? null}
            progress={progress}
            onResult={(result) => {
              if (result.kind === 'build') {
                app.exit()
              } else if (result.kind === 'select') {
                setView('home')
              }
            }}
          />
        )}
      </Box>

      <Footer
        progress={progress}
        stages={stages}
        terminalWidth={width}
        mode={view === 'stage_list' ? 'stage_list' : view === 'options' ? 'options' : 'decisions'}
      />
    </Box>
  )
}

async function main() {
  const ink = withFullScreen(React.createElement(MockApp))
  await ink.start()
  await ink.waitUntilExit()
  console.log('Mockup exited.')
}

main()
