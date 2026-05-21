import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  initiateReleaseGovernanceSchema,
  initiateProductionDeploymentSchema,
  createReleaseValidationSchema,
  initiateReleaseOrchestrationSchema,
  createGlobalReleaseSchema,
  cleanupReleaseGovernanceSchema,
} from '@atc/operations'

export function releaseGovernanceRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Release Governance ───────────────────────────────────────────────────────

  fastify.post('/api/v1/release-governance', async (req, reply) => {
    if (!ctx.releaseGovernanceService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = initiateReleaseGovernanceSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const record = await ctx.releaseGovernanceService.initiateGovernance(parsed.data)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/release-governance/:id/start', async (req, reply) => {
    if (!ctx.releaseGovernanceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.releaseGovernanceService.startGovernance(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/release-governance/:id/approve', async (req, reply) => {
    if (!ctx.releaseGovernanceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.releaseGovernanceService.approveGovernance(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/release-governance/:id/reject', async (req, reply) => {
    if (!ctx.releaseGovernanceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.releaseGovernanceService.rejectGovernance(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/release-governance/:id', async (req, reply) => {
    if (!ctx.releaseGovernanceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.releaseGovernanceService.getGovernance(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Production Deployment ────────────────────────────────────────────────────

  fastify.post('/api/v1/release-governance/deployment', async (req, reply) => {
    if (!ctx.productionDeploymentCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = initiateProductionDeploymentSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { deploymentData, ...rest } = parsed.data
    const record = await ctx.productionDeploymentCoordinator.initiateDeployment({
      ...rest,
      ...(deploymentData !== undefined ? { deploymentData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/release-governance/deployment/:deploymentId/activate', async (req, reply) => {
    if (!ctx.productionDeploymentCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { deploymentId } = req.params as { deploymentId: string }
    const record = await ctx.productionDeploymentCoordinator.activateDeployment(deploymentId)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/release-governance/deployment/:deploymentId/complete', async (req, reply) => {
    if (!ctx.productionDeploymentCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { deploymentId } = req.params as { deploymentId: string }
    const record = await ctx.productionDeploymentCoordinator.completeDeployment(deploymentId)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/release-governance/deployment/:deploymentId/rollback', async (req, reply) => {
    if (!ctx.productionDeploymentCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { deploymentId } = req.params as { deploymentId: string }
    const record = await ctx.productionDeploymentCoordinator.rollbackDeployment(deploymentId)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/release-governance/deployment/:deploymentId', async (req, reply) => {
    if (!ctx.productionDeploymentCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { deploymentId } = req.params as { deploymentId: string }
    const record = await ctx.productionDeploymentCoordinator.getDeployment(deploymentId)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Release Validation ───────────────────────────────────────────────────────

  fastify.post('/api/v1/release-governance/validation', async (req, reply) => {
    if (!ctx.runtimeReleaseValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createReleaseValidationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const record = await ctx.runtimeReleaseValidationService.createValidation(parsed.data)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/release-governance/validation/:id/begin', async (req, reply) => {
    if (!ctx.runtimeReleaseValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeReleaseValidationService.beginValidating(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/release-governance/validation/:id/pass', async (req, reply) => {
    if (!ctx.runtimeReleaseValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeReleaseValidationService.passValidation(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/release-governance/validation/:id/fail', async (req, reply) => {
    if (!ctx.runtimeReleaseValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeReleaseValidationService.failValidation(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/release-governance/validation/:id', async (req, reply) => {
    if (!ctx.runtimeReleaseValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeReleaseValidationService.getValidation(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Release Orchestration ────────────────────────────────────────────────────

  fastify.post('/api/v1/release-governance/orchestration', async (req, reply) => {
    if (!ctx.distributedReleaseOrchestrator) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = initiateReleaseOrchestrationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { orchestrationData, ...rest } = parsed.data
    const record = await ctx.distributedReleaseOrchestrator.initiateOrchestration({
      ...rest,
      ...(orchestrationData !== undefined ? { orchestrationData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/release-governance/orchestration/:orchestrationId/run', async (req, reply) => {
    if (!ctx.distributedReleaseOrchestrator) return reply.code(503).send({ error: 'Service unavailable' })
    const { orchestrationId } = req.params as { orchestrationId: string }
    const record = await ctx.distributedReleaseOrchestrator.runOrchestration(orchestrationId)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/release-governance/orchestration/:orchestrationId/complete', async (req, reply) => {
    if (!ctx.distributedReleaseOrchestrator) return reply.code(503).send({ error: 'Service unavailable' })
    const { orchestrationId } = req.params as { orchestrationId: string }
    const record = await ctx.distributedReleaseOrchestrator.completeOrchestration(orchestrationId)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/release-governance/orchestration/:orchestrationId', async (req, reply) => {
    if (!ctx.distributedReleaseOrchestrator) return reply.code(503).send({ error: 'Service unavailable' })
    const { orchestrationId } = req.params as { orchestrationId: string }
    const record = await ctx.distributedReleaseOrchestrator.getOrchestration(orchestrationId)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Global Release ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/release-governance/global', async (req, reply) => {
    if (!ctx.globalDeploymentGovernanceService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createGlobalReleaseSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const record = await ctx.globalDeploymentGovernanceService.createRelease(parsed.data)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/release-governance/global/:id/activate', async (req, reply) => {
    if (!ctx.globalDeploymentGovernanceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.globalDeploymentGovernanceService.activateRelease(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/release-governance/global/:id/complete', async (req, reply) => {
    if (!ctx.globalDeploymentGovernanceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.globalDeploymentGovernanceService.completeRelease(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/release-governance/global/:id/revert', async (req, reply) => {
    if (!ctx.globalDeploymentGovernanceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.globalDeploymentGovernanceService.revertRelease(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/release-governance/global/:id', async (req, reply) => {
    if (!ctx.globalDeploymentGovernanceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.globalDeploymentGovernanceService.getRelease(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/release-governance/cleanup', async (req, reply) => {
    if (!ctx.releaseRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupReleaseGovernanceSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.releaseRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
