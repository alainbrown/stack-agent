import * as p from '@clack/prompts'
import type { UserRequirements } from '../llm/schemas.js'

const validNameRegex = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/

export async function collectRequirements(): Promise<UserRequirements> {
  const projectName = await p.text({
    message: 'What is your project name?',
    placeholder: 'my-app',
    validate(value) {
      if (!value) return 'Project name is required'
      if (!validNameRegex.test(value)) {
        return 'Must be lowercase, alphanumeric, hyphens/dots/underscores only'
      }
    },
  })

  if (p.isCancel(projectName)) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  const description = await p.text({
    message: 'Describe what you are building in a sentence',
    placeholder: 'A SaaS analytics platform for small businesses',
    validate(value) {
      if (!value) return 'Description is required'
    },
  })

  if (p.isCancel(description)) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  const scale = await p.select({
    message: 'Expected scale?',
    options: [
      { value: 'hobby' as const, label: 'Hobby / side project' },
      { value: 'startup' as const, label: 'Startup' },
      { value: 'enterprise' as const, label: 'Enterprise' },
    ],
  })

  if (p.isCancel(scale)) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  const frontend = await p.select({
    message: 'Frontend framework?',
    options: [
      { value: 'nextjs' as const, label: 'Next.js' },
      { value: 'react-spa' as const, label: 'React SPA' },
      { value: 'none' as const, label: 'None (API only)' },
    ],
  })

  if (p.isCancel(frontend)) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  const needsAuth = await p.confirm({
    message: 'Need authentication?',
  })

  if (p.isCancel(needsAuth)) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  const needsPayments = await p.confirm({
    message: 'Need payments?',
  })

  if (p.isCancel(needsPayments)) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  return {
    projectName,
    description,
    scale,
    frontend,
    needsAuth,
    needsPayments,
  }
}
