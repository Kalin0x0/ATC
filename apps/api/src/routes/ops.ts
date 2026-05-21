import type { FastifyPluginAsync } from 'fastify'
import type { AppContext } from '../context.js'
import {
  AtcHealthService,
  dlqQuerySchema,
  requeueTaskSchema,
  opsEventQuerySchema,
  diagnosticsQuerySchema,
} from '@atc/operations'
import {
  PluginNotFoundError,
  PluginConcurrentOperationError,
} from '@atc/plugin-registry'

export const opsRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (
  fastify,
  { ctx },
) => {
  const { pool, redis, eventBus, taskRuntime, eventStore, pluginRegistry, telemetry } = ctx

  const healthService = new AtcHealthService({
    db: pool,
    redis,
    eventBus,
    taskRuntime,
    eventStore,
    pluginRuntime: {
      getAll: () =>
        pluginRegistry.getAll().map((p) => ({
          id: p.id,
          status: p.status,
          healthStatus: p.health.status,
          failureCount: p.health.failureCount,
        })),
    },
  })

  // ── Unauthenticated probes ────────────────────────────────────────────────────

  fastify.get('/api/v1/ops/live', async (_req, reply) => {
    return reply.code(200).send({ status: 'ok' })
  })

  fastify.get('/api/v1/ops/ready', async (_req, reply) => {
    try {
      const [dbHealth, redisHealth] = await Promise.all([
        healthService.checkDb(),
        healthService.checkRedis(),
      ])
      const ready = dbHealth.status !== 'failed' && redisHealth.status !== 'failed'
      if (!ready) {
        telemetry.increment('ops.readiness_failed_total')
        return reply.code(503).send({ status: 'not_ready' })
      }
      return reply.code(200).send({ status: 'ready' })
    } catch {
      telemetry.increment('ops.readiness_failed_total')
      return reply.code(503).send({ status: 'not_ready' })
    }
  })

  // ── Health ────────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/ops/health', async (_req, reply) => {
    telemetry.increment('ops.health_checks_total')
    const snapshot = await healthService.getSnapshot()
    const hasFailures = Object.values(snapshot.subsystems).some((s) => s.status === 'failed')
    if (hasFailures) telemetry.increment('ops.health_failed_total')
    return reply.code(200).send(snapshot)
  })

  // ── Diagnostics ───────────────────────────────────────────────────────────────

  fastify.get('/api/v1/ops/diagnostics', async (req, reply) => {
    telemetry.increment('ops.diagnostics_requests_total')
    const query = diagnosticsQuerySchema.parse(req.query)
    const snapshot = await healthService.getSnapshot()

    let subsystems: Record<string, unknown> = snapshot.subsystems
    if (query.include) {
      const keys = new Set(query.include.split(',').map((k) => k.trim()))
      subsystems = Object.fromEntries(
        Object.entries(snapshot.subsystems).filter(([k]) => keys.has(k)),
      )
    }

    return reply.code(200).send({
      status: snapshot.status,
      subsystems,
      checkedAt: snapshot.checkedAt,
      taskRuntime: taskRuntime.getMetrics(),
      eventStreams: eventStore.getAllStreamNames(),
    })
  })

  // ── Dead-letter queue ─────────────────────────────────────────────────────────

  fastify.get('/api/v1/ops/tasks/dead-letter', async (req, reply) => {
    const query = dlqQuerySchema.parse(req.query)
    const result = await taskRuntime.listDeadLetter(query.limit, query.offset)
    return reply.code(200).send(result)
  })

  fastify.post('/api/v1/ops/tasks/requeue', async (req, reply) => {
    const body = requeueTaskSchema.parse(req.body)
    const requeued = await taskRuntime.requeueDeadLetterTask(body.taskId)
    if (!requeued) {
      return reply.code(404).send({ error: 'Task not found in dead-letter queue' })
    }
    return reply.code(200).send({ taskId: body.taskId, requeued: true })
  })

  // ── Event store ───────────────────────────────────────────────────────────────

  fastify.get('/api/v1/ops/events', async (req, reply) => {
    const query = opsEventQuerySchema.parse(req.query)
    const page = await eventStore.listEvents({
      ...(query.eventName !== undefined ? { eventName: query.eventName } : {}),
      limit: query.limit,
      ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
    })
    return reply.code(200).send(page)
  })

  // ── Plugin health ─────────────────────────────────────────────────────────────

  fastify.get('/api/v1/ops/plugins/health', async (_req, reply) => {
    const plugins = pluginRegistry.getAll()
    return reply.code(200).send({
      total: plugins.length,
      plugins: plugins.map((p) => ({
        id: p.id,
        version: p.version,
        status: p.status,
        healthStatus: p.health.status,
        failureCount: p.health.failureCount,
        restartCount: p.health.restartCount,
        lastError: p.health.lastError,
        loadedAt: p.loadedAt,
      })),
    })
  })

  // ── Plugin lifecycle management ───────────────────────────────────────────────

  fastify.get('/api/v1/ops/plugins', async (_req, reply) => {
    const plugins = pluginRegistry.getAll()
    return reply.code(200).send({
      total: plugins.length,
      plugins: plugins.map((p) => {
        const container = ctx.pluginContainers?.get(p.id)
        const snapshot = container?.getHealthSnapshot()
        return {
          id: p.id,
          version: p.version,
          state: p.status,
          healthStatus: p.health.status,
          failureCount: p.health.failureCount,
          restartCount: snapshot?.restartCount ?? p.health.restartCount,
          crashCount: snapshot?.crashCount ?? 0,
          lastError: p.health.lastError,
          loadedAt: p.loadedAt,
          uptimeMs: snapshot?.uptimeMs ?? 0,
          resourceUsage: snapshot?.resourceUsage ?? null,
        }
      }),
    })
  })

  fastify.get('/api/v1/ops/plugins/:pluginId', async (req, reply) => {
    const { pluginId } = req.params as { pluginId: string }
    const plugin = pluginRegistry.get(pluginId)
    if (!plugin) {
      return reply.code(404).send({ error: `Plugin '${pluginId}' not found` })
    }
    const container = ctx.pluginContainers?.get(pluginId)
    const snapshot = container?.getHealthSnapshot()
    return reply.code(200).send({
      id: plugin.id,
      version: plugin.version,
      capabilities: plugin.capabilities,
      dependencies: plugin.dependencies,
      state: plugin.status,
      healthStatus: plugin.health.status,
      failureCount: plugin.health.failureCount,
      restartCount: snapshot?.restartCount ?? plugin.health.restartCount,
      crashCount: snapshot?.crashCount ?? 0,
      lastError: plugin.health.lastError,
      lastCrashAt: snapshot?.lastCrashAt ?? null,
      loadedAt: plugin.loadedAt,
      uptimeMs: snapshot?.uptimeMs ?? 0,
      resourceUsage: snapshot?.resourceUsage ?? null,
      lifecycleMetrics: plugin.lifecycleMetrics,
    })
  })

  fastify.post('/api/v1/ops/plugins/:pluginId/start', async (req, reply) => {
    const { pluginId } = req.params as { pluginId: string }
    try {
      await ctx.pluginLifecycle.start(pluginId)
      telemetry.increment('plugins.active_total')
      return reply.code(200).send({ pluginId, action: 'start', ok: true })
    } catch (err) {
      if (err instanceof PluginNotFoundError) return reply.code(404).send({ error: err.message })
      if (err instanceof PluginConcurrentOperationError) return reply.code(409).send({ error: err.message })
      throw err
    }
  })

  fastify.post('/api/v1/ops/plugins/:pluginId/stop', async (req, reply) => {
    const { pluginId } = req.params as { pluginId: string }
    try {
      await ctx.pluginLifecycle.stop(pluginId)
      return reply.code(200).send({ pluginId, action: 'stop', ok: true })
    } catch (err) {
      if (err instanceof PluginNotFoundError) return reply.code(404).send({ error: err.message })
      if (err instanceof PluginConcurrentOperationError) return reply.code(409).send({ error: err.message })
      throw err
    }
  })

  fastify.post('/api/v1/ops/plugins/:pluginId/restart', async (req, reply) => {
    const { pluginId } = req.params as { pluginId: string }
    try {
      await ctx.pluginLifecycle.reload(pluginId)
      telemetry.increment('plugins.restart_total')
      return reply.code(200).send({ pluginId, action: 'restart', ok: true })
    } catch (err) {
      if (err instanceof PluginNotFoundError) return reply.code(404).send({ error: err.message })
      if (err instanceof PluginConcurrentOperationError) return reply.code(409).send({ error: err.message })
      throw err
    }
  })

  fastify.post('/api/v1/ops/plugins/:pluginId/reload', async (req, reply) => {
    const { pluginId } = req.params as { pluginId: string }
    try {
      await ctx.pluginLifecycle.reload(pluginId)
      telemetry.increment('plugins.reload_total')
      return reply.code(200).send({ pluginId, action: 'reload', ok: true })
    } catch (err) {
      if (err instanceof PluginNotFoundError) return reply.code(404).send({ error: err.message })
      if (err instanceof PluginConcurrentOperationError) return reply.code(409).send({ error: err.message })
      throw err
    }
  })

  // ── Cluster ───────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/ops/nodes', async (_req, reply) => {
    const nodes = ctx.runtimeNode ? await ctx.runtimeNode.listNodes() : []
    return reply.code(200).send({ total: nodes.length, nodes })
  })

  fastify.get('/api/v1/ops/cluster', async (_req, reply) => {
    const [nodes, leader] = await Promise.all([
      ctx.runtimeNode ? ctx.runtimeNode.listNodes() : Promise.resolve([]),
      ctx.leaderElection ? ctx.leaderElection.getLeader() : Promise.resolve(null),
    ])
    const workerMetrics = taskRuntime.getWorkerMetrics()
    const snapshot = {
      capturedAt: new Date().toISOString(),
      leader,
      nodes,
      totalNodes: nodes.length,
      staleNodes: nodes.filter((n) => n.isStale).length,
      totalWorkers: workerMetrics.length,
      activeWorkers: workerMetrics.filter((w) => w.isRunning).length,
      schedulerRunning: taskRuntime.isRunning,
    }
    return reply.code(200).send(snapshot)
  })
}
