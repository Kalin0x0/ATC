import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  initiateRuntimeHardeningSchema,
  createImmutableSecuritySchema,
  createSecurityValidationSchema,
  createSealValidationSchema,
  createThreatMitigationSchema,
  cleanupRuntimeHardeningSchema,
} from '@atc/operations'

export function runtimeHardeningRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Runtime Hardening ────────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-hardening', async (req, reply) => {
    if (!ctx.runtimeHardeningService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = initiateRuntimeHardeningSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { hardeningData, ...rest } = parsed.data
    const record = await ctx.runtimeHardeningService.initiateHardening({
      ...rest,
      ...(hardeningData !== undefined ? { hardeningData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-hardening/:id/begin', async (req, reply) => {
    if (!ctx.runtimeHardeningService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeHardeningService.beginHardening(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-hardening/:id/harden', async (req, reply) => {
    if (!ctx.runtimeHardeningService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeHardeningService.hardenRuntime(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-hardening/:id/violate', async (req, reply) => {
    if (!ctx.runtimeHardeningService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeHardeningService.violateHardening(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-hardening/:id/fail', async (req, reply) => {
    if (!ctx.runtimeHardeningService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeHardeningService.failHardening(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-hardening/:id', async (req, reply) => {
    if (!ctx.runtimeHardeningService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeHardeningService.getHardening(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Immutable Security ───────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-hardening/security', async (req, reply) => {
    if (!ctx.immutableSecurityCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createImmutableSecuritySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { securityData, ...rest } = parsed.data
    const record = await ctx.immutableSecurityCoordinator.createSecurity({
      ...rest,
      ...(securityData !== undefined ? { securityData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-hardening/security/:id/enforce', async (req, reply) => {
    if (!ctx.immutableSecurityCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.immutableSecurityCoordinator.enforcePolicy(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-hardening/security/:id/violate', async (req, reply) => {
    if (!ctx.immutableSecurityCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.immutableSecurityCoordinator.violateSecurity(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-hardening/security/:id', async (req, reply) => {
    if (!ctx.immutableSecurityCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.immutableSecurityCoordinator.getSecurity(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Security Validation ──────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-hardening/validation', async (req, reply) => {
    if (!ctx.distributedSecurityValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createSecurityValidationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { validationData, ...rest } = parsed.data
    const record = await ctx.distributedSecurityValidationService.createValidation({
      ...rest,
      ...(validationData !== undefined ? { validationData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-hardening/validation/:id/begin', async (req, reply) => {
    if (!ctx.distributedSecurityValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.distributedSecurityValidationService.beginValidating(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-hardening/validation/:id/pass', async (req, reply) => {
    if (!ctx.distributedSecurityValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.distributedSecurityValidationService.passValidation(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-hardening/validation/:id/fail', async (req, reply) => {
    if (!ctx.distributedSecurityValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.distributedSecurityValidationService.failValidation(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-hardening/validation/:id', async (req, reply) => {
    if (!ctx.distributedSecurityValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.distributedSecurityValidationService.getValidation(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Seal Validation ──────────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-hardening/seal-validation', async (req, reply) => {
    if (!ctx.runtimeSealVerificationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createSealValidationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { sealData, ...rest } = parsed.data
    const record = await ctx.runtimeSealVerificationService.createSealValidation({
      ...rest,
      ...(sealData !== undefined ? { sealData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-hardening/seal-validation/:id/begin', async (req, reply) => {
    if (!ctx.runtimeSealVerificationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSealVerificationService.beginVerification(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-hardening/seal-validation/:id/verify', async (req, reply) => {
    if (!ctx.runtimeSealVerificationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSealVerificationService.verifyRuntimeSeal(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-hardening/seal-validation/:id/break', async (req, reply) => {
    if (!ctx.runtimeSealVerificationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSealVerificationService.breakSealValidation(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-hardening/seal-validation/:id', async (req, reply) => {
    if (!ctx.runtimeSealVerificationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSealVerificationService.getSealValidation(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Threat Mitigation ────────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-hardening/mitigation', async (req, reply) => {
    if (!ctx.autonomousThreatMitigationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createThreatMitigationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { mitigationData, ...rest } = parsed.data
    const record = await ctx.autonomousThreatMitigationService.createMitigation({
      ...rest,
      ...(mitigationData !== undefined ? { mitigationData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-hardening/mitigation/:id/begin', async (req, reply) => {
    if (!ctx.autonomousThreatMitigationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.autonomousThreatMitigationService.beginMitigation(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-hardening/mitigation/:id/complete', async (req, reply) => {
    if (!ctx.autonomousThreatMitigationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.autonomousThreatMitigationService.completeMitigation(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-hardening/mitigation/:id/fail', async (req, reply) => {
    if (!ctx.autonomousThreatMitigationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.autonomousThreatMitigationService.failMitigation(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-hardening/mitigation/:id', async (req, reply) => {
    if (!ctx.autonomousThreatMitigationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.autonomousThreatMitigationService.getMitigation(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-hardening/cleanup', async (req, reply) => {
    if (!ctx.hardeningRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupRuntimeHardeningSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.hardeningRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
