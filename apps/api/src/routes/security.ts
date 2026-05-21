import type { FastifyPluginAsync } from 'fastify'
import type { AppContext } from '../context.js'
import {
  authorizeRequestSchema,
  capabilityCheckRequestSchema,
  auditQuerySchema,
  listPrincipalsQuerySchema,
  createPrincipalSchema,
  updatePrincipalSchema,
  assignRoleSchema,
  grantCapabilitySchema,
} from '@atc/operations'
import { BUILT_IN_ROLES } from '@atc/iam'
import { ATC_SECURITY_EVENTS } from '@atc/shared-types'
import type { AtcPrincipal } from '@atc/shared-types'

export const securityRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (
  fastify,
  { ctx },
) => {
  // ── Roles ─────────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/security/roles', async (_req, reply) => {
    const roles = BUILT_IN_ROLES.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      permissions: r.permissions,
      capabilities: r.capabilities,
      inherits: r.inherits,
    }))
    return reply.code(200).send({ total: roles.length, roles })
  })

  // ── Principals — list ─────────────────────────────────────────────────────────

  fastify.get('/api/v1/security/principals', async (req, reply) => {
    const parsed = listPrincipalsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() })
    }
    const q = parsed.data

    if (!ctx.principalStore) {
      return reply.code(200).send({ total: 0, principals: [], offset: q.offset, limit: q.limit })
    }

    const page = await ctx.principalStore.principals.list({
      limit: q.limit,
      offset: q.offset,
      ...(q.type !== undefined ? { type: q.type } : {}),
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.accountId !== undefined ? { accountId: q.accountId } : {}),
    })

    return reply.code(200).send({
      total: page.total,
      principals: page.items,
      offset: page.offset,
      limit: page.limit,
    })
  })

  // ── Principals — create ───────────────────────────────────────────────────────

  fastify.post('/api/v1/security/principals', async (req, reply) => {
    const parsed = createPrincipalSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() })
    }
    const body = parsed.data

    if (!ctx.principalStore) {
      return reply.code(503).send({ error: 'Principal store not configured' })
    }

    const principal = await ctx.principalStore.principals.create({
      type: body.type,
      displayName: body.displayName,
      ...(body.accountId !== undefined ? { accountId: body.accountId } : {}),
      ...(body.trustLevel !== undefined ? { trustLevel: body.trustLevel } : {}),
      ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
    })

    void ctx.eventBus.emit(ATC_SECURITY_EVENTS.PRINCIPAL_CREATED, { principalId: principal.id, type: principal.type })

    if (ctx.principalStore.securityEvents) {
      void ctx.principalStore.securityEvents.append({
        actorId: 'system',
        actorType: 'system',
        action: 'principal.create',
        target: principal.id,
        result: 'granted',
        metadata: { type: principal.type, displayName: principal.displayName },
      })
    }

    return reply.code(201).send(principal)
  })

  // ── Principals — get by ID ────────────────────────────────────────────────────

  fastify.get('/api/v1/security/principals/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    if (!id || id.length > 128) {
      return reply.code(400).send({ error: 'Invalid principal id' })
    }

    if (!ctx.principalStore) {
      return reply.code(503).send({ error: 'Principal store not configured' })
    }

    const principal = await ctx.principalStore.principals.findById(id)
    if (!principal) {
      return reply.code(404).send({ error: 'Principal not found' })
    }

    return reply.code(200).send(principal)
  })

  // ── Principals — update ───────────────────────────────────────────────────────

  fastify.put('/api/v1/security/principals/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    if (!id || id.length > 128) {
      return reply.code(400).send({ error: 'Invalid principal id' })
    }

    const parsed = updatePrincipalSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() })
    }
    const body = parsed.data

    if (!ctx.principalStore) {
      return reply.code(503).send({ error: 'Principal store not configured' })
    }

    const patch: import('@atc/principal-store').UpdatePrincipalParams = {}
    if (body.displayName !== undefined) patch.displayName = body.displayName
    if (body.trustLevel !== undefined) patch.trustLevel = body.trustLevel
    if (body.metadata !== undefined) patch.metadata = body.metadata

    const updated = await ctx.principalStore.principals.update(id, patch)
    if (!updated) {
      return reply.code(404).send({ error: 'Principal not found' })
    }

    void ctx.eventBus.emit(ATC_SECURITY_EVENTS.PRINCIPAL_UPDATED, { principalId: id })

    // Invalidate IAM cache so next resolve picks up changes
    if (ctx.iamCache) {
      void ctx.iamCache.invalidatePrincipal(id)
      ctx.telemetry?.increment('iam.cache_invalidations_total')
    }

    return reply.code(200).send(updated)
  })

  // ── Principals — disable ──────────────────────────────────────────────────────

  fastify.post('/api/v1/security/principals/:id/disable', async (req, reply) => {
    const { id } = req.params as { id: string }
    if (!id || id.length > 128) {
      return reply.code(400).send({ error: 'Invalid principal id' })
    }

    if (!ctx.principalStore) {
      return reply.code(503).send({ error: 'Principal store not configured' })
    }

    const ok = await ctx.principalStore.principals.disable(id)
    if (!ok) {
      return reply.code(404).send({ error: 'Principal not found or already disabled' })
    }

    void ctx.eventBus.emit(ATC_SECURITY_EVENTS.PRINCIPAL_DISABLED, { principalId: id })

    if (ctx.iamCache) {
      void ctx.iamCache.invalidatePrincipal(id)
      ctx.telemetry?.increment('iam.cache_invalidations_total')
    }

    if (ctx.principalStore.securityEvents) {
      void ctx.principalStore.securityEvents.append({
        actorId: 'system',
        actorType: 'system',
        action: 'principal.disable',
        target: id,
        result: 'granted',
      })
    }

    return reply.code(200).send({ disabled: true, principalId: id })
  })

  // ── Role assignments — assign ─────────────────────────────────────────────────

  fastify.post('/api/v1/security/principals/:id/roles', async (req, reply) => {
    const { id } = req.params as { id: string }
    if (!id || id.length > 128) {
      return reply.code(400).send({ error: 'Invalid principal id' })
    }

    const parsed = assignRoleSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() })
    }
    const body = parsed.data

    if (!ctx.principalStore) {
      return reply.code(503).send({ error: 'Principal store not configured' })
    }

    const exists = await ctx.principalStore.principals.findById(id)
    if (!exists) {
      return reply.code(404).send({ error: 'Principal not found' })
    }

    const assignment = await ctx.principalStore.roleAssignments.assign({
      principalId: id,
      roleId: body.roleId,
      assignedBy: body.assignedBy,
      ...(body.expiresAt !== undefined ? { expiresAt: new Date(body.expiresAt) } : {}),
    })

    void ctx.eventBus.emit(ATC_SECURITY_EVENTS.ROLE_ASSIGNED, {
      principalId: id,
      roleId: body.roleId,
      assignedBy: body.assignedBy,
    })

    if (ctx.iamCache) {
      void ctx.iamCache.invalidatePrincipal(id)
      ctx.telemetry?.increment('iam.cache_invalidations_total')
    }

    return reply.code(201).send(assignment)
  })

  // ── Role assignments — revoke ─────────────────────────────────────────────────

  fastify.delete('/api/v1/security/principals/:id/roles/:roleId', async (req, reply) => {
    const { id, roleId } = req.params as { id: string; roleId: string }
    if (!id || id.length > 128) {
      return reply.code(400).send({ error: 'Invalid principal id' })
    }
    if (!roleId || roleId.length > 64) {
      return reply.code(400).send({ error: 'Invalid role id' })
    }

    if (!ctx.principalStore) {
      return reply.code(503).send({ error: 'Principal store not configured' })
    }

    const ok = await ctx.principalStore.roleAssignments.revoke(id, roleId)
    if (!ok) {
      return reply.code(404).send({ error: 'Role assignment not found' })
    }

    void ctx.eventBus.emit(ATC_SECURITY_EVENTS.ROLE_REVOKED, { principalId: id, roleId })

    if (ctx.iamCache) {
      void ctx.iamCache.invalidatePrincipal(id)
      ctx.telemetry?.increment('iam.cache_invalidations_total')
    }

    return reply.code(200).send({ revoked: true, principalId: id, roleId })
  })

  // ── Capability grants — grant ─────────────────────────────────────────────────

  fastify.post('/api/v1/security/principals/:id/capabilities', async (req, reply) => {
    const { id } = req.params as { id: string }
    if (!id || id.length > 128) {
      return reply.code(400).send({ error: 'Invalid principal id' })
    }

    const parsed = grantCapabilitySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() })
    }
    const body = parsed.data

    if (!ctx.principalStore) {
      return reply.code(503).send({ error: 'Principal store not configured' })
    }

    const exists = await ctx.principalStore.principals.findById(id)
    if (!exists) {
      return reply.code(404).send({ error: 'Principal not found' })
    }

    const assignment = await ctx.principalStore.capabilities.grant({
      principalId: id,
      capability: body.capability,
      grantedBy: body.grantedBy,
      ...(body.expiresAt !== undefined ? { expiresAt: new Date(body.expiresAt) } : {}),
    })

    void ctx.eventBus.emit(ATC_SECURITY_EVENTS.CAPABILITY_GRANTED, {
      principalId: id,
      capability: body.capability,
      grantedBy: body.grantedBy,
    })

    if (ctx.iamCache) {
      void ctx.iamCache.invalidatePrincipal(id)
      ctx.telemetry?.increment('iam.cache_invalidations_total')
    }

    return reply.code(201).send(assignment)
  })

  // ── Capability grants — revoke ────────────────────────────────────────────────

  fastify.delete('/api/v1/security/principals/:id/capabilities/:capability', async (req, reply) => {
    const { id, capability } = req.params as { id: string; capability: string }
    if (!id || id.length > 128) {
      return reply.code(400).send({ error: 'Invalid principal id' })
    }
    if (!capability || capability.length > 128) {
      return reply.code(400).send({ error: 'Invalid capability' })
    }

    if (!ctx.principalStore) {
      return reply.code(503).send({ error: 'Principal store not configured' })
    }

    const ok = await ctx.principalStore.capabilities.revoke(id, capability)
    if (!ok) {
      return reply.code(404).send({ error: 'Capability assignment not found' })
    }

    void ctx.eventBus.emit(ATC_SECURITY_EVENTS.CAPABILITY_REVOKED, { principalId: id, capability })

    if (ctx.iamCache) {
      void ctx.iamCache.invalidatePrincipal(id)
      ctx.telemetry?.increment('iam.cache_invalidations_total')
    }

    return reply.code(200).send({ revoked: true, principalId: id, capability })
  })

  // ── Audit log ─────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/security/audit', async (req, reply) => {
    const parsedQuery = auditQuerySchema.safeParse(req.query)
    if (!parsedQuery.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsedQuery.error.flatten() })
    }
    const query = parsedQuery.data

    // Prefer durable DB-backed audit when available
    if (ctx.principalStore?.securityEvents) {
      const page = await ctx.principalStore.securityEvents.list({
        limit: query.limit,
        offset: query.offset,
        ...(query.actorId !== undefined ? { actorId: query.actorId } : {}),
        ...(query.action !== undefined ? { action: query.action } : {}),
        ...(query.result !== undefined ? { result: query.result } : {}),
      })
      return reply.code(200).send(page)
    }

    // Fall back to in-memory audit service
    if (!ctx.auditService) {
      return reply.code(200).send({ events: [], total: 0, offset: query.offset, limit: query.limit })
    }
    const page = ctx.auditService.list({
      limit: query.limit,
      offset: query.offset,
      ...(query.actorId !== undefined ? { actorId: query.actorId } : {}),
      ...(query.action !== undefined ? { action: query.action } : {}),
      ...(query.result !== undefined ? { result: query.result } : {}),
    })
    return reply.code(200).send(page)
  })

  // ── Authorization check ───────────────────────────────────────────────────────

  fastify.post('/api/v1/security/authorize', async (req, reply) => {
    const parsed = authorizeRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() })
    }
    const body = parsed.data

    if (!ctx.authEngine) {
      return reply.code(503).send({ error: 'Authorization engine not configured' })
    }

    const principal: AtcPrincipal = {
      id: body.principalId,
      type: body.principalType,
      roles: body.roles,
      permissions: body.permissions as AtcPrincipal['permissions'],
      capabilities: body.capabilities as AtcPrincipal['capabilities'],
      denies: body.denies as AtcPrincipal['denies'],
    }

    const result = ctx.authEngine.authorize(principal, body.permission as AtcPrincipal['permissions'][number])

    // Durable audit
    if (ctx.principalStore?.securityEvents) {
      void ctx.principalStore.securityEvents.append({
        actorId: body.principalId,
        actorType: body.principalType,
        action: body.permission,
        result: result.authorized ? 'granted' : 'denied',
        metadata: { matchedRole: result.matchedRole, reason: result.reason },
      })
    }

    // In-memory audit
    if (ctx.auditService) {
      ctx.auditService.append({
        actorId: body.principalId,
        actorType: body.principalType,
        action: body.permission,
        result: result.authorized ? 'granted' : 'denied',
        metadata: { matchedRole: result.matchedRole, reason: result.reason },
      })
    }

    return reply.code(200).send(result)
  })

  // ── Capability check ──────────────────────────────────────────────────────────

  fastify.post('/api/v1/security/capabilities/check', async (req, reply) => {
    const parsed = capabilityCheckRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() })
    }
    const body = parsed.data

    if (!ctx.authEngine) {
      return reply.code(503).send({ error: 'Authorization engine not configured' })
    }

    const principal: AtcPrincipal = {
      id: body.principalId,
      type: body.principalType,
      roles: body.roles,
      permissions: body.permissions as AtcPrincipal['permissions'],
      capabilities: body.capabilities as AtcPrincipal['capabilities'],
      denies: body.denies as AtcPrincipal['denies'],
      ...(body.trustLevel !== undefined ? { trustLevel: body.trustLevel } : {}),
    }

    const result = ctx.authEngine.authorizeCapability(
      principal,
      body.capability as AtcPrincipal['capabilities'][number],
    )

    // Durable audit
    if (ctx.principalStore?.securityEvents) {
      void ctx.principalStore.securityEvents.append({
        actorId: body.principalId,
        actorType: body.principalType,
        action: `capability:${body.capability}`,
        result: result.authorized ? 'granted' : 'denied',
        metadata: { capability: body.capability, reason: result.reason },
      })
    }

    // In-memory audit
    if (ctx.auditService) {
      ctx.auditService.append({
        actorId: body.principalId,
        actorType: body.principalType,
        action: `capability:${body.capability}`,
        result: result.authorized ? 'granted' : 'denied',
        metadata: { capability: body.capability, reason: result.reason },
      })
    }

    return reply.code(200).send(result)
  })
}
