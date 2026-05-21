import type { FastifyPluginAsync } from 'fastify'
import type { AppContext } from '../context.js'

export const healthRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (fastify, opts) => {
  fastify.get('/health', async (_req, reply) => {
    let dbOk = false
    let redisOk = false

    try {
      const conn = await opts.ctx.pool.getConnection()
      await conn.ping()
      conn.release()
      dbOk = true
    } catch {
      // intentionally swallowed — we report status below
    }

    try {
      await opts.ctx.redis.ping()
      redisOk = true
    } catch {
      // intentionally swallowed
    }

    const status = dbOk && redisOk ? 'ok' : 'degraded'
    const code = status === 'ok' ? 200 : 503

    return reply.code(code).send({
      status,
      components: { db: dbOk ? 'ok' : 'error', redis: redisOk ? 'ok' : 'error' },
      timestamp: new Date().toISOString(),
    })
  })
}
