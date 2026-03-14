import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from 'ink-testing-library'
import { Box, Text } from 'ink'
import { Header } from '../../src/cli/components/header.js'
import { Footer } from '../../src/cli/components/footer.js'
import { ProjectInfoForm } from '../../src/cli/components/project-info-form.js'
import { StageListView } from '../../src/cli/components/stage-list.js'
import { createProgress, setDecision } from '../../src/agent/progress.js'
import { applyRecommendations } from '../../src/agent/recommend.js'
import { DEFAULT_STAGES, type StageEntry } from '../../src/agent/stages.js'

function makeStages(overrides: Partial<Record<string, Partial<StageEntry>>> = {}): StageEntry[] {
  const stages = structuredClone(DEFAULT_STAGES)
  for (const [id, patch] of Object.entries(overrides)) {
    const stage = stages.find((s) => s.id === id)
    if (stage) Object.assign(stage, patch)
  }
  return stages
}

describe('Header', () => {
  it('renders app name and stage name', () => {
    const stages = makeStages()
    const current = stages[1] // frontend
    const { lastFrame } = render(
      <Header appName="stack-agent" currentStage={current} stages={stages} showDots={false} />
    )
    const output = lastFrame()
    expect(output).toContain('stack-agent')
    expect(output).toContain('Frontend')
  })

  it('shows "Stack Progress" when no current stage', () => {
    const stages = makeStages()
    const { lastFrame } = render(
      <Header appName="stack-agent" currentStage={null} stages={stages} showDots={false} />
    )
    expect(lastFrame()).toContain('Stack Progress')
  })

  it('shows dots when showDots is true', () => {
    const stages = makeStages({
      project_info: { status: 'complete', confirmed: true },
      frontend: { status: 'complete' }, // suggested, not confirmed
    })
    const current = stages[2] // backend
    const { lastFrame } = render(
      <Header appName="stack-agent" currentStage={current} stages={stages} showDots={true} />
    )
    const output = lastFrame()
    // Should contain dot characters
    expect(output).toContain('●')
    expect(output).toContain('○')
  })

  it('hides dots when showDots is false', () => {
    const stages = makeStages({
      project_info: { status: 'complete', confirmed: true },
    })
    const { lastFrame } = render(
      <Header appName="stack-agent" currentStage={null} stages={stages} showDots={false} />
    )
    // Should not contain progress dots (only border chars)
    const output = lastFrame()
    expect(output).not.toContain('●')
    expect(output).not.toContain('○')
  })

  it('renders within border frame', () => {
    const stages = makeStages()
    const { lastFrame } = render(
      <Header appName="stack-agent" currentStage={null} stages={stages} />
    )
    const output = lastFrame()
    // Should have top border (┌...┐) but no bottom border
    expect(output).toContain('┌')
    expect(output).toContain('┐')
    expect(output).not.toContain('└')
    expect(output).not.toContain('┘')
  })
})

describe('Footer', () => {
  it('renders decisions in decisions mode', () => {
    let progress = createProgress()
    progress = { ...progress, projectName: 'my-app' }
    progress = setDecision(progress, 'frontend', { component: 'Next.js', reasoning: 'test' })
    const stages = makeStages()

    const { lastFrame } = render(
      <Footer progress={progress} stages={stages} terminalWidth={120} mode="decisions" />
    )
    const output = lastFrame()
    expect(output).toContain('Project: my-app')
    expect(output).toContain('Frontend: Next.js')
  })

  it('renders navigation hints in stage_list mode', () => {
    const progress = createProgress()
    const stages = makeStages()

    const { lastFrame } = render(
      <Footer progress={progress} stages={stages} terminalWidth={120} mode="stage_list" />
    )
    const output = lastFrame()
    expect(output).toContain('navigate')
    expect(output).toContain('Enter')
    expect(output).toContain('Esc')
  })

  it('renders input hints in input mode', () => {
    const progress = createProgress()
    const stages = makeStages()

    const { lastFrame } = render(
      <Footer progress={progress} stages={stages} terminalWidth={120} mode="input" />
    )
    const output = lastFrame()
    expect(output).toContain('Enter submit')
    expect(output).toContain('Esc')
  })

  it('renders within border frame (bottom, no top)', () => {
    const progress = createProgress()
    const stages = makeStages()

    const { lastFrame } = render(
      <Footer progress={progress} stages={stages} terminalWidth={120} />
    )
    const output = lastFrame()
    expect(output).toContain('└')
    expect(output).toContain('┘')
    expect(output).not.toContain('┌')
    expect(output).not.toContain('┐')
  })
})

