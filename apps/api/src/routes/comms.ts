import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  createRadioChannelSchema,
  joinChannelSchema,
  leaveChannelSchema,
  updateChannelStatusSchema,
  upsertSignalSchema,
  emergencyBroadcastSchema,
  cancelBroadcastSchema,
  setEncryptionSchema,
  reconcileSignalsSchema,
} from '@atc/operations'
import { CommunicationRuntimeError } from '@atc/communication-runtime'

function commsErrorToStatus(err: CommunicationRuntimeError): number {
  const name = err.constructor.name
  if (name === 'RadioChannelAlreadyExistsError' || name === 'MembershipAlreadyExistsError' || name === 'DuplicateBroadcastNonceError') return 409
  if (name.endsWith('NotFoundError')) return 404
  return 500
}

const NOT_CONFIGURED = { error: 'Communication runtime not configured' }

export async function commsRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Channels ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/comms/channels', {
    preHandler: requireCapability(ctx, 'comms:write'),
    handler: async (req, reply) => {
      if (!ctx.radioRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = createRadioChannelSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.radioRuntimeService.createChannel({
          channelId:   parsed.data.channelId,
          channelName: parsed.data.channelName,
          channelType: parsed.data.channelType,
          frequency:   parsed.data.frequency,
          ...(parsed.data.ownerPrincipalId !== undefined ? { ownerPrincipalId: parsed.data.ownerPrincipalId } : {}),
          ...(parsed.data.isEncrypted !== undefined ? { isEncrypted: parsed.data.isEncrypted } : {}),
          ...(parsed.data.maxMembers !== undefined ? { maxMembers: parsed.data.maxMembers } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof CommunicationRuntimeError) return reply.status(commsErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.get('/api/v1/comms/channels', {
    preHandler: requireCapability(ctx, 'comms:read'),
    handler: async (_req, reply) => {
      if (!ctx.radioChannelRepo) return reply.status(503).send(NOT_CONFIGURED)
      const channels = await ctx.radioChannelRepo.listAll()
      return reply.status(200).send(channels)
    },
  })

  fastify.post('/api/v1/comms/channels/:channelId/join', {
    preHandler: requireCapability(ctx, 'comms:write'),
    handler: async (req, reply) => {
      if (!ctx.radioRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { channelId } = req.params as { channelId: string }
      const parsed = joinChannelSchema.safeParse({ channelId, ...(req.body as object) })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.radioRuntimeService.joinChannel(
          parsed.data.channelId,
          parsed.data.principalId,
          parsed.data.role ?? 'listener',
        )
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof CommunicationRuntimeError) return reply.status(commsErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/comms/channels/:channelId/leave', {
    preHandler: requireCapability(ctx, 'comms:write'),
    handler: async (req, reply) => {
      if (!ctx.radioRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { channelId } = req.params as { channelId: string }
      const parsed = leaveChannelSchema.safeParse({ channelId, ...(req.body as object) })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        await ctx.radioRuntimeService.leaveChannel(parsed.data.channelId, parsed.data.principalId)
        return reply.status(204).send()
      } catch (err) {
        if (err instanceof CommunicationRuntimeError) return reply.status(commsErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/comms/channels/:channelId/jam', {
    preHandler: requireCapability(ctx, 'comms:write'),
    handler: async (req, reply) => {
      if (!ctx.radioRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { channelId } = req.params as { channelId: string }
      try {
        const result = await ctx.radioRuntimeService.jamChannel(channelId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof CommunicationRuntimeError) return reply.status(commsErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/comms/channels/:channelId/restore', {
    preHandler: requireCapability(ctx, 'comms:write'),
    handler: async (req, reply) => {
      if (!ctx.radioRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { channelId } = req.params as { channelId: string }
      const parsed = updateChannelStatusSchema.safeParse({ channelId, status: 'active' })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.radioRuntimeService.restoreChannel(channelId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof CommunicationRuntimeError) return reply.status(commsErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  // ── Signals ───────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/comms/signals', {
    preHandler: requireCapability(ctx, 'comms:write'),
    handler: async (req, reply) => {
      if (!ctx.signalRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = upsertSignalSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.signalRuntimeService.upsertSignal({
          signalId:      parsed.data.signalId,
          signalType:    parsed.data.signalType,
          strength:      parsed.data.strength,
          ownerServerId: parsed.data.ownerServerId,
          ...(parsed.data.channelId !== undefined ? { channelId: parsed.data.channelId } : {}),
          ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
          ...(parsed.data.originZoneId !== undefined ? { originZoneId: parsed.data.originZoneId } : {}),
        })
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof CommunicationRuntimeError) return reply.status(commsErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.get('/api/v1/comms/signals', {
    preHandler: requireCapability(ctx, 'comms:read'),
    handler: async (_req, reply) => {
      if (!ctx.signalRuntimeRepo) return reply.status(503).send(NOT_CONFIGURED)
      const signals = await ctx.signalRuntimeRepo.listActive()
      return reply.status(200).send(signals)
    },
  })

  fastify.post('/api/v1/comms/signals/reconcile', {
    preHandler: requireCapability(ctx, 'comms:write'),
    handler: async (req, reply) => {
      if (!ctx.signalRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = reconcileSignalsSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      const deleted = await ctx.signalRuntimeService.reconcileStale(parsed.data.thresholdMs)
      return reply.status(200).send({ deleted })
    },
  })

  // ── Emergency Broadcasts ─────────────────────────────────────────────────────

  fastify.post('/api/v1/comms/broadcasts', {
    preHandler: requireCapability(ctx, 'comms:write'),
    handler: async (req, reply) => {
      if (!ctx.emergencyBroadcastService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = emergencyBroadcastSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.emergencyBroadcastService.broadcast({
          broadcastNonce:         parsed.data.broadcastNonce,
          initiatedByPrincipalId: parsed.data.initiatedByPrincipalId,
          message:                parsed.data.message,
          severity:               parsed.data.severity,
          ...(parsed.data.targetZoneId !== undefined ? { targetZoneId: parsed.data.targetZoneId } : {}),
          ...(parsed.data.expiresAt !== undefined ? { expiresAt: new Date(parsed.data.expiresAt) } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof CommunicationRuntimeError) return reply.status(commsErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.get('/api/v1/comms/broadcasts', {
    preHandler: requireCapability(ctx, 'comms:read'),
    handler: async (_req, reply) => {
      if (!ctx.emergencyBroadcastRepo) return reply.status(503).send(NOT_CONFIGURED)
      const broadcasts = await ctx.emergencyBroadcastRepo.listActive()
      return reply.status(200).send(broadcasts)
    },
  })

  fastify.post('/api/v1/comms/broadcasts/:broadcastId/cancel', {
    preHandler: requireCapability(ctx, 'comms:write'),
    handler: async (req, reply) => {
      if (!ctx.emergencyBroadcastService) return reply.status(503).send(NOT_CONFIGURED)
      const { broadcastId } = req.params as { broadcastId: string }
      const parsed = cancelBroadcastSchema.safeParse({ broadcastId })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.emergencyBroadcastService.cancelBroadcast(parsed.data.broadcastId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof CommunicationRuntimeError) return reply.status(commsErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  // ── Encryption ────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/comms/channels/:channelId/encryption', {
    preHandler: requireCapability(ctx, 'comms:write'),
    handler: async (req, reply) => {
      if (!ctx.encryptionRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { channelId } = req.params as { channelId: string }
      const parsed = setEncryptionSchema.safeParse({ channelId, ...(req.body as object) })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.encryptionRuntimeService.setEncryption(parsed.data.channelId, parsed.data.encryptionKeyHash)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof CommunicationRuntimeError) return reply.status(commsErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })
}
