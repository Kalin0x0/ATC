import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  recordInjurySchema,
  listInjuriesQuerySchema,
  updateTraumaSchema,
  revivePatientSchema,
  applyTreatmentSchema,
  createMedicalReportSchema,
  closeMedicalReportSchema,
  listMedicalReportsQuerySchema,
  admitToHospitalSchema,
  updateHospitalStatusSchema,
} from '@atc/operations'
import {
  MedicalError,
  MedicalValidationError,
  InjuryNotFoundError,
  TraumaNotFoundError,
  TraumaImmutableError,
  PatientDeceasedError,
  PatientAlreadyAliveError,
  MedicalReportNotFoundError,
  MedicalReportClosedError,
  HospitalRecordNotFoundError,
  HospitalAlreadyAdmittedError,
  HospitalImmutableError,
} from '@atc/medical'

function medicalErrorToResponse(err: MedicalError): { status: number; error: string; message: string } {
  if (err instanceof MedicalValidationError)     return { status: 400, error: 'MedicalValidation',     message: err.message }
  if (err instanceof TraumaImmutableError)       return { status: 422, error: 'TraumaImmutable',       message: err.message }
  if (err instanceof MedicalReportClosedError)   return { status: 422, error: 'MedicalReportClosed',   message: err.message }
  if (err instanceof HospitalImmutableError)     return { status: 422, error: 'HospitalImmutable',     message: err.message }
  if (err instanceof PatientDeceasedError)       return { status: 422, error: 'PatientDeceased',       message: err.message }
  if (err instanceof PatientAlreadyAliveError)   return { status: 422, error: 'PatientAlreadyAlive',   message: err.message }
  if (err instanceof HospitalAlreadyAdmittedError) return { status: 409, error: 'HospitalAlreadyAdmitted', message: err.message }
  if (err instanceof InjuryNotFoundError)        return { status: 404, error: 'InjuryNotFound',        message: err.message }
  if (err instanceof TraumaNotFoundError)        return { status: 404, error: 'TraumaNotFound',        message: err.message }
  if (err instanceof MedicalReportNotFoundError) return { status: 404, error: 'MedicalReportNotFound', message: err.message }
  if (err instanceof HospitalRecordNotFoundError) return { status: 404, error: 'HospitalRecordNotFound', message: err.message }
  return { status: 500, error: 'MedicalError', message: err.message }
}

const NOT_CONFIGURED = { error: 'Medical system not configured' }

