type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }
const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'info'

function log(level: LogLevel, component: string, msg: string, data?: Record<string, unknown>) {
  if (LEVELS[level] < LEVELS[currentLevel]) return
  const prefix = `[${level}] [${component}]`
  const line = data ? `${prefix} ${msg} ${JSON.stringify(data)}` : `${prefix} ${msg}`
  process.stderr.write(line + '\n')
}

export function createLogger(component: string) {
  return {
    debug: (data: Record<string, unknown>, msg: string) => log('debug', component, msg, data),
    info: (data: Record<string, unknown>, msg: string) => log('info', component, msg, data),
    warn: (data: Record<string, unknown>, msg: string) => log('warn', component, msg, data),
    error: (data: Record<string, unknown>, msg: string) => log('error', component, msg, data),
  }
}
