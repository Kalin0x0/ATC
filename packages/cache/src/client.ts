import { Redis } from 'ioredis'

/**
 * The Redis connection every cache in this package takes.
 *
 * It is ioredis' own client type rather than a hand-written interface, because
 * the same connection is handed to `@atc/plugin-state`, `@atc/events`,
 * `@atc/task-runtime`, `@atc/event-store` and `@atc/runtime-node`, each of which
 * declares its own structural slice of it (`BridgeRedisLike`, `RedisStreamLike`
 * and so on). A narrower type here would have to be the union of all of them and
 * would break whenever one of those packages reached for another command.
 */
export type RedisClient = Redis

export interface RedisConnectionOptions {
  host: string
  port: number
  password?: string
  db?: number
  /**
   * How long to wait for a connection before giving up, in milliseconds.
   * The default is deliberately short: the API decides for itself whether to
   * start without Redis, and it cannot decide anything while still waiting.
   */
  connectTimeoutMs?: number
}

/**
 * Build a Redis client without connecting it.
 *
 * `lazyConnect` is what makes the two-step create/connect split meaningful:
 * ioredis otherwise dials on construction and reports failures through an
 * `error` event, which is an awkward thing for a startup path to await. With it,
 * `connectRedis` below is a plain promise that resolves or rejects.
 */
export function createRedisClient(opts: RedisConnectionOptions): RedisClient {
  return new Redis({
    host: opts.host,
    port: opts.port,
    ...(opts.password !== undefined ? { password: opts.password } : {}),
    db: opts.db ?? 0,
    lazyConnect: true,
    connectTimeout: opts.connectTimeoutMs ?? 10_000,
    // Commands issued while the connection is down fail immediately rather than
    // queueing. A cache read that hangs is worse than one that misses: callers
    // here are all written to fall back to the database on failure.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 2,
    // Backoff caps at 5s so a server that starts before Redis reconnects on its
    // own rather than retrying in a tight loop forever.
    retryStrategy: (times: number) => Math.min(times * 200, 5_000),
  })
}

/**
 * Connect a lazily-created client and wait until it is usable.
 *
 * Rejects if the connection fails, so a caller that wants to abort startup can,
 * and one that wants to continue degraded can catch. Calling it on a client that
 * is already connected resolves rather than throwing, so a retrying caller does
 * not have to track the state itself.
 */
export async function connectRedis(client: RedisClient): Promise<RedisClient> {
  if (client.status === 'ready') return client
  if (client.status === 'connecting' || client.status === 'connect') {
    await new Promise<void>((resolve, reject) => {
      const onReady = (): void => { cleanup(); resolve() }
      const onError = (err: Error): void => { cleanup(); reject(err) }
      const cleanup = (): void => {
        client.off('ready', onReady)
        client.off('error', onError)
      }
      client.once('ready', onReady)
      client.once('error', onError)
    })
    return client
  }
  await client.connect()
  return client
}
