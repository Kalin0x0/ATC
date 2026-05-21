function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = parseInt(raw, 10)
  if (isNaN(parsed)) throw new Error(`Environment variable ${name} must be an integer`)
  return parsed
}

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = parseInt(raw, 10)
  if (isNaN(parsed) || parsed < 1)
    throw new Error(`Environment variable ${name} must be a positive integer (got: ${raw})`)
  return parsed
}

export const config = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: optionalInt('PORT', 3000),
  host: optional('HOST', '0.0.0.0'),

  apiToken: required('ATC_API_TOKEN'),
  failOpen: optional('ATC_FAIL_OPEN', 'false') === 'true',

  db: {
    host: optional('DB_HOST', '127.0.0.1'),
    port: optionalInt('DB_PORT', 3306),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    connectionLimit: optionalInt('DB_CONNECTION_LIMIT', 10),
  },

  redis: {
    host: optional('REDIS_HOST', '127.0.0.1'),
    port: optionalInt('REDIS_PORT', 6379),
    password: process.env['REDIS_PASSWORD'],
    db: optionalInt('REDIS_DB', 0),
  },

  log: {
    level: optional('LOG_LEVEL', 'info'),
    format: optional('LOG_FORMAT', 'json'),
  },

  vitals: {
    mutationRateLimit: positiveInt('ATC_VITALS_MUTATION_RATE_LIMIT', 60),
    mutationRateWindowSeconds: positiveInt('ATC_VITALS_MUTATION_RATE_WINDOW_SECONDS', 60),
  },

  eventBus: {
    redisEnabled: optional('ATC_EVENTBUS_REDIS_ENABLED', 'false') === 'true',
    metricsEnabled: optional('ATC_EVENTBUS_METRICS_ENABLED', 'true') === 'true',
  },

  nodeId: optional('ATC_NODE_ID', 'atc-api-1'),

  plugin: {
    lifecycleTimeoutMs: positiveInt('ATC_PLUGIN_LIFECYCLE_TIMEOUT_MS', 10_000),
    maxFailures: positiveInt('ATC_PLUGIN_MAX_FAILURES', 5),
  },
} as const
