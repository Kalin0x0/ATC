import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  initiateEnterpriseReadinessSchema,
  createDeterministicAuditSchema,
  createIntegrityVerificationSchema,
  initiateProductionReadinessSchema,
  registerAuditNodeSchema,
  cleanupEnterpriseReadinessSchema,
} from '@atc/operations'

export function enterpriseReadinessRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Enterprise Readiness ─────────────────────────────────────────────────────

  fastify.post('/api/v1/enterprise-readiness', async (req, reply) => {
    if (!ctx.enterpriseReadinessService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = initiateEnterpriseReadinessSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const record = await ctx.enterpriseReadinessService.initiateReadiness(parsed.data)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/enterprise-readiness/:id/assess', async (req, reply) => {
    if (!ctx.enterpriseReadinessService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.enterpriseReadinessService.beginAssessment(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/enterprise-readiness/:id/confirm', async (req, reply) => {
    if (!ctx.enterpriseReadinessService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.enterpriseReadinessService.confirmReadiness(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/enterprise-readiness/:id/reject', async (req, reply) => {
    if (!ctx.enterpriseReadinessService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.enterpriseReadinessService.rejectReadiness(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/enterprise-readiness/:id', async (req, reply) => {
    if (!ctx.enterpriseReadinessService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.enterpriseReadinessService.getReadiness(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Deterministic Audit ──────────────────────────────────────────────────────

  fastify.post('/api/v1/enterprise-readiness/audit', async (req, reply) => {
    if (!ctx.deterministicAuditService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createDeterministicAuditSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const record = await ctx.deterministicAuditService.createAudit(parsed.data)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/enterprise-readiness/audit/:id/begin', async (req, reply) => {
    if (!ctx.deterministicAuditService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.deterministicAuditService.beginAuditing(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/enterprise-readiness/audit/:id/complete', async (req, reply) => {
    if (!ctx.deterministicAuditService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.deterministicAuditService.completeAudit(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/enterprise-readiness/audit/:id/archive', async (req, reply) => {
    if (!ctx.deterministicAuditService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.deterministicAuditService.archiveAudit(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/enterprise-readiness/audit/:id', async (req, reply) => {
    if (!ctx.deterministicAuditService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.deterministicAuditService.getAudit(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Integrity Verification ───────────────────────────────────────────────────

  fastify.post('/api/v1/enterprise-readiness/integrity', async (req, reply) => {
    if (!ctx.runtimeIntegrityVerificationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createIntegrityVerificationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const record = await ctx.runtimeIntegrityVerificationService.createVerification(parsed.data)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/enterprise-readiness/integrity/:id/begin', async (req, reply) => {
    if (!ctx.runtimeIntegrityVerificationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeIntegrityVerificationService.beginVerification(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/enterprise-readiness/integrity/:id/verify', async (req, reply) => {
    if (!ctx.runtimeIntegrityVerificationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeIntegrityVerificationService.verifyIntegrity(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/enterprise-readiness/integrity/:id/fail', async (req, reply) => {
    if (!ctx.runtimeIntegrityVerificationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeIntegrityVerificationService.failVerification(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/enterprise-readiness/integrity/:id', async (req, reply) => {
    if (!ctx.runtimeIntegrityVerificationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeIntegrityVerificationService.getVerification(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Production Readiness ─────────────────────────────────────────────────────

  fastify.post('/api/v1/enterprise-readiness/readiness', async (req, reply) => {
    if (!ctx.productionReadinessCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = initiateProductionReadinessSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { readinessData, ...rest } = parsed.data
    const record = await ctx.productionReadinessCoordinator.initiateCheckpoint({
      ...rest,
      ...(readinessData !== undefined ? { readinessData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/enterprise-readiness/readiness/:readinessCheckpointId/confirm', async (req, reply) => {
    if (!ctx.productionReadinessCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { readinessCheckpointId } = req.params as { readinessCheckpointId: string }
    const record = await ctx.productionReadinessCoordinator.confirmCheckpoint(readinessCheckpointId)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/enterprise-readiness/readiness/:readinessCheckpointId/block', async (req, reply) => {
    if (!ctx.productionReadinessCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { readinessCheckpointId } = req.params as { readinessCheckpointId: string }
    const record = await ctx.productionReadinessCoordinator.blockCheckpoint(readinessCheckpointId)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/enterprise-readiness/readiness/:readinessCheckpointId', async (req, reply) => {
    if (!ctx.productionReadinessCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { readinessCheckpointId } = req.params as { readinessCheckpointId: string }
    const record = await ctx.productionReadinessCoordinator.getCheckpoint(readinessCheckpointId)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Distributed Audit Nodes ──────────────────────────────────────────────────

  fastify.post('/api/v1/enterprise-readiness/audit-node', async (req, reply) => {
    if (!ctx.distributedAuditOrchestrator) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = registerAuditNodeSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { auditNodeData, ...rest } = parsed.data
    const record = await ctx.distributedAuditOrchestrator.registerNode({
      ...rest,
      ...(auditNodeData !== undefined ? { auditNodeData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/enterprise-readiness/audit-node/:auditNodeId/sync', async (req, reply) => {
    if (!ctx.distributedAuditOrchestrator) return reply.code(503).send({ error: 'Service unavailable' })
    const { auditNodeId } = req.params as { auditNodeId: string }
    const record = await ctx.distributedAuditOrchestrator.syncNode(auditNodeId)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/enterprise-readiness/audit-node/:auditNodeId/complete-sync', async (req, reply) => {
    if (!ctx.distributedAuditOrchestrator) return reply.code(503).send({ error: 'Service unavailable' })
    const { auditNodeId } = req.params as { auditNodeId: string }
    const record = await ctx.distributedAuditOrchestrator.completeSyncNode(auditNodeId)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/enterprise-readiness/audit-node/:auditNodeId/degrade', async (req, reply) => {
    if (!ctx.distributedAuditOrchestrator) return reply.code(503).send({ error: 'Service unavailable' })
    const { auditNodeId } = req.params as { auditNodeId: string }
    const record = await ctx.distributedAuditOrchestrator.degradeNode(auditNodeId)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/enterprise-readiness/audit-node/:auditNodeId', async (req, reply) => {
    if (!ctx.distributedAuditOrchestrator) return reply.code(503).send({ error: 'Service unavailable' })
    const { auditNodeId } = req.params as { auditNodeId: string }
    const record = await ctx.distributedAuditOrchestrator.getNode(auditNodeId)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/enterprise-readiness/cleanup', async (req, reply) => {
    if (!ctx.enterpriseRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupEnterpriseReadinessSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.enterpriseRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