export async function medicalRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Injuries ────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/medical/injuries', {
    preHandler: requireCapability(ctx, 'medical.write'),
  }, async (req, reply) => {
    if (!ctx.medicalService) return reply.code(503).send(NOT_CONFIGURED)
    const result = recordInjurySchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const injury = await ctx.medicalService.recordInjury(result.data)
      return reply.code(201).send(injury)
    } catch (err) {
      if (err instanceof MedicalError) { const r = medicalErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.get('/api/v1/medical/injuries', {
    preHandler: requireCapability(ctx, 'medical.read'),
  }, async (req, reply) => {
    if (!ctx.injuryRepo) return reply.code(503).send(NOT_CONFIGURED)
    const result = listInjuriesQuerySchema.safeParse(req.query)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    const page = await ctx.injuryRepo.list(result.data)
    return reply.send(page)
  })

  fastify.get('/api/v1/medical/injuries/:id', {
    preHandler: requireCapability(ctx, 'medical.read'),
  }, async (req, reply) => {
    if (!ctx.injuryRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { id } = req.params as { id: string }
    const injury = await ctx.injuryRepo.findById(id)
    if (!injury) return reply.code(404).send({ error: 'InjuryNotFound', message: `Injury record not found: ${id}` })
    return reply.send(injury)
  })

  // ── Trauma ──────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/medical/trauma/:characterId', {
    preHandler: requireCapability(ctx, 'medical.read'),
  }, async (req, reply) => {
    if (!ctx.traumaRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { characterId } = req.params as { characterId: string }
    const trauma = await ctx.traumaRepo.findByCharacter(characterId)
    if (!trauma) return reply.code(404).send({ error: 'TraumaNotFound', message: `No trauma record for character: ${characterId}` })
    return reply.send(trauma)
  })

  fastify.patch('/api/v1/medical/trauma/:characterId', {
    preHandler: requireCapability(ctx, 'medical.write'),
  }, async (req, reply) => {
    if (!ctx.medicalService) return reply.code(503).send(NOT_CONFIGURED)
    const { characterId } = req.params as { characterId: string }
    const result = updateTraumaSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const trauma = await ctx.medicalService.updateTrauma(
        characterId,
        result.data.newState,
        result.data.updatedByPrincipalId,
        result.data.notes,
      )
      return reply.send(trauma)
    } catch (err) {
      if (err instanceof MedicalError) { const r = medicalErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  // ── Revive (requires ems.revive) ─────────────────────────────────────────────

  fastify.post('/api/v1/medical/revive/:characterId', {
    preHandler: requireCapability(ctx, 'ems.revive'),
  }, async (req, reply) => {
    if (!ctx.medicalService) return reply.code(503).send(NOT_CONFIGURED)
    const { characterId } = req.params as { characterId: string }
    const result = revivePatientSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const trauma = await ctx.medicalService.revive({
        characterId,
        revivedByPrincipalId: result.data.revivedByPrincipalId,
        incidentId: result.data.incidentId ?? null,
        notes: result.data.notes ?? null,
      })
      return reply.send(trauma)
    } catch (err) {
      if (err instanceof MedicalError) { const r = medicalErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  // ── Treatments ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/medical/treatments', {
    preHandler: requireCapability(ctx, 'medical.write'),
  }, async (req, reply) => {
    if (!ctx.medicalService) return reply.code(503).send(NOT_CONFIGURED)
    const result = applyTreatmentSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const treatment = await ctx.medicalService.applyTreatment(result.data)
      return reply.code(201).send(treatment)
    } catch (err) {
      if (err instanceof MedicalError) { const r = medicalErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.get('/api/v1/medical/treatments/character/:characterId', {
    preHandler: requireCapability(ctx, 'medical.read'),
  }, async (req, reply) => {
    if (!ctx.treatmentRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { characterId } = req.params as { characterId: string }
    const treatments = await ctx.treatmentRepo.listByCharacter(characterId)
    return reply.send(treatments)
  })

  // ── Medical Reports ──────────────────────────────────────────────────────────

  fastify.post('/api/v1/medical/reports', {
    preHandler: requireCapability(ctx, 'medical.write'),
  }, async (req, reply) => {
    if (!ctx.medicalService) return reply.code(503).send(NOT_CONFIGURED)
    const result = createMedicalReportSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const report = await ctx.medicalService.createMedicalReport(result.data)
      return reply.code(201).send(report)
    } catch (err) {
      if (err instanceof MedicalError) { const r = medicalErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.get('/api/v1/medical/reports', {
    preHandler: requireCapability(ctx, 'medical.read'),
  }, async (req, reply) => {
    if (!ctx.reportRepo) return reply.code(503).send(NOT_CONFIGURED)
    const result = listMedicalReportsQuerySchema.safeParse(req.query)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    const page = await ctx.reportRepo.list(result.data)
    return reply.send(page)
  })

  fastify.get('/api/v1/medical/reports/:id', {
    preHandler: requireCapability(ctx, 'medical.read'),
  }, async (req, reply) => {
    if (!ctx.reportRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { id } = req.params as { id: string }
    const report = await ctx.reportRepo.findById(id)
    if (!report) return reply.code(404).send({ error: 'MedicalReportNotFound', message: `Medical report not found: ${id}` })
    return reply.send(report)
  })

  fastify.post('/api/v1/medical/reports/:id/close', {
    preHandler: requireCapability(ctx, 'medical.write'),
  }, async (req, reply) => {
    if (!ctx.medicalService) return reply.code(503).send(NOT_CONFIGURED)
    const { id } = req.params as { id: string }
    const result = closeMedicalReportSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const report = await ctx.medicalService.closeMedicalReport(id, result.data.closedByPrincipalId)
      return reply.send(report)
    } catch (err) {
      if (err instanceof MedicalError) { const r = medicalErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  // ── Hospital ─────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/medical/hospital/admit', {
    preHandler: requireCapability(ctx, 'hospital.manage'),
  }, async (req, reply) => {
    if (!ctx.medicalService) return reply.code(503).send(NOT_CONFIGURED)
    const result = admitToHospitalSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const record = await ctx.medicalService.admitToHospital(result.data)
      return reply.code(201).send(record)
    } catch (err) {
      if (err instanceof MedicalError) { const r = medicalErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.get('/api/v1/medical/hospital/character/:characterId', {
    preHandler: requireCapability(ctx, 'medical.read'),
  }, async (req, reply) => {
    if (!ctx.hospitalRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { characterId } = req.params as { characterId: string }
    const record = await ctx.hospitalRepo.findActiveForCharacter(characterId)
    if (!record) return reply.code(404).send({ error: 'HospitalRecordNotFound', message: `No active hospital record for character: ${characterId}` })
    return reply.send(record)
  })

  fastify.patch('/api/v1/medical/hospital/:id/status', {
    preHandler: requireCapability(ctx, 'hospital.manage'),
  }, async (req, reply) => {
    if (!ctx.medicalService) return reply.code(503).send(NOT_CONFIGURED)
    const { id } = req.params as { id: string }
    const result = updateHospitalStatusSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const record = await ctx.medicalService.updateHospitalStatus({ id, ...result.data })
      return reply.send(record)
    } catch (err) {
      if (err instanceof MedicalError) { const r = medicalErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })
}