describe('ProjectInfoForm', () => {
  it('renders title and name prompt', () => {
    const { lastFrame } = render(
      <ProjectInfoForm onSubmit={() => {}} />
    )
    const output = lastFrame()
    expect(output).toContain('set up your project')
    expect(output).toContain('Project name')
  })

  it('shows name field hint', () => {
    const { lastFrame } = render(
      <ProjectInfoForm onSubmit={() => {}} />
    )
    expect(lastFrame()).toContain('Enter a name')
  })
})

describe('StageListView after recommendations', () => {
  it('renders LLM suggestions with yellow markers and summaries', () => {
    const progress = createProgress()
    const stages = structuredClone(DEFAULT_STAGES)

    // Simulate: project info confirmed by user
    stages[0].status = 'complete'
    stages[0].confirmed = true
    stages[0].summary = 'my-app: a chatbot'

    // Apply LLM recommendations
    const recommendations = {
      frontend: { component: 'Next.js', reasoning: 'Best for SaaS' },
      backend: null,
      database: { component: 'Postgres + Drizzle', reasoning: 'Great TS support' },
      auth: { component: 'Clerk', reasoning: 'Easy auth' },
      payments: null,
      ai: { component: 'OpenAI', reasoning: 'Best models' },
      deployment: { component: 'Vercel', reasoning: 'Native Next.js' },
    }
    const { progress: updatedProgress } = applyRecommendations(progress, stages, recommendations)

    const { lastFrame } = render(
      <StageListView
        stages={stages}
        currentStageId={null}
        progress={updatedProgress}
        onResult={() => {}}
      />
    )
    const output = lastFrame()

    // User-confirmed stage (green ✓)
    expect(output).toContain('✓ Project Info')
    expect(output).toContain('my-app: a chatbot')

    // LLM-suggested stages (yellow ◆ with "suggested")
    expect(output).toContain('◆ Frontend')
    expect(output).toContain('Next.js')
    expect(output).toContain('suggested')

    expect(output).toContain('◆ Database')
    expect(output).toContain('Postgres + Drizzle')

    expect(output).toContain('◆ Auth')
    expect(output).toContain('Clerk')

    expect(output).toContain('◆ AI/LLM')
    expect(output).toContain('OpenAI')

    expect(output).toContain('◆ Deployment')
    expect(output).toContain('Vercel')

    // Skipped stages (–)
    expect(output).toContain('– Backend')
    expect(output).toContain('skipped')

    expect(output).toContain('– Payments')

    // Build option should show ready (all required decisions present)
    expect(output).toContain('★ Build')
  })

  it('renders pending stages when no recommendations given', () => {
    const progress = createProgress()
    const stages = structuredClone(DEFAULT_STAGES)

    const { lastFrame } = render(
      <StageListView
        stages={stages}
        currentStageId="project_info"
        progress={progress}
        onResult={() => {}}
      />
    )
    const output = lastFrame()

    // Current stage
    expect(output).toContain('● Project Info')
    expect(output).toContain('needs your input')

    // Pending stages
    expect(output).toContain('○ Frontend')
    expect(output).toContain('○ Backend')

    // Build should show remaining count
    expect(output).toContain('remaining')
  })

  it('shows mix of confirmed and suggested stages', () => {
    const progress = createProgress()
    const stages = structuredClone(DEFAULT_STAGES)

    // User confirmed project info and frontend
    stages[0].status = 'complete'
    stages[0].confirmed = true
    stages[0].summary = 'my-app'

    stages[1].status = 'complete'
    stages[1].confirmed = true
    stages[1].summary = 'Next.js'

    // LLM suggested database
    stages[3].status = 'complete'
    stages[3].confirmed = false
    stages[3].summary = 'Postgres'

    const { lastFrame } = render(
      <StageListView
        stages={stages}
        currentStageId="backend"
        progress={progress}
        onResult={() => {}}
      />
    )
    const output = lastFrame()

    // Confirmed shows green ✓
    expect(output).toContain('✓ Project Info')
    expect(output).toContain('✓ Frontend')

    // Suggested shows yellow ◆
    expect(output).toContain('◆ Database')
    expect(output).toContain('Postgres')
    expect(output).toContain('suggested')

    // Current shows cyan ●
    expect(output).toContain('● Backend')
  })
})

