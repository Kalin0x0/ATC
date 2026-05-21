import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  createIntegritySchema,
  acquireLockSchema,
  upsertConsistencySchema,
  startValidationSchema,
  startWorldReconciliationSchema,
  cleanupIntegritySchema,
} from '@atc/operations'

export function worldIntegrityRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── World Integrity ──────────────────────────────────────────────────────────

  fastify.post('/api/v1/world-integrity', async (req, reply) => {
    if (!ctx.worldIntegrityService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createIntegritySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { integrityData, ...rest } = parsed.data
    const integrity = await ctx.worldIntegrityService.createIntegrity({
      ...rest,
      ...(integrityData !== undefined ? { integrityData } : {}),
    })
    return reply.code(200).send(integrity)
  })

  fastify.post('/api/v1/world-integrity/:id/verify', async (req, reply) => {
    if (!ctx.worldIntegrityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const { worldHash } = (req.body ?? {}) as { worldHash?: string }
    const integrity = await ctx.worldIntegrityService.verifyIntegrity(id, worldHash)
    return reply.code(200).send(integrity)
  })

  fastify.post('/api/v1/world-integrity/:id/fail', async (req, reply) => {
    if (!ctx.worldIntegrityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const integrity = await ctx.worldIntegrityService.failIntegrity(id)
    return reply.code(200).send(integrity)
  })

  fastify.post('/api/v1/world-integrity/:id/corrupt', async (req, reply) => {
    if (!ctx.worldIntegrityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const integrity = await ctx.worldIntegrityService.markCorrupted(id)
    return reply.code(200).send(integrity)
  })

  fastify.get('/api/v1/world-integrity/:id', async (req, reply) => {
    if (!ctx.worldIntegrityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const integrity = await ctx.worldIntegrityService.getIntegrity(id)
    if (!integrity) return reply.code(404).send({ error: 'World integrity record not found' })
    return reply.code(200).send(integrity)
  })

  // ── Distributed Locks ────────────────────────────────────────────────────────

  fastify.post('/api/v1/world-integrity/lock', async (req, reply) => {
    if (!ctx.distributedLockingService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = acquireLockSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { lockData, expiresAt, ...rest } = parsed.data
    const lock = await ctx.distributedLockingService.acquireLock({
      ...rest,
      ...(lockData !== undefined ? { lockData } : {}),
      ...(expiresAt !== undefined ? { expiresAt: new Date(expiresAt) } : {}),
    })
    return reply.code(200).send(lock)
  })

  fastify.post('/api/v1/world-integrity/lock/:resourceKey/release', async (req, reply) => {
    if (!ctx.distributedLockingService) return reply.code(503).send({ error: 'Service unavailable' })
    const { resourceKey } = req.params as { resourceKey: string }
    const lock = await ctx.distributedLockingService.releaseLock(resourceKey)
    return reply.code(200).send(lock)
  })

  fastify.get('/api/v1/world-integrity/lock/:resourceKey', async (req, reply) => {
    if (!ctx.distributedLockingService) return reply.code(503).send({ error: 'Service unavailable' })
    const { resourceKey } = req.params as { resourceKey: string }
    const lock = await ctx.distributedLockingService.getLock(resourceKey)
    if (!lock) return reply.code(404).send({ error: 'Distributed lock not found' })
    return reply.code(200).send(lock)
  })

  // ── Runtime Consistency ──────────────────────────────────────────────────────

  fastify.post('/api/v1/world-integrity/consistency', async (req, reply) => {
    if (!ctx.deterministicConsistencyService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertConsistencySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { consistencyData, ...rest } = parsed.data
    const consistency = await ctx.deterministicConsistencyService.upsertConsistency({
      ...rest,
      ...(consistencyData !== undefined ? { consistencyData } : {}),
    })
    return reply.code(200).send(consistency)
  })

  fastify.post('/api/v1/world-integrity/consistency/:nodeId/diverge', async (req, reply) => {
    if (!ctx.deterministicConsistencyService) return reply.code(503).send({ error: 'Service unavailable' })
    const { nodeId } = req.params as { nodeId: string }
    await ctx.deterministicConsistencyService.markDiverged(nodeId)
    return reply.code(204).send()
  })

  fastify.get('/api/v1/world-integrity/consistency/:nodeId', async (req, reply) => {
    if (!ctx.deterministicConsistencyService) return reply.code(503).send({ error: 'Service unavailable' })
    const { nodeId } = req.params as { nodeId: string }
    const consistency = await ctx.deterministicConsistencyService.getConsistency(nodeId)
    if (!consistency) return reply.code(404).send({ error: 'Consistency record not found' })
    return reply.code(200).send(consistency)
  })

  // ── Integrity Validation ─────────────────────────────────────────────────────

  fastify.post('/api/v1/world-integrity/validation', async (req, reply) => {
    if (!ctx.globalWorldValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startValidationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { validationData, targetId, ...rest } = parsed.data
    const validation = await ctx.globalWorldValidationService.startValidation({
      ...rest,
      ...(validationData !== undefined ? { validationData } : {}),
      ...(targetId !== undefined ? { targetId } : {}),
    })
    return reply.code(200).send(validation)
  })

  fastify.post('/api/v1/world-integrity/validation/:id/pass', async (req, reply) => {
    if (!ctx.globalWorldValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const validation = await ctx.globalWorldValidationService.passValidation(id)
    return reply.code(200).send(validation)
  })

  fastify.post('/api/v1/world-integrity/validation/:id/fail', async (req, reply) => {
    if (!ctx.globalWorldValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const validation = await ctx.globalWorldValidationService.failValidation(id)
    return reply.code(200).send(validation)
  })

  fastify.get('/api/v1/world-integrity/validation/:id', async (req, reply) => {
    if (!ctx.globalWorldValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const validation = await ctx.globalWorldValidationService.getValidation(id)
    if (!validation) return reply.code(404).send({ error: 'Integrity validation not found' })
    return reply.code(200).send(validation)
  })

  // ── World Reconciliation ─────────────────────────────────────────────────────

  fastify.post('/api/v1/world-integrity/reconcile', async (req, reply) => {
    if (!ctx.runtimeIntegrityCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startWorldReconciliationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { reconciliationData, ...rest } = parsed.data
    const reconciliation = await ctx.runtimeIntegrityCoordinator.startReconciliation({
      ...rest,
      ...(reconciliationData !== undefined ? { reconciliationData } : {}),
    })
    return reply.code(200).send(reconciliation)
  })

  fastify.post('/api/v1/world-integrity/reconcile/:id/complete', async (req, reply) => {
    if (!ctx.runtimeIntegrityCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const reconciliation = await ctx.runtimeIntegrityCoordinator.completeReconciliation(id)
    return reply.code(200).send(reconciliation)
  })

  fastify.post('/api/v1/world-integrity/reconcile/:id/fail', async (req, reply) => {
    if (!ctx.runtimeIntegrityCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const reconciliation = await ctx.runtimeIntegrityCoordinator.failReconciliation(id)
    return reply.code(200).send(reconciliation)
  })

  fastify.get('/api/v1/world-integrity/reconcile/:id', async (req, reply) => {
    if (!ctx.runtimeIntegrityCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const reconciliation = await ctx.runtimeIntegrityCoordinator.getReconciliation(id)
    if (!reconciliation) return reply.code(404).send({ error: 'World reconciliation not found' })
    return reply.code(200).send(reconciliation)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/world-integrity/cleanup', async (req, reply) => {
    if (!ctx.integrityRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupIntegritySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.integrityRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
