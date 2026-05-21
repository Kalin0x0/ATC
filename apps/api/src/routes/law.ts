import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  createAgencySchema,
  listAgenciesQuerySchema,
  issueWarrantSchema,
  revokeWarrantSchema,
  listWarrantsQuerySchema,
  issueCitationSchema,
  payCitationSchema,
  listCitationsQuerySchema,
  recordArrestSchema,
  listArrestsQuerySchema,
  enterJailSchema,
  releaseJailSchema,
  collectEvidenceSchema,
  transferCustodySchema,
  listEvidenceQuerySchema,
  createLegalCaseSchema,
  listLegalCasesQuerySchema,
} from '@atc/operations'
import {
  LawError,
  LawValidationError,
  AgencyNotFoundError,
  AgencySlugConflictError,
  WarrantNotFoundError,
  WarrantImmutableError,
  CitationNotFoundError,
  CitationAlreadyPaidError,
  CitationImmutableError,
  ArrestNotFoundError,
  JailRecordNotFoundError,
  JailAlreadyActiveError,
  EvidenceNotFoundError,
  LegalCaseNotFoundError,
} from '@atc/law'

function lawErrorToResponse(err: LawError): { status: number; error: string; message: string } {
  if (err instanceof LawValidationError)      return { status: 400, error: 'LawValidation',        message: err.message }
  if (err instanceof AgencySlugConflictError) return { status: 409, error: 'AgencySlugConflict',   message: err.message }
  if (err instanceof JailAlreadyActiveError)  return { status: 409, error: 'JailAlreadyActive',    message: err.message }
  if (err instanceof CitationAlreadyPaidError)return { status: 409, error: 'CitationAlreadyPaid',  message: err.message }
  if (err instanceof AgencyNotFoundError)     return { status: 404, error: 'AgencyNotFound',        message: err.message }
  if (err instanceof WarrantNotFoundError)    return { status: 404, error: 'WarrantNotFound',       message: err.message }
  if (err instanceof CitationNotFoundError)   return { status: 404, error: 'CitationNotFound',      message: err.message }
  if (err instanceof ArrestNotFoundError)     return { status: 404, error: 'ArrestNotFound',        message: err.message }
  if (err instanceof JailRecordNotFoundError) return { status: 404, error: 'JailRecordNotFound',    message: err.message }
  if (err instanceof EvidenceNotFoundError)   return { status: 404, error: 'EvidenceNotFound',      message: err.message }
  if (err instanceof LegalCaseNotFoundError)  return { status: 404, error: 'LegalCaseNotFound',     message: err.message }
  if (err instanceof WarrantImmutableError)   return { status: 422, error: 'WarrantImmutable',      message: err.message }
  if (err instanceof CitationImmutableError)  return { status: 422, error: 'CitationImmutable',     message: err.message }
  return { status: 500, error: 'LawError', message: err.message }
}

const NOT_CONFIGURED = { error: 'Law system not configured' }

