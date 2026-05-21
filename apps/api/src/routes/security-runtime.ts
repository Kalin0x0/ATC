import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  detectIntrusionSchema,
  detectThreatSchema,
  isolateEntitySchema,
  createEscalationSchema,
  createContainmentSchema,
  cleanupSecurityRuntimeSchema,
} from '@atc/operations'

export function securityRuntimeRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Intrusion Detection ──────────────────────────────────────────────────────

  fastify.post('/api/v1/security-runtime/intrusions/detect', async (req, reply) => {
    if (!ctx.runtimeIntrusionDetectionService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = detectIntrusionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { entityId, sourceNode, intrusionData, ...rest } = parsed.data
    const intrusion = await ctx.runtimeIntrusionDetectionService.detectIntrusion({
      ...rest,
      ...(entityId !== undefined ? { entityId } : {}),
      ...(sourceNode !== undefined ? { sourceNode } : {}),
      ...(intrusionData !== undefined ? { intrusionData } : {}),
    })
    return reply.code(200).send(intrusion)
  })

  fastify.post('/api/v1/security-runtime/intrusions/:id/resolve', async (req, reply) => {
    if (!ctx.runtimeIntrusionDetectionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const intrusion = await ctx.runtimeIntrusionDetectionService.resolveIntrusion(id)
    return reply.code(200).send(intrusion)
  })

  fastify.get('/api/v1/security-runtime/intrusions/:id', async (req, reply) => {
    if (!ctx.runtimeIntrusionDetectionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const intrusion = await ctx.runtimeIntrusionDetectionService.getIntrusion(id)
    if (!intrusion) return reply.code(404).send({ error: 'Intrusion not found' })
    return reply.code(200).send(intrusion)
  })

  fastify.get('/api/v1/security-runtime/intrusions/active', async (req, reply) => {
    if (!ctx.runtimeIntrusionDetectionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { ownerServerId } = req.query as { ownerServerId?: string }
    const intrusions = await ctx.runtimeIntrusionDetectionService.listActiveIntrusions(ownerServerId)
    return reply.code(200).send(intrusions)
  })

  // ── Threat Detection ─────────────────────────────────────────────────────────

  fastify.post('/api/v1/security-runtime/threats/detect', async (req, reply) => {
    if (!ctx.autonomousProtectionService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = detectThreatSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { entityId, threatData, ...rest } = parsed.data
    const threat = await ctx.autonomousProtectionService.detectThreat({
      ...rest,
      ...(entityId !== undefined ? { entityId } : {}),
      ...(threatData !== undefined ? { threatData } : {}),
    })
    return reply.code(200).send(threat)
  })

  fastify.post('/api/v1/security-runtime/threats/:id/mitigate', async (req, reply) => {
    if (!ctx.autonomousProtectionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const threat = await ctx.autonomousProtectionService.mitigateThreat(id)
    return reply.code(200).send(threat)
  })

  fastify.get('/api/v1/security-runtime/threats/:id', async (req, reply) => {
    if (!ctx.autonomousProtectionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const threat = await ctx.autonomousProtectionService.getThreat(id)
    if (!threat) return reply.code(404).send({ error: 'Threat not found' })
    return reply.code(200).send(threat)
  })

  // ── Isolation ────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/security-runtime/isolate', async (req, reply) => {
    if (!ctx.runtimeIsolationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = isolateEntitySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { isolationData, ...rest } = parsed.data
    const isolation = await ctx.runtimeIsolationService.isolateEntity({
      ...rest,
      ...(isolationData !== undefined ? { isolationData } : {}),
    })
    return reply.code(200).send(isolation)
  })

  fastify.post('/api/v1/security-runtime/isolation/:entityId/release', async (req, reply) => {
    if (!ctx.runtimeIsolationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    await ctx.runtimeIsolationService.releaseIsolation(entityId)
    return reply.code(200).send({ ok: true })
  })

  fastify.get('/api/v1/security-runtime/isolation/:entityId', async (req, reply) => {
    if (!ctx.runtimeIsolationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    const isolation = await ctx.runtimeIsolationService.getIsolation(entityId)
    if (!isolation) return reply.code(404).send({ error: 'Isolation not found' })
    return reply.code(200).send(isolation)
  })

  // ── Escalation ───────────────────────────────────────────────────────────────

  fastify.post('/api/v1/security-runtime/escalations/create', async (req, reply) => {
    if (!ctx.securityEscalationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createEscalationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { entityId, escalationData, ...rest } = parsed.data
    const escalation = await ctx.securityEscalationService.escalate({
      ...rest,
      ...(entityId !== undefined ? { entityId } : {}),
      ...(escalationData !== undefined ? { escalationData } : {}),
    })
    return reply.code(200).send(escalation)
  })

  fastify.post('/api/v1/security-runtime/escalations/:id/resolve', async (req, reply) => {
    if (!ctx.securityEscalationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const escalation = await ctx.securityEscalationService.resolveEscalation(id)
    return reply.code(200).send(escalation)
  })

  fastify.get('/api/v1/security-runtime/escalations/:id', async (req, reply) => {
    if (!ctx.securityEscalationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const escalation = await ctx.securityEscalationService.getEscalation(id)
    if (!escalation) return reply.code(404).send({ error: 'Escalation not found' })
    return reply.code(200).send(escalation)
  })

  // ── Containment ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/security-runtime/contain', async (req, reply) => {
    if (!ctx.threatContainmentService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createContainmentSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { containmentData, ...rest } = parsed.data
    const containment = await ctx.threatContainmentService.contain({
      ...rest,
      ...(containmentData !== undefined ? { containmentData } : {}),
    })
    return reply.code(200).send(containment)
  })

  fastify.post('/api/v1/security-runtime/containments/:id/complete', async (req, reply) => {
    if (!ctx.threatContainmentService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const containment = await ctx.threatContainmentService.completeContainment(id)
    return reply.code(200).send(containment)
  })

  fastify.post('/api/v1/security-runtime/containments/:id/fail', async (req, reply) => {
    if (!ctx.threatContainmentService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const containment = await ctx.threatContainmentService.failContainment(id)
    return reply.code(200).send(containment)
  })

  fastify.get('/api/v1/security-runtime/containments/:id', async (req, reply) => {
    if (!ctx.threatContainmentService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const containment = await ctx.threatContainmentService.getContainment(id)
    if (!containment) return reply.code(404).send({ error: 'Containment not found' })
    return reply.code(200).send(containment)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/security-runtime/cleanup', async (req, reply) => {
    if (!ctx.runtimeSecurityRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupSecurityRuntimeSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.runtimeSecurityRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
