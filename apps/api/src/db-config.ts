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

/**
 * Just the database connection, without the rest of the server's configuration.
 *
 * The migrate and seed commands need nothing but this, and importing the whole
 * config made them fail on a missing ATC_API_TOKEN — an API auth token has no
 * bearing on creating tables, and demanding it turns the first command someone
 * runs on a fresh checkout into a puzzle.
 */
export const dbConfig = {
  host: optional('DB_HOST', '127.0.0.1'),
  port: optionalInt('DB_PORT', 3306),
  database: required('DB_NAME'),
  user: required('DB_USER'),
  password: required('DB_PASSWORD'),
  connectionLimit: optionalInt('DB_CONNECTION_LIMIT', 10),
} as const