describe('StageListView Build option', () => {
  it('shows Build without remaining count when all required decisions are present', () => {
    let progress = createProgress()
    progress = { ...progress, projectName: 'my-app', description: 'test' }
    progress = setDecision(progress, 'frontend', { component: 'Next.js', reasoning: 'test' })
    progress = setDecision(progress, 'database', { component: 'Postgres', reasoning: 'test' })
    progress = setDecision(progress, 'deployment', { component: 'Vercel', reasoning: 'test' })

    const stages = structuredClone(DEFAULT_STAGES)
    stages[0].status = 'complete'
    stages[1].status = 'complete'
    stages[3].status = 'complete'
    stages[7].status = 'complete'

    const { lastFrame } = render(
      <StageListView stages={stages} currentStageId={null} progress={progress} onResult={() => {}} />
    )
    const output = lastFrame()
    expect(output).toContain('★ Build')
    expect(output).not.toContain('remaining')
  })

  it('shows Build with remaining count when required decisions are missing', () => {
    const progress = createProgress()
    const stages = structuredClone(DEFAULT_STAGES)

    const { lastFrame } = render(
      <StageListView stages={stages} currentStageId="project_info" progress={progress} onResult={() => {}} />
    )
    const output = lastFrame()
    expect(output).toContain('★ Build')
    expect(output).toContain('remaining')
  })
})

describe('Frame layout', () => {
  it('header + content + footer fit within terminal height', () => {
    const stages = makeStages()
    const progress = createProgress()
    const terminalHeight = 24
    const terminalWidth = 80

    // Header = 2 lines (top border + content)
    // Footer = 2 lines (content + bottom border)
    // Content = terminalHeight - 4
    const contentHeight = terminalHeight - 4

    const { lastFrame } = render(
      <Box flexDirection="column" width={terminalWidth} height={terminalHeight}>
        <Header appName="stack-agent" currentStage={null} stages={stages} />
        <Box
          flexDirection="column"
          height={contentHeight}
          paddingX={1}
          borderStyle="single"
          borderTop={false}
          borderBottom={false}
        >
          <Text>Content line 1</Text>
          <Text>Content line 2</Text>
        </Box>
        <Footer progress={progress} stages={stages} terminalWidth={terminalWidth} />
      </Box>
    )

    const output = lastFrame()
    const lines = output.split('\n')

    // Total output should not exceed terminal height
    expect(lines.length).toBeLessThanOrEqual(terminalHeight)

    // First line should be header top border
    expect(lines[0]).toContain('┌')

    // Last line should be footer bottom border
    expect(lines[lines.length - 1]).toContain('└')

    // Content should be contained within
    expect(output).toContain('Content line 1')
    expect(output).toContain('Content line 2')
  })

  it('content does not overflow when there are many lines', () => {
    const stages = makeStages()
    const progress = createProgress()
    const terminalHeight = 10
    const terminalWidth = 80
    const contentHeight = terminalHeight - 4

    // Generate more lines than content area can hold
    const manyLines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`)

    const { lastFrame } = render(
      <Box flexDirection="column" width={terminalWidth} height={terminalHeight}>
        <Header appName="stack-agent" currentStage={null} stages={stages} />
        <Box
          flexDirection="column"
          height={contentHeight}
          paddingX={1}
          borderStyle="single"
          borderTop={false}
          borderBottom={false}
        >
          {manyLines.map((line, i) => (
            <Text key={i}>{line}</Text>
          ))}
        </Box>
        <Footer progress={progress} stages={stages} terminalWidth={terminalWidth} />
      </Box>
    )

    const output = lastFrame()
    const lines = output.split('\n')

    // Should not exceed terminal height
    expect(lines.length).toBeLessThanOrEqual(terminalHeight)

    // Frame should still be intact
    expect(lines[0]).toContain('┌')
    expect(lines[lines.length - 1]).toContain('└')
  })
})
