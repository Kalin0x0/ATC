import type { FastifyPluginAsync } from 'fastify'
import type { AppContext } from '../context.js'

export const runtimeRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (
  fastify,
  { ctx },
) => {
  const { taskRuntime, eventStore } = ctx

  // ── GET /api/v1/runtime/tasks ─────────────────────────────────────────────────
  fastify.get('/api/v1/runtime/tasks', async (_req, reply) => {
    const metrics = await taskRuntime.getQueueMetrics().catch(() => taskRuntime.getMetrics())
    return reply.code(200).send({
      queuedTotal: metrics.queuedTotal,
      completedTotal: metrics.completedTotal,
      failedTotal: metrics.failedTotal,
      retriedTotal: metrics.retriedTotal,
      avgRuntimeMs: metrics.avgRuntimeMs,
      queues: metrics.queues,
    })
  })

  // ── GET /api/v1/runtime/workers ───────────────────────────────────────────────
  fastify.get('/api/v1/runtime/workers', async (_req, reply) => {
    const workers = taskRuntime.getWorkerMetrics()
    const activeWorkers = workers.filter((w) => w.isRunning).length
    return reply.code(200).send({
      activeWorkers,
      workers,
    })
  })

  // ── GET /api/v1/runtime/queues ────────────────────────────────────────────────
  fastify.get('/api/v1/runtime/queues', async (_req, reply) => {
    const metrics = await taskRuntime.getQueueMetrics().catch(() => taskRuntime.getMetrics())
    const eventStreams = eventStore.getAllStreamNames()

    return reply.code(200).send({
      queues: metrics.queues,
      eventStreams: eventStreams.map((name) => ({ name })),
    })
  })
}
