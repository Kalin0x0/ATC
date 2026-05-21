import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  createGovernanceSchema,
  startElectionSchema,
  closeElectionSchema,
  enactLegislationSchema,
  upsertCivicInfluenceSchema,
  applyPolicySchema,
  cleanupGovernanceSchema,
} from '@atc/operations'

export function governanceRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Governance Runtime ───────────────────────────────────────────────────────

  fastify.post('/api/v1/governance/create', async (req, reply) => {
    if (!ctx.governanceRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createGovernanceSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { regionId, governanceData, ...rest } = parsed.data
    const governance = await ctx.governanceRuntimeService.createGovernance({
      ...rest,
      ...(regionId !== undefined ? { regionId } : {}),
      ...(governanceData !== undefined ? { governanceData } : {}),
    })
    return reply.code(200).send(governance)
  })

  fastify.post('/api/v1/governance/:id/suspend', async (req, reply) => {
    if (!ctx.governanceRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const governance = await ctx.governanceRuntimeService.suspendGovernance(id)
    return reply.code(200).send(governance)
  })

  fastify.get('/api/v1/governance/:id', async (req, reply) => {
    if (!ctx.governanceRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const governance = await ctx.governanceRuntimeService.getGovernance(id)
    if (!governance) return reply.code(404).send({ error: 'Governance not found' })
    return reply.code(200).send(governance)
  })

  fastify.get('/api/v1/governance/active', async (req, reply) => {
    if (!ctx.governanceRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { ownerServerId } = req.query as { ownerServerId?: string }
    const governances = await ctx.governanceRuntimeService.listActiveGovernances(ownerServerId)
    return reply.code(200).send(governances)
  })

  // ── Political Elections ──────────────────────────────────────────────────────

  fastify.post('/api/v1/governance/elections/start', async (req, reply) => {
    if (!ctx.politicalElectionService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startElectionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { candidateData, ...rest } = parsed.data
    const election = await ctx.politicalElectionService.startElection({
      ...rest,
      ...(candidateData !== undefined ? { candidateData } : {}),
    })
    return reply.code(200).send(election)
  })

  fastify.post('/api/v1/governance/elections/:id/close', async (req, reply) => {
    if (!ctx.politicalElectionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const parsed = closeElectionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { resultData } = parsed.data
    const election = await ctx.politicalElectionService.closeElection(id, resultData)
    return reply.code(200).send(election)
  })

  fastify.post('/api/v1/governance/elections/:id/cancel', async (req, reply) => {
    if (!ctx.politicalElectionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const election = await ctx.politicalElectionService.cancelElection(id)
    return reply.code(200).send(election)
  })

  fastify.get('/api/v1/governance/elections/:id', async (req, reply) => {
    if (!ctx.politicalElectionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const election = await ctx.politicalElectionService.getElection(id)
    if (!election) return reply.code(404).send({ error: 'Election not found' })
    return reply.code(200).send(election)
  })

  // ── Legislative Runtime ──────────────────────────────────────────────────────

  fastify.post('/api/v1/governance/legislation/enact', async (req, reply) => {
    if (!ctx.legislativeRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = enactLegislationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { regionId, legislationData, enactedAt, expiresAt, ...rest } = parsed.data
    const legislation = await ctx.legislativeRuntimeService.enactLegislation({
      ...rest,
      ...(regionId !== undefined ? { regionId } : {}),
      ...(legislationData !== undefined ? { legislationData } : {}),
      ...(enactedAt !== undefined ? { enactedAt: new Date(enactedAt) } : {}),
      ...(expiresAt !== undefined ? { expiresAt: new Date(expiresAt) } : {}),
    })
    return reply.code(200).send(legislation)
  })

  fastify.post('/api/v1/governance/legislation/:id/repeal', async (req, reply) => {
    if (!ctx.legislativeRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const legislation = await ctx.legislativeRuntimeService.repealLegislation(id)
    return reply.code(200).send(legislation)
  })

  fastify.get('/api/v1/governance/legislation/:id', async (req, reply) => {
    if (!ctx.legislativeRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const legislation = await ctx.legislativeRuntimeService.getLegislation(id)
    if (!legislation) return reply.code(404).send({ error: 'Legislation not found' })
    return reply.code(200).send(legislation)
  })

  // ── Civic Influence ──────────────────────────────────────────────────────────

  fastify.post('/api/v1/governance/influence', async (req, reply) => {
    if (!ctx.civicInfluenceService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertCivicInfluenceSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { regionId, influenceData, ...rest } = parsed.data
    const influence = await ctx.civicInfluenceService.upsertInfluence({
      ...rest,
      ...(regionId !== undefined ? { regionId } : {}),
      ...(influenceData !== undefined ? { influenceData } : {}),
    })
    return reply.code(200).send(influence)
  })

  fastify.get('/api/v1/governance/influence/:entityId', async (req, reply) => {
    if (!ctx.civicInfluenceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    const influence = await ctx.civicInfluenceService.getInfluence(entityId)
    if (!influence) return reply.code(404).send({ error: 'Civic influence not found' })
    return reply.code(200).send(influence)
  })

  // ── Autonomous Policy ────────────────────────────────────────────────────────

  fastify.post('/api/v1/governance/policies/apply', async (req, reply) => {
    if (!ctx.autonomousPolicyService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = applyPolicySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { regionId, policyData, appliedAt, expiresAt, ...rest } = parsed.data
    const policy = await ctx.autonomousPolicyService.applyPolicy({
      ...rest,
      ...(regionId !== undefined ? { regionId } : {}),
      ...(policyData !== undefined ? { policyData } : {}),
      ...(appliedAt !== undefined ? { appliedAt: new Date(appliedAt) } : {}),
      ...(expiresAt !== undefined ? { expiresAt: new Date(expiresAt) } : {}),
    })
    return reply.code(200).send(policy)
  })

  fastify.post('/api/v1/governance/policies/:id/revoke', async (req, reply) => {
    if (!ctx.autonomousPolicyService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const policy = await ctx.autonomousPolicyService.revokePolicy(id)
    return reply.code(200).send(policy)
  })

  fastify.get('/api/v1/governance/policies/:id', async (req, reply) => {
    if (!ctx.autonomousPolicyService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const policy = await ctx.autonomousPolicyService.getPolicy(id)
    if (!policy) return reply.code(404).send({ error: 'Policy not found' })
    return reply.code(200).send(policy)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/governance/cleanup', async (req, reply) => {
    if (!ctx.governanceRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupGovernanceSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.governanceRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
