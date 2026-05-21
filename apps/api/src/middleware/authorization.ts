import type { FastifyRequest, FastifyReply } from 'fastify'
import type { AppContext } from '../context.js'
import type { AtcPrincipal } from '@atc/shared-types'

// ── Fastify augmentation ───────────────────────────────────────────────────────
// Attach the resolved principal to requests so route handlers can inspect it.

declare module 'fastify' {
  interface FastifyRequest {
    principal?: AtcPrincipal
  }
}

const PRINCIPAL_HEADER = 'x-atc-principal-id'

/**
 * Resolves the caller's AtcPrincipal from the request.
 *
 * Resolution order:
 * 1. If `X-ATC-Principal-Id` header is present, look up in IAM cache then principal store.
 * 2. If no header, returns null — the middleware functions treat this as unauthorized.
 */
async function _resolvePrincipal(ctx: AppContext, req: FastifyRequest): Promise<AtcPrincipal | null> {
  const principalId = req.headers[PRINCIPAL_HEADER]
  if (typeof principalId !== 'string' || !principalId) return null

  // IAM cache — fast path
  if (ctx.iamCache) {
    const cached = await ctx.iamCache.getPrincipal(principalId)
    if (cached) return cached
  }

  // Principal store — authoritative source
  if (!ctx.principalStore) return null
  const principal = await ctx.principalStore.principals.resolve(principalId)

  // Warm the cache for subsequent requests on the same connection
  if (principal && ctx.iamCache) {
    void ctx.iamCache.setPrincipal(principal.id, principal)
    ctx.telemetry?.increment('iam.cache_invalidations_total') // reuse counter as "cache warm"
  }

  return principal
}

/**
 * Fastify `preHandler` hook that requires the caller to have a specific permission.
 *
 * When `authEngine` is not configured the hook passes (degraded mode).
 * On success the resolved principal is attached to `req.principal`.
 *
 * @example
 * fastify.post('/my-route', {
 *   preHandler: requirePermission(ctx, 'player.ban'),
 * }, handler)
 */
export function requirePermission(ctx: AppContext, permission: string) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!ctx.authEngine) return

    const principal = await _resolvePrincipal(ctx, req)
    if (!principal) {
      return reply.code(401).send({ error: 'Principal required', code: 'PRINCIPAL_REQUIRED' })
    }
    req.principal = principal

    const result = ctx.authEngine.authorize(
      principal,
      permission as AtcPrincipal['permissions'][number],
    )
    if (!result.authorized) {
      return reply.code(403).send({ error: 'Forbidden', reason: result.reason, code: 'PERMISSION_DENIED' })
    }
  }
}

/**
 * Fastify `preHandler` hook that requires the caller to have a specific capability.
 *
 * When `authEngine` is not configured the hook passes (degraded mode).
 */
export function requireCapability(ctx: AppContext, capability: string) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!ctx.authEngine) return

    const principal = await _resolvePrincipal(ctx, req)
    if (!principal) {
      return reply.code(401).send({ error: 'Principal required', code: 'PRINCIPAL_REQUIRED' })
    }
    req.principal = principal

    const result = ctx.authEngine.authorizeCapability(
      principal,
      capability as AtcPrincipal['capabilities'][number],
    )
    if (!result.authorized) {
      return reply.code(403).send({ error: 'Forbidden', reason: result.reason, code: 'CAPABILITY_DENIED' })
    }
  }
}

/**
 * Fastify `preHandler` hook that requires the caller to hold a specific role.
 *
 * When `authEngine` is not configured the hook passes (degraded mode).
 * Note: checks the principal's resolved roles array — does not traverse inheritance.
 * Use `requirePermission` for inherited permission checks.
 */
export function requireRole(ctx: AppContext, roleId: string) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!ctx.authEngine) return

    const principal = await _resolvePrincipal(ctx, req)
    if (!principal) {
      return reply.code(401).send({ error: 'Principal required', code: 'PRINCIPAL_REQUIRED' })
    }
    req.principal = principal

    if (!principal.roles.includes(roleId)) {
      return reply.code(403).send({
        error: 'Forbidden',
        reason: `Role '${roleId}' required`,
        code: 'ROLE_REQUIRED',
      })
    }
  }
}
