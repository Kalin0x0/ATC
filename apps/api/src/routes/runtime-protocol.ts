import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  registerProtocolSchema,
  registerContractSchema,
  upsertRegistrySchema,
  initiateHandshakeSchema,
  upsertBridgeSchema,
  cleanupProtocolSchema,
} from '@atc/operations'

export function runtimeProtocolRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Runtime Protocol ─────────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-protocol/register', async (req, reply) => {
    if (!ctx.runtimeProtocolService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = registerProtocolSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { protocolData, ...rest } = parsed.data
    const protocol = await ctx.runtimeProtocolService.registerProtocol({
      ...rest,
      ...(protocolData !== undefined ? { protocolData } : {}),
    })
    return reply.code(200).send(protocol)
  })

  fastify.post('/api/v1/runtime-protocol/:id/pause', async (req, reply) => {
    if (!ctx.runtimeProtocolService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const protocol = await ctx.runtimeProtocolService.pauseProtocol(id)
    return reply.code(200).send(protocol)
  })

  fastify.post('/api/v1/runtime-protocol/:id/terminate', async (req, reply) => {
    if (!ctx.runtimeProtocolService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const protocol = await ctx.runtimeProtocolService.terminateProtocol(id)
    return reply.code(200).send(protocol)
  })

  fastify.get('/api/v1/runtime-protocol/:id', async (req, reply) => {
    if (!ctx.runtimeProtocolService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const protocol = await ctx.runtimeProtocolService.getProtocol(id)
    if (!protocol) return reply.code(404).send({ error: 'Protocol not found' })
    return reply.code(200).send(protocol)
  })

  fastify.get('/api/v1/runtime-protocol/active', async (req, reply) => {
    if (!ctx.runtimeProtocolService) return reply.code(503).send({ error: 'Service unavailable' })
    const { ownerServerId } = req.query as { ownerServerId?: string }
    const protocols = await ctx.runtimeProtocolService.listActiveProtocols(ownerServerId)
    return reply.code(200).send(protocols)
  })

  // ── Federation Contracts ─────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-protocol/contracts/register', async (req, reply) => {
    if (!ctx.federationContractService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = registerContractSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { contractData, expiresAt, ...rest } = parsed.data
    const contract = await ctx.federationContractService.registerContract({
      ...rest,
      ...(contractData !== undefined ? { contractData } : {}),
      ...(expiresAt !== undefined ? { expiresAt: new Date(expiresAt) } : {}),
    })
    return reply.code(200).send(contract)
  })

  fastify.post('/api/v1/runtime-protocol/contracts/:id/activate', async (req, reply) => {
    if (!ctx.federationContractService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const contract = await ctx.federationContractService.activateContract(id)
    return reply.code(200).send(contract)
  })

  fastify.post('/api/v1/runtime-protocol/contracts/:id/revoke', async (req, reply) => {
    if (!ctx.federationContractService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const contract = await ctx.federationContractService.revokeContract(id)
    return reply.code(200).send(contract)
  })

  fastify.get('/api/v1/runtime-protocol/contracts/:id', async (req, reply) => {
    if (!ctx.federationContractService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const contract = await ctx.federationContractService.getContract(id)
    if (!contract) return reply.code(404).send({ error: 'Contract not found' })
    return reply.code(200).send(contract)
  })

  // ── Protocol Registry ────────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-protocol/registry', async (req, reply) => {
    if (!ctx.distributedContractRegistry) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertRegistrySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { endpointData, ...rest } = parsed.data
    const entry = await ctx.distributedContractRegistry.upsertRegistry({
      ...rest,
      ...(endpointData !== undefined ? { endpointData } : {}),
    })
    return reply.code(200).send(entry)
  })

  fastify.post('/api/v1/runtime-protocol/registry/:nodeId/deregister', async (req, reply) => {
    if (!ctx.distributedContractRegistry) return reply.code(503).send({ error: 'Service unavailable' })
    const { nodeId } = req.params as { nodeId: string }
    await ctx.distributedContractRegistry.deregisterNode(nodeId)
    return reply.code(204).send()
  })

  fastify.get('/api/v1/runtime-protocol/registry/:nodeId', async (req, reply) => {
    if (!ctx.distributedContractRegistry) return reply.code(503).send({ error: 'Service unavailable' })
    const { nodeId } = req.params as { nodeId: string }
    const entry = await ctx.distributedContractRegistry.getRegistryEntry(nodeId)
    if (!entry) return reply.code(404).send({ error: 'Registry entry not found' })
    return reply.code(200).send(entry)
  })

  // ── Runtime Handshakes ───────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-protocol/handshake', async (req, reply) => {
    if (!ctx.runtimeHandshakeService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = initiateHandshakeSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { handshakeData, ...rest } = parsed.data
    const handshake = await ctx.runtimeHandshakeService.initiateHandshake({
      ...rest,
      ...(handshakeData !== undefined ? { handshakeData } : {}),
    })
    return reply.code(200).send(handshake)
  })

  fastify.post('/api/v1/runtime-protocol/handshake/:id/acknowledge', async (req, reply) => {
    if (!ctx.runtimeHandshakeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const handshake = await ctx.runtimeHandshakeService.acknowledgeHandshake(id)
    return reply.code(200).send(handshake)
  })

  fastify.post('/api/v1/runtime-protocol/handshake/:id/complete', async (req, reply) => {
    if (!ctx.runtimeHandshakeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const handshake = await ctx.runtimeHandshakeService.completeHandshake(id)
    return reply.code(200).send(handshake)
  })

  fastify.post('/api/v1/runtime-protocol/handshake/:id/reject', async (req, reply) => {
    if (!ctx.runtimeHandshakeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const handshake = await ctx.runtimeHandshakeService.rejectHandshake(id)
    return reply.code(200).send(handshake)
  })

  fastify.get('/api/v1/runtime-protocol/handshake/:id', async (req, reply) => {
    if (!ctx.runtimeHandshakeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const handshake = await ctx.runtimeHandshakeService.getHandshake(id)
    if (!handshake) return reply.code(404).send({ error: 'Handshake not found' })
    return reply.code(200).send(handshake)
  })

  // ── Protocol Bridges ─────────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-protocol/bridge', async (req, reply) => {
    if (!ctx.interSystemBridgeService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertBridgeSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { bridgeData, ...rest } = parsed.data
    const bridge = await ctx.interSystemBridgeService.upsertBridge({
      ...rest,
      ...(bridgeData !== undefined ? { bridgeData } : {}),
    })
    return reply.code(200).send(bridge)
  })

  fastify.post('/api/v1/runtime-protocol/bridge/:bridgeId/fail', async (req, reply) => {
    if (!ctx.interSystemBridgeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { bridgeId } = req.params as { bridgeId: string }
    await ctx.interSystemBridgeService.failBridge(bridgeId)
    return reply.code(204).send()
  })

  fastify.get('/api/v1/runtime-protocol/bridge/:bridgeId', async (req, reply) => {
    if (!ctx.interSystemBridgeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { bridgeId } = req.params as { bridgeId: string }
    const bridge = await ctx.interSystemBridgeService.getBridge(bridgeId)
    if (!bridge) return reply.code(404).send({ error: 'Bridge not found' })
    return reply.code(200).send(bridge)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-protocol/cleanup', async (req, reply) => {
    if (!ctx.protocolRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupProtocolSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.protocolRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
