import type {
  AtcJob, AtcJobPage, JobType, JobStatus,
  AtcJobGrade,
  AtcProfession,
  AtcEmploymentContract, AtcEmploymentContractPage, EmploymentStatus,
  AtcWorkSession, AtcWorkSessionPage,
  AtcPayrollRun, AtcPayrollRunEntry,
} from '@atc/shared-types'
import type { JobRepository, CreateJobParams, UpdateJobParams, ListJobsParams } from './job.repository.js'
import type { JobGradeRepository, CreateJobGradeParams } from './job-grade.repository.js'
import type { ProfessionRepository, UpsertProfessionParams } from './profession.repository.js'
import type {
  EmploymentContractRepository,
  CreateContractParams,
  ListContractsParams,
} from './employment.repository.js'
import type { WorkSessionRepository, ClockInParams, ListWorkSessionsParams } from './work-session.repository.js'
import type { PayrollService, PreviewPayrollParams, CommitPayrollParams, PayrollResult } from './payroll.service.js'

export class AtcJobsSDK {
  constructor(
    private readonly jobs: JobRepository,
    private readonly grades: JobGradeRepository,
    private readonly professions: ProfessionRepository,
    private readonly contracts: EmploymentContractRepository,
    private readonly workSessions: WorkSessionRepository,
    private readonly payroll: PayrollService,
  ) {}

  // ── Jobs ────────────────────────────────────────────────────────────────────

  listJobs(params?: ListJobsParams): Promise<AtcJobPage> {
    return this.jobs.list(params)
  }

  createJob(params: CreateJobParams): Promise<AtcJob> {
    return this.jobs.create(params)
  }

  updateJob(id: string, params: UpdateJobParams): Promise<AtcJob> {
    return this.jobs.update(id, params)
  }

  getJob(id: string): Promise<AtcJob | null> {
    return this.jobs.findById(id)
  }

  getJobBySlug(slug: string): Promise<AtcJob | null> {
    return this.jobs.findBySlug(slug)
  }

  // ── Grades ──────────────────────────────────────────────────────────────────

  listGrades(jobId: string): Promise<AtcJobGrade[]> {
    return this.grades.listByJob(jobId)
  }

  createGrade(params: CreateJobGradeParams): Promise<AtcJobGrade> {
    return this.grades.create(params)
  }

  getGrade(id: string): Promise<AtcJobGrade | null> {
    return this.grades.findById(id)
  }

  // ── Professions ─────────────────────────────────────────────────────────────

  upsertProfession(params: UpsertProfessionParams): Promise<AtcProfession> {
    return this.professions.upsert(params)
  }

  listProfessions(characterId: string): Promise<AtcProfession[]> {
    return this.professions.listByCharacter(characterId)
  }

  // ── Contracts ───────────────────────────────────────────────────────────────

  createContract(params: CreateContractParams): Promise<AtcEmploymentContract> {
    return this.contracts.create(params)
  }

  terminateContract(contractId: string, reason?: string): Promise<AtcEmploymentContract> {
    return this.contracts.terminate(contractId, reason)
  }

  getContract(id: string): Promise<AtcEmploymentContract | null> {
    return this.contracts.findById(id)
  }

  listContracts(params?: ListContractsParams): Promise<AtcEmploymentContractPage> {
    return this.contracts.list(params)
  }

  // ── Work sessions ───────────────────────────────────────────────────────────

  clockIn(params: ClockInParams): Promise<AtcWorkSession> {
    return this.workSessions.clockIn(params)
  }

  clockOut(characterId: string): Promise<AtcWorkSession> {
    return this.workSessions.clockOut({ characterId })
  }

  getActiveSession(characterId: string): Promise<AtcWorkSession | null> {
    return this.workSessions.findActiveSession(characterId)
  }

  listWorkSessions(params?: ListWorkSessionsParams): Promise<AtcWorkSessionPage> {
    return this.workSessions.list(params)
  }

  // ── Payroll ─────────────────────────────────────────────────────────────────

  previewPayroll(params: PreviewPayrollParams): Promise<PayrollResult> {
    return this.payroll.previewPayroll(params)
  }

  commitPayroll(params: CommitPayrollParams): Promise<PayrollResult> {
    return this.payroll.commitPayroll(params)
  }
}
