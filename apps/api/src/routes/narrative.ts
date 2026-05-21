import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  startCampaignSchema,
  triggerWorldEventSchema,
  advanceStoryProgressionSchema,
  startNarrativeSessionSchema,
  setStoryStateSchema,
  cleanupNarrativeSchema,
} from '@atc/operations'

export function narrativeRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Campaigns ────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/narrative/campaigns/start', async (req, reply) => {
    if (!ctx.campaignOrchestrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startCampaignSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const campaign = await ctx.campaignOrchestrationService.startCampaign(parsed.data)
    return reply.code(200).send(campaign)
  })

  fastify.get('/api/v1/narrative/campaigns/:id', async (req, reply) => {
    if (!ctx.campaignOrchestrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const campaign = await ctx.campaignOrchestrationService.getCampaign(id)
    if (!campaign) return reply.code(404).send({ error: 'Campaign not found' })
    return reply.code(200).send(campaign)
  })

  fastify.get('/api/v1/narrative/campaigns/active', async (req, reply) => {
    if (!ctx.campaignOrchestrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { ownerServerId } = req.query as { ownerServerId?: string }
    const campaigns = await ctx.campaignOrchestrationService.listActiveCampaigns(ownerServerId)
    return reply.code(200).send(campaigns)
  })

  fastify.post('/api/v1/narrative/campaigns/:id/complete', async (req, reply) => {
    if (!ctx.campaignOrchestrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const campaign = await ctx.campaignOrchestrationService.completeCampaign(id)
    return reply.code(200).send(campaign)
  })

  fastify.post('/api/v1/narrative/campaigns/:id/fail', async (req, reply) => {
    if (!ctx.campaignOrchestrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const campaign = await ctx.campaignOrchestrationService.failCampaign(id)
    return reply.code(200).send(campaign)
  })

  // ── World Events ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/narrative/world-events/trigger', async (req, reply) => {
    if (!ctx.worldEventService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = triggerWorldEventSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { expiresAt, regionId, triggerCondition, eventData, ...rest } = parsed.data
    const event = await ctx.worldEventService.triggerEvent({
      ...rest,
      ...(expiresAt !== undefined ? { expiresAt: new Date(expiresAt) } : {}),
      ...(regionId !== undefined ? { regionId } : {}),
      ...(triggerCondition !== undefined ? { triggerCondition } : {}),
      ...(eventData !== undefined ? { eventData } : {}),
    })
    return reply.code(200).send(event)
  })

  fastify.get('/api/v1/narrative/world-events/active', async (req, reply) => {
    if (!ctx.worldEventService) return reply.code(503).send({ error: 'Service unavailable' })
    const { ownerServerId } = req.query as { ownerServerId?: string }
    const events = await ctx.worldEventService.listActiveEvents(ownerServerId)
    return reply.code(200).send(events)
  })

  fastify.post('/api/v1/narrative/world-events/:id/complete', async (req, reply) => {
    if (!ctx.worldEventService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const event = await ctx.worldEventService.completeEvent(id)
    return reply.code(200).send(event)
  })

  // ── Story Progression ────────────────────────────────────────────────────────

  fastify.post('/api/v1/narrative/progression/advance', async (req, reply) => {
    if (!ctx.storyProgressionService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = advanceStoryProgressionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const progression = await ctx.storyProgressionService.advanceProgression(
      parsed.data.id,
      parsed.data.newStageKey,
      parsed.data.progressionData,
    )
    return reply.code(200).send(progression)
  })

  fastify.get('/api/v1/narrative/progression/:entityId/:campaignId', async (req, reply) => {
    if (!ctx.storyProgressionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId, campaignId } = req.params as { entityId: string; campaignId: string }
    const progressions = await ctx.storyProgressionService.getProgressions(entityId, campaignId)
    return reply.code(200).send(progressions)
  })

  // ── Narrative Sessions ───────────────────────────────────────────────────────

  fastify.post('/api/v1/narrative/sessions/start', async (req, reply) => {
    if (!ctx.narrativeRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startNarrativeSessionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const session = await ctx.narrativeRuntimeService.startSession(parsed.data)
    return reply.code(200).send(session)
  })

  fastify.get('/api/v1/narrative/sessions/active', async (req, reply) => {
    if (!ctx.narrativeRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { ownerServerId } = req.query as { ownerServerId?: string }
    const sessions = await ctx.narrativeRuntimeService.listActiveSessions(ownerServerId)
    return reply.code(200).send(sessions)
  })

  fastify.post('/api/v1/narrative/sessions/:id/complete', async (req, reply) => {
    if (!ctx.narrativeRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const session = await ctx.narrativeRuntimeService.endSession(id, 'completed')
    return reply.code(200).send(session)
  })

  fastify.post('/api/v1/narrative/sessions/:id/skip', async (req, reply) => {
    if (!ctx.narrativeRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const session = await ctx.narrativeRuntimeService.endSession(id, 'skipped')
    return reply.code(200).send(session)
  })

  // ── Dynamic Story State ──────────────────────────────────────────────────────

  fastify.post('/api/v1/narrative/story-state/set', async (req, reply) => {
    if (!ctx.dynamicNarrativeService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = setStoryStateSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const state = await ctx.dynamicNarrativeService.setStoryState(parsed.data)
    return reply.code(200).send(state)
  })

  fastify.get('/api/v1/narrative/story-state/:entityId', async (req, reply) => {
    if (!ctx.dynamicNarrativeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    const states = await ctx.dynamicNarrativeService.listEntityStates(entityId)
    return reply.code(200).send(states)
  })

  // ── Maintenance ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/narrative/cleanup', async (req, reply) => {
    if (!ctx.narrativeRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupNarrativeSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.narrativeRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
