import { execFileSync } from 'node:child_process'

export interface PlatformConfig {
  platform: string
  cliName: string
  cliBinary: string
  authCheckCmd: string[]
  installCmd: string
  authCmd: string
  deployCmd: string
  envVarCmd: string
}

export interface ReadinessResult {
  platform: string
  cliInstalled: boolean
  cliName: string
  authenticated: boolean | null
  installCmd: string
  authCmd: string
  deployCmd: string
  envVarCmd: string
}

const PLATFORMS: PlatformConfig[] = [
  {
    platform: 'AWS Amplify',
    cliName: 'amplify',
    cliBinary: 'amplify',
    authCheckCmd: ['amplify', 'status'],
    installCmd: 'npm i -g @aws-amplify/cli',
    authCmd: 'amplify configure',
    deployCmd: 'npm run deploy',
    envVarCmd: 'See AWS Amplify console for environment variables',
  },
  {
    platform: 'AWS CDK',
    cliName: 'cdk',
    cliBinary: 'cdk',
    authCheckCmd: ['aws', 'sts', 'get-caller-identity'],
    installCmd: 'npm i -g aws-cdk',
    authCmd: 'aws configure',
    deployCmd: 'npm run deploy',
    envVarCmd: 'aws ssm put-parameter --name KEY --value VAL --type String',
  },
  {
    platform: 'AWS SST',
    cliName: 'sst',
    cliBinary: 'npx',
    authCheckCmd: ['aws', 'sts', 'get-caller-identity'],
    installCmd: '(uses npx — no global install needed)',
    authCmd: 'aws configure',
    deployCmd: 'npm run deploy',
    envVarCmd: 'aws ssm put-parameter --name KEY --value VAL --type String',
  },
  {
    platform: 'Vercel',
    cliName: 'vercel',
    cliBinary: 'vercel',
    authCheckCmd: ['vercel', 'whoami'],
    installCmd: 'npm i -g vercel',
    authCmd: 'vercel login',
    deployCmd: 'npm run deploy',
    envVarCmd: 'vercel env add',
  },
  {
    platform: 'AWS',
    cliName: 'aws',
    cliBinary: 'aws',
    authCheckCmd: ['aws', 'sts', 'get-caller-identity'],
    installCmd: 'See https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html',
    authCmd: 'aws configure',
    deployCmd: 'npm run deploy',
    envVarCmd: 'aws ssm put-parameter --name KEY --value VAL --type String',
  },
  {
    platform: 'GCP',
    cliName: 'gcloud',
    cliBinary: 'gcloud',
    authCheckCmd: ['gcloud', 'auth', 'print-identity-token'],
    installCmd: 'See https://cloud.google.com/sdk/docs/install',
    authCmd: 'gcloud auth login',
    deployCmd: 'npm run deploy',
    envVarCmd: 'gcloud run services update SERVICE --set-env-vars KEY=VAL',
  },
  {
    platform: 'Docker',
    cliName: 'docker',
    cliBinary: 'docker',
    authCheckCmd: ['docker', 'info'],
    installCmd: 'See https://docs.docker.com/get-docker/',
    authCmd: 'docker login',
    deployCmd: 'npm run deploy',
    envVarCmd: 'Set variables in docker-compose.yml or .env',
  },
  {
    platform: 'Railway',
    cliName: 'railway',
    cliBinary: 'railway',
    authCheckCmd: ['railway', 'whoami'],
    installCmd: 'npm i -g @railway/cli',
    authCmd: 'railway login',
    deployCmd: 'npm run deploy',
    envVarCmd: 'railway variables set KEY=VAL',
  },
  {
    platform: 'Fly.io',
    cliName: 'fly',
    cliBinary: 'fly',
    authCheckCmd: ['fly', 'auth', 'whoami'],
    installCmd: 'See https://fly.io/docs/flyctl/install/',
    authCmd: 'fly auth login',
    deployCmd: 'npm run deploy',
    envVarCmd: 'fly secrets set KEY=VAL',
  },
]

const KEYWORD_MATCHERS: Array<{ test: (s: string) => boolean; platform: PlatformConfig }> = (() => {
  const byPlatform = (name: string) => PLATFORMS.find((p) => p.platform === name)!
  return [
    { test: (s) => s.includes('amplify'), platform: byPlatform('AWS Amplify') },
    { test: (s) => s.includes('cdk'), platform: byPlatform('AWS CDK') },
    { test: (s) => s.includes('sst'), platform: byPlatform('AWS SST') },
    { test: (s) => s.includes('vercel'), platform: byPlatform('Vercel') },
    { test: (s) => s.includes('aws') || s.includes('lambda') || s.includes('ec2'), platform: byPlatform('AWS') },
    { test: (s) => s.includes('gcp') || s.includes('google cloud') || s.includes('cloud run'), platform: byPlatform('GCP') },
    { test: (s) => s.includes('docker') || s.includes('container'), platform: byPlatform('Docker') },
    { test: (s) => s.includes('railway'), platform: byPlatform('Railway') },
    { test: (s) => s.includes('fly.io') || s === 'fly' || s.startsWith('fly '), platform: byPlatform('Fly.io') },
  ]
})()

const FALLBACK_CONFIG: PlatformConfig = {
  platform: 'Unknown',
  cliName: '',
  cliBinary: '',
  authCheckCmd: [],
  installCmd: '',
  authCmd: '',
  deployCmd: 'npm run deploy',
  envVarCmd: 'See README.md for environment variable instructions',
}

export function normalizePlatform(deploymentComponent: string): PlatformConfig {
  const lower = deploymentComponent.toLowerCase()
  for (const matcher of KEYWORD_MATCHERS) {
    if (matcher.test(lower)) {
      return matcher.platform
    }
  }
  return FALLBACK_CONFIG
}
