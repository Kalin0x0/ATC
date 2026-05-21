import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  createJobSchema,
  updateJobSchema,
  createJobGradeSchema,
  listJobsQuerySchema,
  createContractSchema,
  terminateContractSchema,
  listContractsQuerySchema,
  clockInSchema,
  clockOutSchema,
  listWorkSessionsQuerySchema,
  previewPayrollSchema,
  commitPayrollSchema,
} from '@atc/operations'
import {
  JobsError,
  JobsValidationError,
  JobNotFoundError,
  JobSlugConflictError,
  JobGradeNotFoundError,
  JobGradeSlugConflictError,
  ContractNotFoundError,
  ContractAlreadyActiveError,
  ContractNotActiveError,
  ContractImmutableError,
  WorkSessionNotFoundError,
  AlreadyClockedInError,
  NotClockedInError,
  PayrollRunNotFoundError,
  PayrollAlreadyCommittedError,
} from '@atc/jobs'

function jobsErrorToResponse(err: JobsError): { status: number; error: string; message: string } {
  if (err instanceof JobsValidationError)        return { status: 400, error: 'JobsValidation',       message: err.message }
  if (err instanceof JobSlugConflictError)       return { status: 409, error: 'JobSlugConflict',      message: err.message }
  if (err instanceof JobGradeSlugConflictError)  return { status: 409, error: 'GradeSlugConflict',    message: err.message }
  if (err instanceof ContractAlreadyActiveError) return { status: 409, error: 'ContractAlreadyActive', message: err.message }
  if (err instanceof AlreadyClockedInError)      return { status: 409, error: 'AlreadyClockedIn',     message: err.message }
  if (err instanceof JobNotFoundError)           return { status: 404, error: 'JobNotFound',          message: err.message }
  if (err instanceof JobGradeNotFoundError)      return { status: 404, error: 'GradeNotFound',        message: err.message }
  if (err instanceof ContractNotFoundError)      return { status: 404, error: 'ContractNotFound',     message: err.message }
  if (err instanceof WorkSessionNotFoundError)   return { status: 404, error: 'SessionNotFound',      message: err.message }
  if (err instanceof PayrollRunNotFoundError)    return { status: 404, error: 'PayrollRunNotFound',   message: err.message }
  if (err instanceof NotClockedInError)          return { status: 422, error: 'NotClockedIn',         message: err.message }
  if (err instanceof ContractNotActiveError)     return { status: 422, error: 'ContractNotActive',    message: err.message }
  if (err instanceof ContractImmutableError)     return { status: 422, error: 'ContractImmutable',    message: err.message }
  if (err instanceof PayrollAlreadyCommittedError) return { status: 422, error: 'PayrollAlreadyCommitted', message: err.message }
  return { status: 500, error: 'JobsError', message: err.message }
}

const NOT_CONFIGURED = { error: 'Jobs system not configured' }