export async function lawRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
) {
  const { ctx } = opts

  // ── Agencies ─────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/law/agencies', {
    preHandler: requireCapability(ctx, 'law.read'),
  }, async (req, reply) => {
    if (!ctx.lawAgencyRepo) return reply.code(503).send(NOT_CONFIGURED)
    const result = listAgenciesQuerySchema.safeParse(req.query)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const page = await ctx.lawAgencyRepo.list(result.data)
      return reply.send(page)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/law/agencies', {
    preHandler: requireCapability(ctx, 'law.write'),
  }, async (req, reply) => {
    if (!ctx.lawService) return reply.code(503).send(NOT_CONFIGURED)
    const result = createAgencySchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const agency = await ctx.lawService.createAgency(result.data)
      return reply.code(201).send(agency)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.delete('/api/v1/law/agencies/:agencyId', {
    preHandler: requireCapability(ctx, 'law.write'),
  }, async (req, reply) => {
    if (!ctx.lawAgencyRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { agencyId } = req.params as { agencyId: string }
    try {
      const agency = await ctx.lawAgencyRepo.deactivate(agencyId)
      return reply.send(agency)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  // ── Warrants ─────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/law/warrants', {
    preHandler: requireCapability(ctx, 'law.read'),
  }, async (req, reply) => {
    if (!ctx.lawWarrantRepo) return reply.code(503).send(NOT_CONFIGURED)
    const result = listWarrantsQuerySchema.safeParse(req.query)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const page = await ctx.lawWarrantRepo.list(result.data)
      return reply.send(page)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.get('/api/v1/law/warrants/:warrantId', {
    preHandler: requireCapability(ctx, 'law.read'),
  }, async (req, reply) => {
    if (!ctx.lawWarrantRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { warrantId } = req.params as { warrantId: string }
    try {
      const warrant = await ctx.lawWarrantRepo.findById(warrantId)
      if (!warrant) return reply.code(404).send({ error: 'WarrantNotFound', message: `Warrant not found: ${warrantId}` })
      return reply.send(warrant)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/law/warrants', {
    preHandler: requireCapability(ctx, 'warrant.issue'),
  }, async (req, reply) => {
    if (!ctx.lawService) return reply.code(503).send(NOT_CONFIGURED)
    const result = issueWarrantSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const d = result.data
      const warrant = await ctx.lawService.issueWarrant({
        characterId:         d.characterId,
        issuedByPrincipalId: d.issuedByPrincipalId,
        agencyId:            d.agencyId,
        severity:            d.severity,
        reason:              d.reason,
        expiresAt:           d.expiresAt ? new Date(d.expiresAt) : undefined,
      })
      return reply.code(201).send(warrant)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/law/warrants/:warrantId/execute', {
    preHandler: requireCapability(ctx, 'warrant.issue'),
  }, async (req, reply) => {
    if (!ctx.lawService) return reply.code(503).send(NOT_CONFIGURED)
    const { warrantId } = req.params as { warrantId: string }
    try {
      const warrant = await ctx.lawService.executeWarrant(warrantId)
      return reply.send(warrant)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/law/warrants/:warrantId/expire', {
    preHandler: requireCapability(ctx, 'warrant.issue'),
  }, async (req, reply) => {
    if (!ctx.lawService) return reply.code(503).send(NOT_CONFIGURED)
    const { warrantId } = req.params as { warrantId: string }
    try {
      const warrant = await ctx.lawService.expireWarrant(warrantId)
      return reply.send(warrant)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/law/warrants/:warrantId/revoke', {
    preHandler: requireCapability(ctx, 'warrant.issue'),
  }, async (req, reply) => {
    if (!ctx.lawService) return reply.code(503).send(NOT_CONFIGURED)
    const { warrantId } = req.params as { warrantId: string }
    const result = revokeWarrantSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const warrant = await ctx.lawService.revokeWarrant(warrantId, result.data.reason)
      return reply.send(warrant)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  // ── Citations ─────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/law/citations', {
    preHandler: requireCapability(ctx, 'law.read'),
  }, async (req, reply) => {
    if (!ctx.lawCitationRepo) return reply.code(503).send(NOT_CONFIGURED)
    const result = listCitationsQuerySchema.safeParse(req.query)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const page = await ctx.lawCitationRepo.list(result.data)
      return reply.send(page)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.get('/api/v1/law/citations/:citationId', {
    preHandler: requireCapability(ctx, 'law.read'),
  }, async (req, reply) => {
    if (!ctx.lawCitationRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { citationId } = req.params as { citationId: string }
    try {
      const citation = await ctx.lawCitationRepo.findById(citationId)
      if (!citation) return reply.code(404).send({ error: 'CitationNotFound', message: `Citation not found: ${citationId}` })
      return reply.send(citation)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/law/citations', {
    preHandler: requireCapability(ctx, 'citation.issue'),
  }, async (req, reply) => {
    if (!ctx.lawService) return reply.code(503).send(NOT_CONFIGURED)
    const result = issueCitationSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const citation = await ctx.lawService.issueCitation(result.data)
      return reply.code(201).send(citation)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/law/citations/:citationId/pay', {
    preHandler: requireCapability(ctx, 'citation.issue'),
  }, async (req, reply) => {
    if (!ctx.lawService) return reply.code(503).send(NOT_CONFIGURED)
    const { citationId } = req.params as { citationId: string }
    const result = payCitationSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const citation = await ctx.lawService.payCitation({
        citationId,
        fromAccountId: result.data.fromAccountId,
        toAccountId:   result.data.toAccountId,
      })
      return reply.send(citation)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  // ── Arrests ───────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/law/arrests', {
    preHandler: requireCapability(ctx, 'law.read'),
  }, async (req, reply) => {
    if (!ctx.lawArrestRepo) return reply.code(503).send(NOT_CONFIGURED)
    const result = listArrestsQuerySchema.safeParse(req.query)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const page = await ctx.lawArrestRepo.list(result.data)
      return reply.send(page)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.get('/api/v1/law/arrests/:arrestId', {
    preHandler: requireCapability(ctx, 'law.read'),
  }, async (req, reply) => {
    if (!ctx.lawArrestRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { arrestId } = req.params as { arrestId: string }
    try {
      const arrest = await ctx.lawArrestRepo.findById(arrestId)
      if (!arrest) return reply.code(404).send({ error: 'ArrestNotFound', message: `Arrest not found: ${arrestId}` })
      return reply.send(arrest)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/law/arrests', {
    preHandler: requireCapability(ctx, 'arrest.execute'),
  }, async (req, reply) => {
    if (!ctx.lawService) return reply.code(503).send(NOT_CONFIGURED)
    const result = recordArrestSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const d = result.data
      const arrest = await ctx.lawService.recordArrest({
        characterId:           d.characterId,
        arrestedByPrincipalId: d.arrestedByPrincipalId,
        agencyId:              d.agencyId,
        reason:                d.reason,
        severity:              d.severity,
        ...(d.warrantId !== undefined && { warrantId: d.warrantId }),
        ...(d.notes !== undefined && { notes: d.notes }),
      })
      return reply.code(201).send(arrest)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  // ── Jail ──────────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/law/jail/character/:characterId', {
    preHandler: requireCapability(ctx, 'law.read'),
  }, async (req, reply) => {
    if (!ctx.lawJailRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { characterId } = req.params as { characterId: string }
    try {
      const record = await ctx.lawJailRepo.findActiveForCharacter(characterId)
      return reply.send(record ?? null)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/law/jail', {
    preHandler: requireCapability(ctx, 'jail.manage'),
  }, async (req, reply) => {
    if (!ctx.lawService) return reply.code(503).send(NOT_CONFIGURED)
    const result = enterJailSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const d = result.data
      const record = await ctx.lawService.enterJail({
        characterId:    d.characterId,
        arrestRecordId: d.arrestRecordId,
        releaseAt:      d.releaseAt ? new Date(d.releaseAt) : undefined,
      })
      return reply.code(201).send(record)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/law/jail/:jailRecordId/release', {
    preHandler: requireCapability(ctx, 'jail.manage'),
  }, async (req, reply) => {
    if (!ctx.lawService) return reply.code(503).send(NOT_CONFIGURED)
    const { jailRecordId } = req.params as { jailRecordId: string }
    const result = releaseJailSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const record = await ctx.lawService.releaseFromJail(jailRecordId, result.data.releasedByPrincipalId)
      return reply.send(record)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  // ── Evidence ──────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/law/evidence', {
    preHandler: requireCapability(ctx, 'evidence.manage'),
  }, async (req, reply) => {
    if (!ctx.lawEvidenceRepo) return reply.code(503).send(NOT_CONFIGURED)
    const result = listEvidenceQuerySchema.safeParse(req.query)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const page = await ctx.lawEvidenceRepo.list(result.data)
      return reply.send(page)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.get('/api/v1/law/evidence/:evidenceId', {
    preHandler: requireCapability(ctx, 'evidence.manage'),
  }, async (req, reply) => {
    if (!ctx.lawEvidenceRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { evidenceId } = req.params as { evidenceId: string }
    try {
      const record = await ctx.lawEvidenceRepo.findById(evidenceId)
      if (!record) return reply.code(404).send({ error: 'EvidenceNotFound', message: `Evidence not found: ${evidenceId}` })
      return reply.send(record)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/law/evidence', {
    preHandler: requireCapability(ctx, 'evidence.manage'),
  }, async (req, reply) => {
    if (!ctx.lawService) return reply.code(503).send(NOT_CONFIGURED)
    const result = collectEvidenceSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const d = result.data
      const record = await ctx.lawService.collectEvidence({
        collectedByPrincipalId: d.collectedByPrincipalId,
        label:                  d.label,
        content:                d.content,
        ...(d.caseId !== undefined && { caseId: d.caseId }),
        ...(d.metadata !== undefined && { metadata: d.metadata }),
      })
      return reply.code(201).send(record)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/law/evidence/:evidenceId/transfer-custody', {
    preHandler: requireCapability(ctx, 'evidence.manage'),
  }, async (req, reply) => {
    if (!ctx.lawService) return reply.code(503).send(NOT_CONFIGURED)
    const { evidenceId } = req.params as { evidenceId: string }
    const result = transferCustodySchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const d = result.data
      const record = await ctx.lawService.transferEvidenceCustody(
        evidenceId,
        d.toPrincipalId,
        d.notes ?? null,
      )
      return reply.send(record)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  // ── Legal Cases ───────────────────────────────────────────────────────────────

  fastify.get('/api/v1/law/cases', {
    preHandler: requireCapability(ctx, 'law.read'),
  }, async (req, reply) => {
    if (!ctx.lawCaseRepo) return reply.code(503).send(NOT_CONFIGURED)
    const result = listLegalCasesQuerySchema.safeParse(req.query)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const page = await ctx.lawCaseRepo.list(result.data)
      return reply.send(page)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.get('/api/v1/law/cases/:caseId', {
    preHandler: requireCapability(ctx, 'law.read'),
  }, async (req, reply) => {
    if (!ctx.lawCaseRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { caseId } = req.params as { caseId: string }
    try {
      const legalCase = await ctx.lawCaseRepo.findById(caseId)
      if (!legalCase) return reply.code(404).send({ error: 'LegalCaseNotFound', message: `Legal case not found: ${caseId}` })
      return reply.send(legalCase)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/law/cases', {
    preHandler: requireCapability(ctx, 'law.write'),
  }, async (req, reply) => {
    if (!ctx.lawService) return reply.code(503).send(NOT_CONFIGURED)
    const result = createLegalCaseSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const legalCase = await ctx.lawService.createCase(result.data)
      return reply.code(201).send(legalCase)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/law/cases/:caseId/close', {
    preHandler: requireCapability(ctx, 'law.write'),
  }, async (req, reply) => {
    if (!ctx.lawService) return reply.code(503).send(NOT_CONFIGURED)
    const { caseId } = req.params as { caseId: string }
    try {
      const legalCase = await ctx.lawService.closeCase(caseId)
      return reply.send(legalCase)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/law/cases/:caseId/archive', {
    preHandler: requireCapability(ctx, 'law.write'),
  }, async (req, reply) => {
    if (!ctx.lawService) return reply.code(503).send(NOT_CONFIGURED)
    const { caseId } = req.params as { caseId: string }
    try {
      const legalCase = await ctx.lawService.archiveCase(caseId)
      return reply.send(legalCase)
    } catch (err) {
      if (err instanceof LawError) { const r = lawErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })
}
