import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  registerPropertySchema,
  purchasePropertySchema,
  enterPropertySchema,
  exitPropertySchema,
  lockPropertySchema,
  unlockPropertySchema,
  breachPropertySchema,
  endBreachSchema,
  seizePropertySchema,
  grantAccessSchema,
  revokeAccessSchema,
  depositStorageSchema,
  withdrawStorageSchema,
  linkGarageSchema,
  retrieveFromPropertySchema,
} from '@atc/operations'
import {
  PropertyError,
  PropertyValidationError,
  PropertyNotFoundError,
  PropertyImmutableError,
  PropertyAlreadyOwnedError,
  PropertyNotOwnedError,
  PropertyAccessDeniedError,
  PropertyAccessNotFoundError,
  PropertyKeyNotFoundError,
  PropertyKeyAlreadyIssuedError,
  PropertyAccessConflictError,
  StashNotFoundError,
  StashCapacityError,
  StashItemNotFoundError,
  StashInsufficientQuantityError,
  PropertyGarageNotFoundError,
  PropertyGarageAlreadyLinkedError,
  EmergencyAccessError,
} from '@atc/property-runtime'

function propertyErrorToResponse(err: PropertyError): { status: number; error: string; message: string } {
  if (err instanceof PropertyValidationError)        return { status: 400, error: 'PropertyValidation',       message: err.message }
  if (err instanceof PropertyImmutableError)         return { status: 422, error: 'PropertyImmutable',        message: err.message }
  if (err instanceof PropertyAlreadyOwnedError)      return { status: 409, error: 'PropertyAlreadyOwned',     message: err.message }
  if (err instanceof PropertyAccessConflictError)    return { status: 409, error: 'PropertyAccessConflict',   message: err.message }
  if (err instanceof PropertyKeyAlreadyIssuedError)  return { status: 409, error: 'PropertyKeyAlreadyIssued', message: err.message }
  if (err instanceof PropertyGarageAlreadyLinkedError) return { status: 409, error: 'PropertyGarageAlreadyLinked', message: err.message }
  if (err instanceof StashCapacityError)             return { status: 409, error: 'StashCapacity',            message: err.message }
  if (err instanceof StashInsufficientQuantityError) return { status: 409, error: 'StashInsufficientQuantity', message: err.message }
  if (err instanceof PropertyAccessDeniedError)      return { status: 403, error: 'PropertyAccessDenied',     message: err.message }
  if (err instanceof EmergencyAccessError)           return { status: 422, error: 'EmergencyAccess',          message: err.message }
  if (err instanceof PropertyNotOwnedError)          return { status: 404, error: 'PropertyNotOwned',         message: err.message }
  if (err instanceof PropertyNotFoundError)          return { status: 404, error: 'PropertyNotFound',         message: err.message }
  if (err instanceof PropertyAccessNotFoundError)    return { status: 404, error: 'PropertyAccessNotFound',   message: err.message }
  if (err instanceof PropertyKeyNotFoundError)       return { status: 404, error: 'PropertyKeyNotFound',      message: err.message }
  if (err instanceof StashNotFoundError)             return { status: 404, error: 'StashNotFound',            message: err.message }
  if (err instanceof StashItemNotFoundError)         return { status: 404, error: 'StashItemNotFound',        message: err.message }
  if (err instanceof PropertyGarageNotFoundError)    return { status: 404, error: 'PropertyGarageNotFound',   message: err.message }
  return { status: 500, error: 'PropertyError', message: err.message }
}

const NOT_CONFIGURED = { error: 'Property runtime not configured' }