export async function jobsRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
) {
  const { ctx } = opts

  // ── Jobs ────────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/jobs', {
    preHandler: requireCapability(ctx, 'jobs.read'),
  }, async (req, reply) => {
    if (!ctx.jobRepo) return reply.code(503).send(NOT_CONFIGURED)
    const result = listJobsQuerySchema.safeParse(req.query)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const page = await ctx.jobRepo.list(result.data)
      return reply.send(page)
    } catch (err) {
      if (err instanceof JobsError) { const r = jobsErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/jobs', {
    preHandler: requireCapability(ctx, 'jobs.write'),
  }, async (req, reply) => {
    if (!ctx.jobRepo) return reply.code(503).send(NOT_CONFIGURED)
    const result = createJobSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const job = await ctx.jobRepo.create(result.data)
      return reply.code(201).send(job)
    } catch (err) {
      if (err instanceof JobsError) { const r = jobsErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.patch('/api/v1/jobs/:jobId', {
    preHandler: requireCapability(ctx, 'jobs.write'),
  }, async (req, reply) => {
    if (!ctx.jobRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { jobId } = req.params as { jobId: string }
    const result = updateJobSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const job = await ctx.jobRepo.update(jobId, result.data)
      return reply.send(job)
    } catch (err) {
      if (err instanceof JobsError) { const r = jobsErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  // ── Job grades ──────────────────────────────────────────────────────────────

  fastify.get('/api/v1/jobs/:jobId/grades', {
    preHandler: requireCapability(ctx, 'jobs.read'),
  }, async (req, reply) => {
    if (!ctx.jobGradeRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { jobId } = req.params as { jobId: string }
    try {
      const grades = await ctx.jobGradeRepo.listByJob(jobId)
      return reply.send(grades)
    } catch (err) {
      if (err instanceof JobsError) { const r = jobsErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/jobs/:jobId/grades', {
    preHandler: requireCapability(ctx, 'jobs.write'),
  }, async (req, reply) => {
    if (!ctx.jobGradeRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { jobId } = req.params as { jobId: string }
    const result = createJobGradeSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const d = result.data
      const grade = await ctx.jobGradeRepo.create({
        jobId,
        slug: d.slug,
        name: d.name,
        level: d.level,
        salaryAmount: d.salaryAmount,
        salaryCurrency: d.salaryCurrency,
        ...(d.permissions !== undefined && { permissions: d.permissions }),
      })
      return reply.code(201).send(grade)
    } catch (err) {
      if (err instanceof JobsError) { const r = jobsErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  // ── Employment contracts ────────────────────────────────────────────────────

  fastify.get('/api/v1/employment/character/:characterId', {
    preHandler: requireCapability(ctx, 'jobs.read'),
  }, async (req, reply) => {
    if (!ctx.employmentRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { characterId } = req.params as { characterId: string }
    const result = listContractsQuerySchema.safeParse({ ...req.query as object, characterId })
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const d = result.data
      const page = await ctx.employmentRepo.list({
        characterId,
        ...(d.organizationId !== undefined && { organizationId: d.organizationId }),
        ...(d.jobId !== undefined && { jobId: d.jobId }),
        ...(d.status !== undefined && { status: d.status }),
        ...(d.limit !== undefined && { limit: d.limit }),
        ...(d.offset !== undefined && { offset: d.offset }),
      })
      return reply.send(page)
    } catch (err) {
      if (err instanceof JobsError) { const r = jobsErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/employment/contracts', {
    preHandler: requireCapability(ctx, 'jobs.assign'),
  }, async (req, reply) => {
    if (!ctx.employmentRepo) return reply.code(503).send(NOT_CONFIGURED)
    const result = createContractSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const data = result.data
      const contract = await ctx.employmentRepo.create({
        characterId: data.characterId,
        organizationId: data.organizationId ?? null,
        jobId: data.jobId,
        gradeId: data.gradeId,
        salaryAmount: data.salaryAmount,
        salaryCurrency: data.salaryCurrency,
        ...(data.startedAt ? { startedAt: new Date(data.startedAt) } : {}),
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        createdByPrincipalId: data.createdByPrincipalId,
      })
      return reply.code(201).send(contract)
    } catch (err) {
      if (err instanceof JobsError) { const r = jobsErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.patch('/api/v1/employment/contracts/:contractId/terminate', {
    preHandler: requireCapability(ctx, 'jobs.manage'),
  }, async (req, reply) => {
    if (!ctx.employmentRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { contractId } = req.params as { contractId: string }
    const result = terminateContractSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const contract = await ctx.employmentRepo.terminate(contractId, result.data.reason)
      return reply.send(contract)
    } catch (err) {
      if (err instanceof JobsError) { const r = jobsErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  // ── Work sessions ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/work-sessions/clock-in', {
    preHandler: requireCapability(ctx, 'jobs.write'),
  }, async (req, reply) => {
    if (!ctx.workSessionRepo) return reply.code(503).send(NOT_CONFIGURED)
    const result = clockInSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const d = result.data
      const session = await ctx.workSessionRepo.clockIn({
        contractId: d.contractId,
        characterId: d.characterId,
        jobId: d.jobId,
        locationMetadata: d.locationMetadata ?? null,
      })
      return reply.code(201).send(session)
    } catch (err) {
      if (err instanceof JobsError) { const r = jobsErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/work-sessions/clock-out', {
    preHandler: requireCapability(ctx, 'jobs.write'),
  }, async (req, reply) => {
    if (!ctx.workSessionRepo) return reply.code(503).send(NOT_CONFIGURED)
    const result = clockOutSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const d = result.data
      const session = await ctx.workSessionRepo.clockOut({
        characterId: d.characterId,
        locationMetadata: d.locationMetadata ?? null,
      })
      return reply.send(session)
    } catch (err) {
      if (err instanceof JobsError) { const r = jobsErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.get('/api/v1/work-sessions/character/:characterId', {
    preHandler: requireCapability(ctx, 'jobs.read'),
  }, async (req, reply) => {
    if (!ctx.workSessionRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { characterId } = req.params as { characterId: string }
    const result = listWorkSessionsQuerySchema.safeParse(req.query)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const d = result.data
      const page = await ctx.workSessionRepo.list({
        characterId,
        ...(d.contractId !== undefined && { contractId: d.contractId }),
        ...(d.jobId !== undefined && { jobId: d.jobId }),
        ...(d.status !== undefined && { status: d.status }),
        ...(d.limit !== undefined && { limit: d.limit }),
        ...(d.offset !== undefined && { offset: d.offset }),
      })
      return reply.send(page)
    } catch (err) {
      if (err instanceof JobsError) { const r = jobsErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  // ── Payroll ─────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/payroll/preview', {
    preHandler: requireCapability(ctx, 'payroll.run'),
  }, async (req, reply) => {
    if (!ctx.payrollService) return reply.code(503).send(NOT_CONFIGURED)
    const result = previewPayrollSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const data = result.data
      const payroll = await ctx.payrollService.previewPayroll({
        ...data,
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
      })
      return reply.code(201).send(payroll)
    } catch (err) {
      if (err instanceof JobsError) { const r = jobsErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/payroll/commit', {
    preHandler: requireCapability(ctx, 'payroll.run'),
  }, async (req, reply) => {
    if (!ctx.payrollService) return reply.code(503).send(NOT_CONFIGURED)
    const result = commitPayrollSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const payroll = await ctx.payrollService.commitPayroll(result.data)
      return reply.send(payroll)
    } catch (err) {
      if (err instanceof JobsError) { const r = jobsErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.get('/api/v1/payroll/runs/:runId', {
    preHandler: requireCapability(ctx, 'payroll.run'),
  }, async (req, reply) => {
    if (!ctx.payrollRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { runId } = req.params as { runId: string }
    try {
      const run = await ctx.payrollRepo.findById(runId)
      if (!run) return reply.code(404).send({ error: 'PayrollRunNotFound', message: `Payroll run not found: ${runId}` })
      return reply.send(run)
    } catch (err) {
      if (err instanceof JobsError) { const r = jobsErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })
}
