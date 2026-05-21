import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  createRentalContractSchema,
  terminateRentalContractSchema,
  assessPropertyTaxSchema,
  triggerForeclosureSchema,
  valuatePropertySchema,
} from '@atc/operations'
import { HousingEconomyError } from '@atc/housing-economy'

function housingErrorToStatus(err: HousingEconomyError): number {
  const name = err.constructor.name
  if (
    name === 'DuplicatePaymentError' ||
    name === 'ForeclosureAlreadyActiveError' ||
    name === 'RentalContractAlreadyActiveError' ||
    name === 'PropertyTaxAlreadyPaidError'
  ) return 409
  if (
    name === 'RentalContractTerminatedError' ||
    name === 'ForeclosureCompletedError'
  ) return 422
  if (name.endsWith('NotFoundError')) return 404
  return 500
}

const NOT_CONFIGURED = { error: 'Housing economy not configured' }

export async function housingRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Create rental contract ────────────────────────────────────────────────────

  fastify.post('/api/v1/housing/contracts', {
    preHandler: requireCapability(ctx, 'housing:write'),
    handler: async (req, reply) => {
      if (!ctx.housingEconomyService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = createRentalContractSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.housingEconomyService.createRentalContract({
          propertyId:          parsed.data.propertyId,
          tenantPrincipalId:   parsed.data.tenantPrincipalId,
          landlordPrincipalId: parsed.data.landlordPrincipalId,
          rentAmount:          BigInt(parsed.data.monthlyRent),
          depositAmount:       BigInt(parsed.data.depositAmount),
          contractNonce:       parsed.data.contractNonce,
          ...(parsed.data.startDate !== undefined ? { startDate: new Date(parsed.data.startDate) } : {}),
          ...(parsed.data.endDate !== undefined ? { endDate: new Date(parsed.data.endDate) } : {}),
          ...(parsed.data.terms !== undefined ? { notes: parsed.data.terms } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof HousingEconomyError) return reply.status(housingErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Get rental contract ───────────────────────────────────────────────────────

  fastify.get('/api/v1/housing/contracts/:contractId', {
    preHandler: requireCapability(ctx, 'housing:read'),
    handler: async (req, reply) => {
      if (!ctx.rentalContractRepo) return reply.status(503).send(NOT_CONFIGURED)
      const { contractId } = req.params as { contractId: string }
      const contract = await ctx.rentalContractRepo.findById(contractId)
      if (!contract) return reply.status(404).send({ error: 'ContractNotFound' })
      return reply.send(contract)
    },
  })

  // ── Collect rent ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/housing/contracts/:contractId/collect-rent', {
    preHandler: requireCapability(ctx, 'housing:write'),
    handler: async (req, reply) => {
      if (!ctx.housingEconomyService) return reply.status(503).send(NOT_CONFIGURED)
      const { contractId } = req.params as { contractId: string }
      const body = req.body as { idempotencyKey?: string }
      const idempotencyKey = body?.idempotencyKey ?? `rent-${contractId}-${Date.now()}`
      try {
        const result = await ctx.housingEconomyService.collectRent(contractId, idempotencyKey)
        return reply.send(result)
      } catch (err) {
        if (err instanceof HousingEconomyError) return reply.status(housingErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Terminate contract ────────────────────────────────────────────────────────

  fastify.post('/api/v1/housing/contracts/:contractId/terminate', {
    preHandler: requireCapability(ctx, 'housing:write'),
    handler: async (req, reply) => {
      if (!ctx.rentalContractService) return reply.status(503).send(NOT_CONFIGURED)
      const { contractId } = req.params as { contractId: string }
      const parsed = terminateRentalContractSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.rentalContractService.terminateContract(
          contractId,
          parsed.data.terminatedBy,
          parsed.data.reason ?? 'no reason given',
        )
        return reply.send(result)
      } catch (err) {
        if (err instanceof HousingEconomyError) return reply.status(housingErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Assess property tax ───────────────────────────────────────────────────────

  fastify.post('/api/v1/housing/taxes', {
    preHandler: requireCapability(ctx, 'housing:write'),
    handler: async (req, reply) => {
      if (!ctx.housingEconomyService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = assessPropertyTaxSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.housingEconomyService.assessPropertyTax({
          propertyId:  parsed.data.propertyId,
          principalId: parsed.data.ownerPrincipalId,
          periodLabel: parsed.data.periodLabel,
          amount:      BigInt(parsed.data.taxAmount),
          dueAt:       new Date(parsed.data.dueAt),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof HousingEconomyError) return reply.status(housingErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Start foreclosure ─────────────────────────────────────────────────────────

  fastify.post('/api/v1/housing/foreclosures', {
    preHandler: requireCapability(ctx, 'housing:write'),
    handler: async (req, reply) => {
      if (!ctx.housingEconomyService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = triggerForeclosureSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.housingEconomyService.startForeclosure({
          propertyId:              parsed.data.propertyId,
          initiatedByPrincipalId:  parsed.data.ownerPrincipalId,
          foreclosureNonce:        parsed.data.foreclosureNonce,
          reason:                  parsed.data.reason ?? 'forced foreclosure',
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof HousingEconomyError) return reply.status(housingErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Complete foreclosure ──────────────────────────────────────────────────────

  fastify.post('/api/v1/housing/foreclosures/:foreclosureId/complete', {
    preHandler: requireCapability(ctx, 'housing:write'),
    handler: async (req, reply) => {
      if (!ctx.housingEconomyService) return reply.status(503).send(NOT_CONFIGURED)
      const { foreclosureId } = req.params as { foreclosureId: string }
      try {
        const result = await ctx.housingEconomyService.completeForeclosure(foreclosureId)
        return reply.send(result)
      } catch (err) {
        if (err instanceof HousingEconomyError) return reply.status(housingErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Record asset valuation ────────────────────────────────────────────────────

  fastify.post('/api/v1/housing/valuations', {
    preHandler: requireCapability(ctx, 'housing:write'),
    handler: async (req, reply) => {
      if (!ctx.assetValuationService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = valuatePropertySchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.assetValuationService.recordValuation({
          propertyId:          parsed.data.propertyId,
          valuedByPrincipalId: parsed.data.valuatedBy,
          valuationAmount:     BigInt(parsed.data.valuationAmount),
          method:              'manual',
          ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof HousingEconomyError) return reply.status(housingErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Get latest valuation ──────────────────────────────────────────────────────

  fastify.get('/api/v1/housing/valuations/:propertyId/latest', {
    preHandler: requireCapability(ctx, 'housing:read'),
    handler: async (req, reply) => {
      if (!ctx.assetValuationService) return reply.status(503).send(NOT_CONFIGURED)
      const { propertyId } = req.params as { propertyId: string }
      const valuation = await ctx.assetValuationService.getLatestValuation(propertyId)
      if (!valuation) return reply.status(404).send({ error: 'ValuationNotFound' })
      return reply.send(valuation)
    },
  })

  // ── List overdue contracts ────────────────────────────────────────────────────

  fastify.get('/api/v1/housing/contracts/overdue', {
    preHandler: requireCapability(ctx, 'housing:read'),
    handler: async (req, reply) => {
      if (!ctx.rentalContractService) return reply.status(503).send(NOT_CONFIGURED)
      const contracts = await ctx.rentalContractService.listOverdueContracts()
      return reply.send({ contracts })
    },
  })
}
