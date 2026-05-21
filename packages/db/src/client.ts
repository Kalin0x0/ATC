import mysql from 'mysql2/promise'

export type DbPool = mysql.Pool

export interface DbConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
  connectionLimit?: number
}

export function createPool(config: DbConfig): DbPool {
  return mysql.createPool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    connectionLimit: config.connectionLimit ?? 10,
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    timezone: '+00:00',
    charset: 'utf8mb4',
  })
}

export async function testConnection(pool: DbPool): Promise<void> {
  const conn = await pool.getConnection()
  await conn.ping()
  conn.release()
}