export async function propertyRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Register property ─────────────────────────────────────────────────────────

  fastify.post('/api/v1/properties', {
    preHandler: requireCapability(ctx, 'property:register'),
    handler: async (req, reply) => {
      if (!ctx.propertyRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = registerPropertySchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const property = await ctx.propertyRuntimeService.register(parsed.data)
        return reply.status(201).send(property)
      } catch (err) {
        if (err instanceof PropertyError) {
          const r = propertyErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  // ── Get property ──────────────────────────────────────────────────────────────

  fastify.get('/api/v1/properties/:propertyId', {
    preHandler: requireCapability(ctx, 'property:read'),
    handler: async (req, reply) => {
      if (!ctx.propertyRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { propertyId } = req.params as { propertyId: string }
      const property = await ctx.propertyRuntimeService.findById(propertyId)
      if (!property) return reply.status(404).send({ error: 'PropertyNotFound', message: `Property ${propertyId} not found` })
      return reply.send(property)
    },
  })

  // ── Purchase property ─────────────────────────────────────────────────────────

  fastify.post('/api/v1/properties/:propertyId/purchase', {
    preHandler: requireCapability(ctx, 'property:purchase'),
    handler: async (req, reply) => {
      if (!ctx.propertyRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { propertyId } = req.params as { propertyId: string }
      const parsed = purchasePropertySchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const property = await ctx.propertyRuntimeService.purchase(propertyId, parsed.data)
        return reply.status(200).send(property)
      } catch (err) {
        if (err instanceof PropertyError) {
          const r = propertyErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  // ── Enter property ────────────────────────────────────────────────────────────

  fastify.post('/api/v1/properties/:propertyId/enter', {
    preHandler: requireCapability(ctx, 'property:occupancy'),
    handler: async (req, reply) => {
      if (!ctx.interiorStateService) return reply.status(503).send(NOT_CONFIGURED)
      const { propertyId } = req.params as { propertyId: string }
      const parsed = enterPropertySchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const runtime = await ctx.interiorStateService.enter(propertyId, parsed.data.principalId)
        return reply.status(200).send(runtime)
      } catch (err) {
        if (err instanceof PropertyError) {
          const r = propertyErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  // ── Exit property ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/properties/:propertyId/exit', {
    preHandler: requireCapability(ctx, 'property:occupancy'),
    handler: async (req, reply) => {
      if (!ctx.interiorStateService) return reply.status(503).send(NOT_CONFIGURED)
      const { propertyId } = req.params as { propertyId: string }
      const parsed = exitPropertySchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const runtime = await ctx.interiorStateService.exit(propertyId, parsed.data.principalId)
        return reply.status(200).send(runtime)
      } catch (err) {
        if (err instanceof PropertyError) {
          const r = propertyErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  // ── Lock property ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/properties/:propertyId/lock', {
    preHandler: requireCapability(ctx, 'property:lock'),
    handler: async (req, reply) => {
      if (!ctx.interiorStateService) return reply.status(503).send(NOT_CONFIGURED)
      const { propertyId } = req.params as { propertyId: string }
      const parsed = lockPropertySchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const property = await ctx.interiorStateService.lock(propertyId, parsed.data.principalId)
        return reply.status(200).send(property)
      } catch (err) {
        if (err instanceof PropertyError) {
          const r = propertyErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  // ── Unlock property ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/properties/:propertyId/unlock', {
    preHandler: requireCapability(ctx, 'property:lock'),
    handler: async (req, reply) => {
      if (!ctx.interiorStateService) return reply.status(503).send(NOT_CONFIGURED)
      const { propertyId } = req.params as { propertyId: string }
      const parsed = unlockPropertySchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const property = await ctx.interiorStateService.unlock(propertyId, parsed.data.principalId)
        return reply.status(200).send(property)
      } catch (err) {
        if (err instanceof PropertyError) {
          const r = propertyErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  // ── Breach property ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/properties/:propertyId/breach', {
    preHandler: requireCapability(ctx, 'property:breach'),
    handler: async (req, reply) => {
      if (!ctx.emergencyAccessService) return reply.status(503).send(NOT_CONFIGURED)
      const { propertyId } = req.params as { propertyId: string }
      const parsed = breachPropertySchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const property = await ctx.emergencyAccessService.breach(propertyId, parsed.data)
        return reply.status(200).send(property)
      } catch (err) {
        if (err instanceof PropertyError) {
          const r = propertyErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  // ── Grant access ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/properties/:propertyId/access/grant', {
    preHandler: requireCapability(ctx, 'property:access'),
    handler: async (req, reply) => {
      if (!ctx.propertyAccessService) return reply.status(503).send(NOT_CONFIGURED)
      const { propertyId } = req.params as { propertyId: string }
      const parsed = grantAccessSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const access = await ctx.propertyAccessService.grantAccess({ propertyId, ...parsed.data })
        return reply.status(201).send(access)
      } catch (err) {
        if (err instanceof PropertyError) {
          const r = propertyErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  // ── Revoke access ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/properties/:propertyId/access/:accessId/revoke', {
    preHandler: requireCapability(ctx, 'property:access'),
    handler: async (req, reply) => {
      if (!ctx.propertyAccessService) return reply.status(503).send(NOT_CONFIGURED)
      const { accessId } = req.params as { propertyId: string; accessId: string }
      const parsed = revokeAccessSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const access = await ctx.propertyAccessService.revokeAccess(accessId, parsed.data.revokedByPrincipalId)
        return reply.status(200).send(access)
      } catch (err) {
        if (err instanceof PropertyError) {
          const r = propertyErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  // ── Storage contents ──────────────────────────────────────────────────────────

  fastify.get('/api/v1/properties/:propertyId/storage/:stashId', {
    preHandler: requireCapability(ctx, 'property:storage'),
    handler: async (req, reply) => {
      if (!ctx.storageContainerService) return reply.status(503).send(NOT_CONFIGURED)
      const { propertyId, stashId } = req.params as { propertyId: string; stashId: string }
      try {
        const contents = await ctx.storageContainerService.getContents(propertyId, stashId)
        const capacity = await ctx.storageContainerService.getCapacity(propertyId, stashId)
        return reply.send({ stashId, contents, capacity })
      } catch (err) {
        if (err instanceof PropertyError) {
          const r = propertyErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  // ── Deposit to storage ────────────────────────────────────────────────────────

  fastify.post('/api/v1/properties/:propertyId/storage/deposit', {
    preHandler: requireCapability(ctx, 'property:storage'),
    handler: async (req, reply) => {
      if (!ctx.storageContainerService) return reply.status(503).send(NOT_CONFIGURED)
      const { propertyId } = req.params as { propertyId: string }
      const parsed = depositStorageSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const item = await ctx.storageContainerService.deposit(propertyId, parsed.data.stashId, {
          itemName: parsed.data.itemName,
          quantity: parsed.data.quantity,
          metadata: parsed.data.metadata,
          addedByPrincipalId: parsed.data.addedByPrincipalId,
        })
        return reply.status(200).send(item)
      } catch (err) {
        if (err instanceof PropertyError) {
          const r = propertyErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  // ── Withdraw from storage ─────────────────────────────────────────────────────

  fastify.post('/api/v1/properties/:propertyId/storage/withdraw', {
    preHandler: requireCapability(ctx, 'property:storage'),
    handler: async (req, reply) => {
      if (!ctx.storageContainerService) return reply.status(503).send(NOT_CONFIGURED)
      const { propertyId } = req.params as { propertyId: string }
      const parsed = withdrawStorageSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        await ctx.storageContainerService.withdraw(propertyId, parsed.data.stashId, {
          itemName: parsed.data.itemName,
          quantity: parsed.data.quantity,
          removedByPrincipalId: parsed.data.removedByPrincipalId,
        })
        return reply.status(204).send()
      } catch (err) {
        if (err instanceof PropertyError) {
          const r = propertyErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  // ── Link garage ───────────────────────────────────────────────────────────────

  fastify.post('/api/v1/properties/:propertyId/garage/link', {
    preHandler: requireCapability(ctx, 'property:garage'),
    handler: async (req, reply) => {
      if (!ctx.propertyGarageService) return reply.status(503).send(NOT_CONFIGURED)
      const { propertyId } = req.params as { propertyId: string }
      const parsed = linkGarageSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const garage = await ctx.propertyGarageService.linkGarage(propertyId, parsed.data)
        return reply.status(201).send(garage)
      } catch (err) {
        if (err instanceof PropertyError) {
          const r = propertyErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  // ── Retrieve vehicle from property garage ─────────────────────────────────────

  fastify.post('/api/v1/properties/:propertyId/garage/retrieve', {
    preHandler: requireCapability(ctx, 'property:garage'),
    handler: async (req, reply) => {
      if (!ctx.propertyGarageService) return reply.status(503).send(NOT_CONFIGURED)
      const { propertyId } = req.params as { propertyId: string }
      const parsed = retrieveFromPropertySchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.propertyGarageService.retrieveVehicle(propertyId, parsed.data)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof PropertyError) {
          const r = propertyErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })
}
