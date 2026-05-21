import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  initiateLockdownSchema,
  startClosureSchema,
  createProductionIntegrityCheckSchema,
  applySealSchema,
  startFinalizationSchema,
  cleanupLockdownSchema,
} from '@atc/operations'

export function lockdownRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Runtime Lockdown ─────────────────────────────────────────────────────────

  fastify.post('/api/v1/lockdown', async (req, reply) => {
    if (!ctx.runtimeLockdownService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = initiateLockdownSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { lockdownData, ...rest } = parsed.data
    const lockdown = await ctx.runtimeLockdownService.initiateLockdown({
      ...rest,
      ...(lockdownData !== undefined ? { lockdownData } : {}),
    })
    return reply.code(200).send(lockdown)
  })

  fastify.post('/api/v1/lockdown/:id/activate', async (req, reply) => {
    if (!ctx.runtimeLockdownService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const lockdown = await ctx.runtimeLockdownService.activateLockdown(id)
    return reply.code(200).send(lockdown)
  })

  fastify.post('/api/v1/lockdown/:id/lift', async (req, reply) => {
    if (!ctx.runtimeLockdownService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const lockdown = await ctx.runtimeLockdownService.liftLockdown(id)
    return reply.code(200).send(lockdown)
  })

  fastify.post('/api/v1/lockdown/:id/fail', async (req, reply) => {
    if (!ctx.runtimeLockdownService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const lockdown = await ctx.runtimeLockdownService.failLockdown(id)
    return reply.code(200).send(lockdown)
  })

  fastify.get('/api/v1/lockdown/:id', async (req, reply) => {
    if (!ctx.runtimeLockdownService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const lockdown = await ctx.runtimeLockdownService.getLockdown(id)
    if (!lockdown) return reply.code(404).send({ error: 'Lockdown record not found' })
    return reply.code(200).send(lockdown)
  })

  // ── Deterministic Closure ────────────────────────────────────────────────────

  fastify.post('/api/v1/lockdown/closure', async (req, reply) => {
    if (!ctx.deterministicClosureService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startClosureSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { closureData, ...rest } = parsed.data
    const closure = await ctx.deterministicClosureService.startClosure({
      ...rest,
      ...(closureData !== undefined ? { closureData } : {}),
    })
    return reply.code(200).send(closure)
  })

  fastify.post('/api/v1/lockdown/closure/:id/progress', async (req, reply) => {
    if (!ctx.deterministicClosureService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const closure = await ctx.deterministicClosureService.progressClosure(id)
    return reply.code(200).send(closure)
  })

  fastify.post('/api/v1/lockdown/closure/:id/complete', async (req, reply) => {
    if (!ctx.deterministicClosureService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const closure = await ctx.deterministicClosureService.completeClosure(id)
    return reply.code(200).send(closure)
  })

  fastify.post('/api/v1/lockdown/closure/:id/abort', async (req, reply) => {
    if (!ctx.deterministicClosureService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const closure = await ctx.deterministicClosureService.abortClosure(id)
    return reply.code(200).send(closure)
  })

  fastify.get('/api/v1/lockdown/closure/:id', async (req, reply) => {
    if (!ctx.deterministicClosureService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const closure = await ctx.deterministicClosureService.getClosure(id)
    if (!closure) return reply.code(404).send({ error: 'Closure record not found' })
    return reply.code(200).send(closure)
  })

  // ── Production Integrity ─────────────────────────────────────────────────────

  fastify.post('/api/v1/lockdown/integrity', async (req, reply) => {
    if (!ctx.productionIntegrityService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createProductionIntegrityCheckSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { integrityData, ...rest } = parsed.data
    const check = await ctx.productionIntegrityService.createIntegrityCheck({
      ...rest,
      ...(integrityData !== undefined ? { integrityData } : {}),
    })
    return reply.code(200).send(check)
  })

  fastify.post('/api/v1/lockdown/integrity/:id/run', async (req, reply) => {
    if (!ctx.productionIntegrityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const check = await ctx.productionIntegrityService.beginRunning(id)
    return reply.code(200).send(check)
  })

  fastify.post('/api/v1/lockdown/integrity/:id/pass', async (req, reply) => {
    if (!ctx.productionIntegrityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const check = await ctx.productionIntegrityService.passIntegrityCheck(id)
    return reply.code(200).send(check)
  })

  fastify.post('/api/v1/lockdown/integrity/:id/fail', async (req, reply) => {
    if (!ctx.productionIntegrityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const check = await ctx.productionIntegrityService.failIntegrityCheck(id)
    return reply.code(200).send(check)
  })

  fastify.get('/api/v1/lockdown/integrity/:id', async (req, reply) => {
    if (!ctx.productionIntegrityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const check = await ctx.productionIntegrityService.getIntegrityCheck(id)
    if (!check) return reply.code(404).send({ error: 'Production integrity check not found' })
    return reply.code(200).send(check)
  })

  // ── Runtime Seals ────────────────────────────────────────────────────────────

  fastify.post('/api/v1/lockdown/seal', async (req, reply) => {
    if (!ctx.runtimeSealService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = applySealSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { sealData, ...rest } = parsed.data
    const seal = await ctx.runtimeSealService.applySeal({
      ...rest,
      ...(sealData !== undefined ? { sealData } : {}),
    })
    return reply.code(200).send(seal)
  })

  fastify.post('/api/v1/lockdown/seal/:id/verify', async (req, reply) => {
    if (!ctx.runtimeSealService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const seal = await ctx.runtimeSealService.verifySeal(id)
    return reply.code(200).send(seal)
  })

  fastify.post('/api/v1/lockdown/seal/:id/break', async (req, reply) => {
    if (!ctx.runtimeSealService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const seal = await ctx.runtimeSealService.breakSeal(id)
    return reply.code(200).send(seal)
  })

  fastify.get('/api/v1/lockdown/seal/:id', async (req, reply) => {
    if (!ctx.runtimeSealService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const seal = await ctx.runtimeSealService.getSeal(id)
    if (!seal) return reply.code(404).send({ error: 'Runtime seal not found' })
    return reply.code(200).send(seal)
  })

  // ── Distributed Finalization ──────────────────────────────────────────────────

  fastify.post('/api/v1/lockdown/finalization', async (req, reply) => {
    if (!ctx.distributedFinalizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startFinalizationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { finalizationData, ...rest } = parsed.data
    const finalization = await ctx.distributedFinalizationService.startFinalization({
      ...rest,
      ...(finalizationData !== undefined ? { finalizationData } : {}),
    })
    return reply.code(200).send(finalization)
  })

  fastify.post('/api/v1/lockdown/finalization/:id/commit', async (req, reply) => {
    if (!ctx.distributedFinalizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const finalization = await ctx.distributedFinalizationService.commitFinalization(id)
    return reply.code(200).send(finalization)
  })

  fastify.post('/api/v1/lockdown/finalization/:id/rollback', async (req, reply) => {
    if (!ctx.distributedFinalizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const finalization = await ctx.distributedFinalizationService.rollbackFinalization(id)
    return reply.code(200).send(finalization)
  })

  fastify.get('/api/v1/lockdown/finalization/:id', async (req, reply) => {
    if (!ctx.distributedFinalizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const finalization = await ctx.distributedFinalizationService.getFinalization(id)
    if (!finalization) return reply.code(404).send({ error: 'Finalization record not found' })
    return reply.code(200).send(finalization)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/lockdown/cleanup', async (req, reply) => {
    if (!ctx.lockdownRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupLockdownSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.lockdownRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
