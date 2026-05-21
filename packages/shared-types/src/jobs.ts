// ── Job domain ────────────────────────────────────────────────────────────────

export type JobType = 'civilian' | 'organization' | 'government' | 'freelance' | 'system'
export type JobStatus = 'active' | 'disabled' | 'archived'

export interface AtcJob {
  id: string
  slug: string
  name: string
  type: JobType
  status: JobStatus
  organizationId: string | null
  salaryAccountId: string | null
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

export interface AtcJobPage {
  items: AtcJob[]
  total: number
  offset: number
  limit: number
}

// ── Job grades ────────────────────────────────────────────────────────────────

export interface AtcJobGrade {
  id: string
  jobId: string
  slug: string
  name: string
  level: number
  salaryAmount: number
  salaryCurrency: string
  permissions: string[]
  createdAt: Date
  updatedAt: Date
}

// ── Professions ───────────────────────────────────────────────────────────────

export interface AtcProfession {
  id: string
  characterId: string
  jobId: string
  gradeId: string
  level: number
  experiencePoints: number
  createdAt: Date
  updatedAt: Date
}

// ── Employment contracts ──────────────────────────────────────────────────────

export type EmploymentStatus = 'active' | 'suspended' | 'terminated' | 'expired'

export interface AtcEmploymentContract {
  id: string
  characterId: string
  organizationId: string | null
  jobId: string
  gradeId: string
  status: EmploymentStatus
  salaryAmount: number
  salaryCurrency: string
  startedAt: Date
  endsAt: Date | null
  terminatedAt: Date | null
  terminationReason: string | null
  createdByPrincipalId: string
  createdAt: Date
  updatedAt: Date
}

export interface AtcEmploymentContractPage {
  items: AtcEmploymentContract[]
  total: number
  offset: number
  limit: number
}

// ── Work sessions ─────────────────────────────────────────────────────────────

export type WorkSessionStatus = 'active' | 'completed' | 'abandoned'

export interface AtcWorkSession {
  id: string
  contractId: string
  characterId: string
  jobId: string
  clockedInAt: Date
  clockedOutAt: Date | null
  durationSeconds: number | null
  locationMetadata: Record<string, unknown> | null
  verifiedBy: string | null
  status: WorkSessionStatus
  createdAt: Date
  updatedAt: Date
}

export interface AtcWorkSessionPage {
  items: AtcWorkSession[]
  total: number
  offset: number
  limit: number
}

// ── Payroll ───────────────────────────────────────────────────────────────────

export type PayrollStatus = 'preview' | 'pending' | 'completed' | 'failed'

export interface AtcPayrollRun {
  id: string
  organizationId: string
  periodStart: Date
  periodEnd: Date
  status: PayrollStatus
  totalAmount: number
  currency: string
  employeeCount: number
  ledgerJournalId: string | null
  idempotencyKey: string
  failureReason: string | null
  createdByPrincipalId: string
  createdAt: Date
  updatedAt: Date
}

export interface AtcPayrollRunEntry {
  id: string
  payrollRunId: string
  contractId: string
  characterId: string
  gradeId: string
  hoursWorked: number
  salaryAmount: number
  currency: string
  createdAt: Date
}

// ── Job permissions ───────────────────────────────────────────────────────────

export interface AtcJobPermission {
  key: string
  description: string
}

// ── Events ───────────────────────────────────────────────────────────────────

export const ATC_JOB_EVENTS = {
  JOB_CREATED:             'atc:job:created',
  CONTRACT_CREATED:        'atc:employment:contract_created',
  CONTRACT_TERMINATED:     'atc:employment:contract_terminated',
  CLOCKED_IN:              'atc:work:clocked_in',
  CLOCKED_OUT:             'atc:work:clocked_out',
  PAYROLL_COMPLETED:       'atc:payroll:completed',
  PAYROLL_FAILED:          'atc:payroll:failed',
} as const

export type AtcJobEventName = typeof ATC_JOB_EVENTS[keyof typeof ATC_JOB_EVENTS]
