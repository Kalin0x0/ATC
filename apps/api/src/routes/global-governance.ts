import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  createGovernanceDirectiveSchema,
  startArbitrationSchema,
  proposeConsensusSchema,
  upsertPolicySchema,
  claimGovernanceOwnershipSchema,
  cleanupGovernanceRuntimeSchema,
} from '@atc/operations'

export function globalGovernanceRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Governance Directives ────────────────────────────────────────────────────

  fastify.post('/api/v1/global-governance/directive', async (req, reply) => {
    if (!ctx.globalGovernanceService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createGovernanceDirectiveSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { directiveData, ...rest } = parsed.data
    const directive = await ctx.globalGovernanceService.createDirective({
      ...rest,
      ...(directiveData !== undefined ? { directiveData } : {}),
    })
    return reply.code(200).send(directive)
  })

  fastify.post('/api/v1/global-governance/directive/:id/activate', async (req, reply) => {
    if (!ctx.globalGovernanceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const directive = await ctx.globalGovernanceService.activateDirective(id)
    return reply.code(200).send(directive)
  })

  fastify.post('/api/v1/global-governance/directive/:id/resolve', async (req, reply) => {
    if (!ctx.globalGovernanceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const directive = await ctx.globalGovernanceService.resolveDirective(id)
    return reply.code(200).send(directive)
  })

  fastify.post('/api/v1/global-governance/directive/:id/fail', async (req, reply) => {
    if (!ctx.globalGovernanceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const directive = await ctx.globalGovernanceService.failDirective(id)
    return reply.code(200).send(directive)
  })

  fastify.get('/api/v1/global-governance/directive/:id', async (req, reply) => {
    if (!ctx.globalGovernanceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const directive = await ctx.globalGovernanceService.getDirective(id)
    if (!directive) return reply.code(404).send({ error: 'Governance directive not found' })
    return reply.code(200).send(directive)
  })

  // ── Cross-System Arbitration ──────────────────────────────────────────────────

  fastify.post('/api/v1/global-governance/arbitration', async (req, reply) => {
    if (!ctx.crossSystemArbitrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startArbitrationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { arbitrationData, ...rest } = parsed.data
    const arbitration = await ctx.crossSystemArbitrationService.startArbitration({
      ...rest,
      ...(arbitrationData !== undefined ? { arbitrationData } : {}),
    })
    return reply.code(200).send(arbitration)
  })

  fastify.post('/api/v1/global-governance/arbitration/:id/begin', async (req, reply) => {
    if (!ctx.crossSystemArbitrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const arbitration = await ctx.crossSystemArbitrationService.beginArbitrating(id)
    return reply.code(200).send(arbitration)
  })

  fastify.post('/api/v1/global-governance/arbitration/:id/resolve', async (req, reply) => {
    if (!ctx.crossSystemArbitrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const arbitration = await ctx.crossSystemArbitrationService.resolveArbitration(id)
    return reply.code(200).send(arbitration)
  })

  fastify.post('/api/v1/global-governance/arbitration/:id/reject', async (req, reply) => {
    if (!ctx.crossSystemArbitrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const arbitration = await ctx.crossSystemArbitrationService.rejectArbitration(id)
    return reply.code(200).send(arbitration)
  })

  fastify.get('/api/v1/global-governance/arbitration/:id', async (req, reply) => {
    if (!ctx.crossSystemArbitrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const arbitration = await ctx.crossSystemArbitrationService.getArbitration(id)
    if (!arbitration) return reply.code(404).send({ error: 'Arbitration not found' })
    return reply.code(200).send(arbitration)
  })

  // ── Runtime Consensus ────────────────────────────────────────────────────────

  fastify.post('/api/v1/global-governance/consensus', async (req, reply) => {
    if (!ctx.runtimeConsensusService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = proposeConsensusSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { consensusData, ...rest } = parsed.data
    const consensus = await ctx.runtimeConsensusService.proposeConsensus({
      ...rest,
      ...(consensusData !== undefined ? { consensusData } : {}),
    })
    return reply.code(200).send(consensus)
  })

  fastify.post('/api/v1/global-governance/consensus/:id/vote', async (req, reply) => {
    if (!ctx.runtimeConsensusService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const consensus = await ctx.runtimeConsensusService.beginVoting(id)
    return reply.code(200).send(consensus)
  })

  fastify.post('/api/v1/global-governance/consensus/:id/commit', async (req, reply) => {
    if (!ctx.runtimeConsensusService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const consensus = await ctx.runtimeConsensusService.commitConsensus(id)
    return reply.code(200).send(consensus)
  })

  fastify.post('/api/v1/global-governance/consensus/:id/abort', async (req, reply) => {
    if (!ctx.runtimeConsensusService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const consensus = await ctx.runtimeConsensusService.abortConsensus(id)
    return reply.code(200).send(consensus)
  })

  fastify.get('/api/v1/global-governance/consensus/:id', async (req, reply) => {
    if (!ctx.runtimeConsensusService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const consensus = await ctx.runtimeConsensusService.getConsensus(id)
    if (!consensus) return reply.code(404).send({ error: 'Consensus record not found' })
    return reply.code(200).send(consensus)
  })

  // ── Distributed Policy ───────────────────────────────────────────────────────

  fastify.post('/api/v1/global-governance/policy', async (req, reply) => {
    if (!ctx.distributedPolicyCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertPolicySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { policyData, ...rest } = parsed.data
    const policy = await ctx.distributedPolicyCoordinator.upsertPolicy({
      ...rest,
      ...(policyData !== undefined ? { policyData } : {}),
    })
    return reply.code(200).send(policy)
  })

  fastify.post('/api/v1/global-governance/policy/:id/suspend', async (req, reply) => {
    if (!ctx.distributedPolicyCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const policy = await ctx.distributedPolicyCoordinator.suspendPolicy(id)
    return reply.code(200).send(policy)
  })

  fastify.post('/api/v1/global-governance/policy/:id/revoke', async (req, reply) => {
    if (!ctx.distributedPolicyCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const policy = await ctx.distributedPolicyCoordinator.revokePolicy(id)
    return reply.code(200).send(policy)
  })

  fastify.get('/api/v1/global-governance/policy/:policyId', async (req, reply) => {
    if (!ctx.distributedPolicyCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { policyId } = req.params as { policyId: string }
    const policy = await ctx.distributedPolicyCoordinator.getPolicy(policyId)
    if (!policy) return reply.code(404).send({ error: 'Policy not found' })
    return reply.code(200).send(policy)
  })

  // ── Global Ownership ─────────────────────────────────────────────────────────

  fastify.post('/api/v1/global-governance/ownership', async (req, reply) => {
    if (!ctx.globalOwnershipAuthority) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = claimGovernanceOwnershipSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { ownershipData, ...rest } = parsed.data
    const ownership = await ctx.globalOwnershipAuthority.claimOwnership({
      ...rest,
      ...(ownershipData !== undefined ? { ownershipData } : {}),
    })
    return reply.code(200).send(ownership)
  })

  fastify.post('/api/v1/global-governance/ownership/:resourceId/release', async (req, reply) => {
    if (!ctx.globalOwnershipAuthority) return reply.code(503).send({ error: 'Service unavailable' })
    const { resourceId } = req.params as { resourceId: string }
    const ownership = await ctx.globalOwnershipAuthority.releaseOwnership(resourceId)
    return reply.code(200).send(ownership)
  })

  fastify.get('/api/v1/global-governance/ownership/:resourceId', async (req, reply) => {
    if (!ctx.globalOwnershipAuthority) return reply.code(503).send({ error: 'Service unavailable' })
    const { resourceId } = req.params as { resourceId: string }
    const ownership = await ctx.globalOwnershipAuthority.getOwnership(resourceId)
    if (!ownership) return reply.code(404).send({ error: 'Ownership record not found' })
    return reply.code(200).send(ownership)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/global-governance/cleanup', async (req, reply) => {
    if (!ctx.governanceContinuityService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupGovernanceRuntimeSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.governanceContinuityService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
