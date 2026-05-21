import type { FastifyPluginAsync } from 'fastify'
import type { AppContext } from '../context.js'
import type { AtcPluginExtendedMetrics } from '@atc/shared-types'

export const metricsRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (
  fastify,
  { ctx },
) => {
  const { eventBus, pluginRegistry, scopedEventBus, pluginLifecycle } = ctx

  // ── GET /api/v1/metrics/eventbus ─────────────────────────────────────────────
  fastify.get('/api/v1/metrics/eventbus', async (_req, reply) => {
    return reply.code(200).send(eventBus.getMetrics())
  })

  // ── GET /api/v1/metrics/plugins ──────────────────────────────────────────────
  fastify.get('/api/v1/metrics/plugins', async (_req, reply) => {
    const subscriptionCounts = scopedEventBus.getAllSubscriptionCounts()

    const plugins: AtcPluginExtendedMetrics[] = pluginRegistry.getAll().map((record) => {
      const container = pluginLifecycle.getContainer(record.id)
      const activeTimers = container
        ? container.cleanup.activeTimers() + container.cleanup.activeIntervals()
        : 0

      return {
        id: record.id,
        status: record.status,
        healthStatus: record.health.status,
        restartCount: record.health.restartCount,
        failures: record.health.failureCount,
        eventsHandled: pluginRegistry.getEventsHandled(record.id),
        avgExecutionMs: pluginRegistry.getAvgExecutionMs(record.id),
        lastError: record.lastError,
        apiCalls: pluginRegistry.getApiCalls(record.id),
        deniedCalls: pluginRegistry.getDeniedCalls(record.id),
        activeSubscriptions: subscriptionCounts[record.id] ?? 0,
        activeTimers,
        uptimeMs: pluginRegistry.getUptimeMs(record.id),
      }
    })

    return reply.code(200).send({ plugins })
  })

  // ── GET /api/v1/metrics/runtime ──────────────────────────────────────────────
  fastify.get('/api/v1/metrics/runtime', async (_req, reply) => {
    const mem = process.memoryUsage()
    const redisConnected = (() => {
      try {
        return (ctx.redis as { status?: string }).status === 'ready'
      } catch {
        return false
      }
    })()
    return reply.code(200).send({
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsage: {
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
        rssBytes: mem.rss,
        externalBytes: mem.external,
      },
      activeRateLimits: 0,
      redisConnected,
    })
  })
}
