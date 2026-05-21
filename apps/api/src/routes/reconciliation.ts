import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  startMigrationSchema,
  transitionMigrationSchema,
  createNodeTransferSchema,
  transitionNodeTransferSchema,
  startReconciliationSchema,
  replayCheckpointSchema,
  createRecoverySchema,
} from '@atc/operations'
import { randomUUID } from 'crypto'

export function reconciliationRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Runtime Migrations ──────────────────────────────────────────────────────

  fastify.post('/api/v1/reconciliation/migrations/start', async (req, reply) => {
    if (!ctx.runtimeMigrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startMigrationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const migration = await ctx.runtimeMigrationService.startMigration(parsed.data)
    return reply.code(201).send(migration)
  })

  fastify.post('/api/v1/reconciliation/migrations/:migrationId/complete', async (req, reply) => {
    if (!ctx.runtimeMigrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { migrationId } = req.params as { migrationId: string }
    const migration = await ctx.runtimeMigrationService.completeMigration(migrationId)
    return reply.code(200).send(migration)
  })

  fastify.post('/api/v1/reconciliation/migrations/:migrationId/fail', async (req, reply) => {
    if (!ctx.runtimeMigrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { migrationId } = req.params as { migrationId: string }
    const parsed = transitionMigrationSchema.safeParse({ migrationId, ...req.body as object })
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const migration = await ctx.runtimeMigrationService.failMigration(migrationId, parsed.data.reason)
    return reply.code(200).send(migration)
  })

  fastify.get('/api/v1/reconciliation/migrations/:migrationId', async (req, reply) => {
    if (!ctx.runtimeMigrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { migrationId } = req.params as { migrationId: string }
    const migration = await ctx.runtimeMigrationService.getMigration(migrationId)
    if (!migration) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(migration)
  })

  // ── Node Transfers ──────────────────────────────────────────────────────────

  fastify.post('/api/v1/reconciliation/transfers/initiate', async (req, reply) => {
    if (!ctx.ownershipTransferService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createNodeTransferSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const transfer = await ctx.ownershipTransferService.initiateTransfer(parsed.data)
    return reply.code(201).send(transfer)
  })

  fastify.post('/api/v1/reconciliation/transfers/:transferId/complete', async (req, reply) => {
    if (!ctx.ownershipTransferService) return reply.code(503).send({ error: 'Service unavailable' })
    const { transferId } = req.params as { transferId: string }
    const transfer = await ctx.ownershipTransferService.completeTransfer(transferId)
    return reply.code(200).send(transfer)
  })

  fastify.post('/api/v1/reconciliation/transfers/:transferId/fail', async (req, reply) => {
    if (!ctx.ownershipTransferService) return reply.code(503).send({ error: 'Service unavailable' })
    const { transferId } = req.params as { transferId: string }
    const parsed = transitionNodeTransferSchema.safeParse({ transferId, status: 'failed' })
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const transfer = await ctx.ownershipTransferService.failTransfer(transferId)
    return reply.code(200).send(transfer)
  })

  // ── Reconciliation Runtime ──────────────────────────────────────────────────

  fastify.post('/api/v1/reconciliation/run', async (req, reply) => {
    if (!ctx.crossNodeReconciliationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startReconciliationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const reconciliationId = parsed.data.reconciliationId ?? randomUUID()
    const result = await ctx.crossNodeReconciliationService.reconcile(
      reconciliationId,
      parsed.data.reconciliationType,
      parsed.data.regionId,
      parsed.data.serverId,
    )
    return reply.code(200).send(result)
  })

  // ── Snapshot Replay ─────────────────────────────────────────────────────────

  fastify.post('/api/v1/reconciliation/snapshots/replay', async (req, reply) => {
    if (!ctx.snapshotReplayService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = replayCheckpointSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const replay = await ctx.snapshotReplayService.replayCheckpoint(
      parsed.data.entityId,
      parsed.data.snapshotId,
    )
    return reply.code(200).send(replay)
  })

  fastify.get('/api/v1/reconciliation/snapshots/pending', async (_req, reply) => {
    if (!ctx.snapshotReplayService) return reply.code(503).send({ error: 'Service unavailable' })
    const replays = await ctx.snapshotReplayService.listPendingReplays()
    return reply.code(200).send(replays)
  })

  // ── Runtime Recovery ────────────────────────────────────────────────────────

  fastify.post('/api/v1/reconciliation/recovery/start', async (req, reply) => {
    if (!ctx.runtimeRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createRecoverySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const recovery = await ctx.runtimeRecoveryService.startRecovery(parsed.data)
    return reply.code(201).send(recovery)
  })

  // ── Runtime Consistency ─────────────────────────────────────────────────────

  fastify.get('/api/v1/reconciliation/consistency/check', async (_req, reply) => {
    if (!ctx.runtimeConsistencyService) return reply.code(503).send({ error: 'Service unavailable' })
    const result = await ctx.runtimeConsistencyService.validateConsistency()
    return reply.code(200).send(result)
  })
}
