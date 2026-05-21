import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  createCertificationSchema,
  createValidationSchema,
  createComplianceSchema,
  createVerificationSchema,
  upsertCertificationCoordinationSchema,
  cleanupCertificationSchema,
} from '@atc/operations'

export function runtimeCertificationRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Certifications ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-certification', async (req, reply) => {
    if (!ctx.runtimeCertificationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createCertificationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { certificationData, ...rest } = parsed.data
    const record = await ctx.runtimeCertificationService.createCertification({
      ...rest,
      ...(certificationData !== undefined ? { certificationData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-certification/:id/certify', async (req, reply) => {
    if (!ctx.runtimeCertificationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeCertificationService.certify(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-certification/:id/revoke', async (req, reply) => {
    if (!ctx.runtimeCertificationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeCertificationService.revokeCertification(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-certification/:id/expire', async (req, reply) => {
    if (!ctx.runtimeCertificationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeCertificationService.expireCertification(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-certification/:id/fail', async (req, reply) => {
    if (!ctx.runtimeCertificationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeCertificationService.failCertification(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-certification/:id', async (req, reply) => {
    if (!ctx.runtimeCertificationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeCertificationService.getCertification(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Deterministic Validation ─────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-certification/validation', async (req, reply) => {
    if (!ctx.deterministicValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createValidationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { validationData, ...rest } = parsed.data
    const record = await ctx.deterministicValidationService.createValidation({
      ...rest,
      ...(validationData !== undefined ? { validationData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-certification/validation/:id/begin', async (req, reply) => {
    if (!ctx.deterministicValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.deterministicValidationService.beginValidating(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-certification/validation/:id/pass', async (req, reply) => {
    if (!ctx.deterministicValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.deterministicValidationService.passValidation(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-certification/validation/:id/fail', async (req, reply) => {
    if (!ctx.deterministicValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.deterministicValidationService.failValidation(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-certification/validation/:id/skip', async (req, reply) => {
    if (!ctx.deterministicValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.deterministicValidationService.skipValidation(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-certification/validation/:id', async (req, reply) => {
    if (!ctx.deterministicValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.deterministicValidationService.getValidation(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Compliance Enforcement ───────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-certification/compliance', async (req, reply) => {
    if (!ctx.complianceEnforcementService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createComplianceSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { complianceData, ...rest } = parsed.data
    const record = await ctx.complianceEnforcementService.createCompliance({
      ...rest,
      ...(complianceData !== undefined ? { complianceData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-certification/compliance/:id/enforce', async (req, reply) => {
    if (!ctx.complianceEnforcementService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.complianceEnforcementService.enforceCompliance(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-certification/compliance/:id/violate', async (req, reply) => {
    if (!ctx.complianceEnforcementService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.complianceEnforcementService.violateCompliance(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-certification/compliance/:id/expire', async (req, reply) => {
    if (!ctx.complianceEnforcementService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.complianceEnforcementService.expireCompliance(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-certification/compliance/:id', async (req, reply) => {
    if (!ctx.complianceEnforcementService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.complianceEnforcementService.getCompliance(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Runtime Verification ─────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-certification/verification', async (req, reply) => {
    if (!ctx.runtimeVerificationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createVerificationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { verificationData, ...rest } = parsed.data
    const record = await ctx.runtimeVerificationService.createVerification({
      ...rest,
      ...(verificationData !== undefined ? { verificationData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-certification/verification/:id/begin', async (req, reply) => {
    if (!ctx.runtimeVerificationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeVerificationService.beginVerifying(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-certification/verification/:id/pass', async (req, reply) => {
    if (!ctx.runtimeVerificationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeVerificationService.passVerification(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-certification/verification/:id/fail', async (req, reply) => {
    if (!ctx.runtimeVerificationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeVerificationService.failVerification(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-certification/verification/:id', async (req, reply) => {
    if (!ctx.runtimeVerificationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeVerificationService.getVerification(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Distributed Compliance Coordination ─────────────────────────────────────

  fastify.post('/api/v1/runtime-certification/coordination', async (req, reply) => {
    if (!ctx.distributedComplianceCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertCertificationCoordinationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { coordinationData, ...rest } = parsed.data
    const record = await ctx.distributedComplianceCoordinator.upsertCoordination({
      ...rest,
      ...(coordinationData !== undefined ? { coordinationData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-certification/coordination/:id/suspend', async (req, reply) => {
    if (!ctx.distributedComplianceCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.distributedComplianceCoordinator.suspendCoordination(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-certification/coordination/:id/complete', async (req, reply) => {
    if (!ctx.distributedComplianceCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.distributedComplianceCoordinator.completeCoordination(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-certification/coordination/:coordinationId', async (req, reply) => {
    if (!ctx.distributedComplianceCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { coordinationId } = req.params as { coordinationId: string }
    const record = await ctx.distributedComplianceCoordinator.getCoordination(coordinationId)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-certification/cleanup', async (req, reply) => {
    if (!ctx.certificationRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupCertificationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.certificationRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
