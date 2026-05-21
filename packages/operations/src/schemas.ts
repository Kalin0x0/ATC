import { z } from 'zod'

export const subsystemHealthSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'failed']),
  latencyMs: z.number().nonnegative(),
  lastCheckedAt: z.string(),
  message: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const healthSnapshotSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'failed']),
  subsystems: z.record(subsystemHealthSchema),
  checkedAt: z.string(),
})

export const diagnosticsQuerySchema = z.object({
  include: z.string().optional(), // comma-separated subsystem names
})

export const dlqQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export const requeueTaskSchema = z.object({
  taskId: z.string().uuid('taskId must be a valid UUID'),
})

export const opsEventQuerySchema = z.object({
  eventName: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
})

export const runtimeNodeStatusSchema = z.object({
  instanceId: z.string(),
  hostname: z.string(),
  pid: z.number().int(),
  startedAt: z.string(),
  capabilities: z.array(z.string()),
  version: z.string(),
  isStale: z.boolean(),
  lastHeartbeatAt: z.string().nullable(),
})

export const clusterSnapshotSchema = z.object({
  capturedAt: z.string(),
  leader: z.string().nullable(),
  nodes: z.array(runtimeNodeStatusSchema),
  totalNodes: z.number().int(),
  staleNodes: z.number().int(),
  totalWorkers: z.number().int(),
  activeWorkers: z.number().int(),
  schedulerRunning: z.boolean(),
})

export type DlqQuery = z.infer<typeof dlqQuerySchema>
export type RequeueTask = z.infer<typeof requeueTaskSchema>
export type OpsEventQuery = z.infer<typeof opsEventQuerySchema>
export type ClusterSnapshot = z.infer<typeof clusterSnapshotSchema>

// ── Phase 18 — Plugin Runtime Isolation ──────────────────────────────────────

export const pluginRuntimeStatusSchema = z.enum([
  'registered',
  'loading',
  'active',
  'disabled',
  'failed',
  'unloading',
  'restarting',
  'stopped',
])

export const pluginResourceUsageSchema = z.object({
  activeTimers: z.number().int().nonnegative(),
  activeIntervals: z.number().int().nonnegative(),
  activeSubscriptions: z.number().int().nonnegative(),
  activeWorkers: z.number().int().nonnegative(),
  estimatedMemoryBytes: z.number().int().nonnegative(),
})

export const pluginHealthSnapshotSchema = z.object({
  pluginId: z.string(),
  state: pluginRuntimeStatusSchema,
  healthy: z.boolean(),
  uptimeMs: z.number().nonnegative(),
  restartCount: z.number().int().nonnegative(),
  crashCount: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  lastCrashAt: z.string().nullable(),
  resourceUsage: pluginResourceUsageSchema,
  capturedAt: z.string(),
})

export const pluginLifecycleActionSchema = z.object({
  pluginId: z.string().min(1),
})

export type PluginRuntimeStatus = z.infer<typeof pluginRuntimeStatusSchema>
export type PluginResourceUsage = z.infer<typeof pluginResourceUsageSchema>
export type PluginHealthSnapshot = z.infer<typeof pluginHealthSnapshotSchema>
export type PluginLifecycleAction = z.infer<typeof pluginLifecycleActionSchema>

// ── Phase 19 — IAM Security Platform ─────────────────────────────────────────

export const principalTypeSchema = z.enum(['account', 'service', 'plugin', 'system'])

// Shared limits — keep symmetric across both schemas
const PRINCIPAL_ID_SCHEMA = z.string().min(1).max(128)
const PERMISSION_SCHEMA   = z.string().min(1).max(256)
const CAPABILITY_SCHEMA   = z.string().min(1).max(128)
const STRING_LIST_SCHEMA  = z.array(z.string().max(256)).max(50).default([])

export const authorizeRequestSchema = z.object({
  principalId:   PRINCIPAL_ID_SCHEMA,
  principalType: principalTypeSchema,
  roles:         STRING_LIST_SCHEMA,
  permissions:   STRING_LIST_SCHEMA,
  capabilities:  STRING_LIST_SCHEMA,
  denies:        STRING_LIST_SCHEMA,
  permission:    PERMISSION_SCHEMA,
})

export const capabilityCheckRequestSchema = z.object({
  principalId:   PRINCIPAL_ID_SCHEMA,
  principalType: principalTypeSchema,
  roles:         STRING_LIST_SCHEMA,
  capabilities:  STRING_LIST_SCHEMA,
  permissions:   STRING_LIST_SCHEMA,
  denies:        STRING_LIST_SCHEMA,
  capability:    CAPABILITY_SCHEMA,
  trustLevel:    z.enum(['internal', 'trusted', 'untrusted', 'restricted']).optional(),
})

export const auditQuerySchema = z.object({
  limit:   z.coerce.number().int().min(1).max(200).default(50),
  offset:  z.coerce.number().int().min(0).default(0),
  actorId: z.string().max(128).optional(),
  action:  z.string().max(256).optional(),
  result:  z.enum(['granted', 'denied', 'error']).optional(),
})

export type AuthorizeRequest = z.infer<typeof authorizeRequestSchema>
export type CapabilityCheckRequest = z.infer<typeof capabilityCheckRequestSchema>
export type AuditQuery = z.infer<typeof auditQuerySchema>

// ── Phase 20 — Principal Management API ──────────────────────────────────────

export const listPrincipalsQuerySchema = z.object({
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  offset:    z.coerce.number().int().min(0).default(0),
  type:      principalTypeSchema.optional(),
  status:    z.enum(['active', 'disabled', 'suspended']).optional(),
  accountId: z.string().max(128).optional(),
})

export const createPrincipalSchema = z.object({
  type:        principalTypeSchema,
  displayName: z.string().min(1).max(256),
  accountId:   z.string().min(1).max(128).optional(),
  trustLevel:  z.enum(['internal', 'trusted', 'untrusted', 'restricted']).optional(),
  metadata:    z.record(z.string().max(512)).optional(),
})

export const updatePrincipalSchema = z.object({
  displayName: z.string().min(1).max(256).optional(),
  trustLevel:  z.enum(['internal', 'trusted', 'untrusted', 'restricted']).nullable().optional(),
  metadata:    z.record(z.string().max(512)).nullable().optional(),
})

export const assignRoleSchema = z.object({
  roleId:     z.string().min(1).max(64),
  assignedBy: z.string().min(1).max(128),
  expiresAt:  z.string().datetime().optional(),
})

export const grantCapabilitySchema = z.object({
  capability: z.string().min(1).max(128),
  grantedBy:  z.string().min(1).max(128),
  expiresAt:  z.string().datetime().optional(),
})

export type ListPrincipalsQuery = z.infer<typeof listPrincipalsQuerySchema>
export type CreatePrincipalRequest = z.infer<typeof createPrincipalSchema>
export type UpdatePrincipalRequest = z.infer<typeof updatePrincipalSchema>
export type AssignRoleRequest = z.infer<typeof assignRoleSchema>
export type GrantCapabilityRequest = z.infer<typeof grantCapabilitySchema>

// ── Phase 21 — Economy Core ───────────────────────────────────────────────────

const ACCOUNT_ID_SCHEMA   = z.string().min(1).max(128)
const CURRENCY_SCHEMA     = z.string().min(1).max(16).default('USD')
const AMOUNT_SCHEMA       = z.number().positive().finite()
const IDEMPOTENCY_SCHEMA  = z.string().min(1).max(256)

export const createFinancialAccountSchema = z.object({
  ownerType:   z.enum(['character', 'organization', 'system']),
  ownerId:     z.string().min(1).max(128),
  accountType: z.enum(['cash', 'bank', 'treasury', 'escrow', 'system']),
  currency:    CURRENCY_SCHEMA,
  metadata:    z.record(z.string().max(512)).optional(),
})

export const updateFinancialAccountSchema = z.object({
  status: z.enum(['active', 'frozen', 'closed']),
})

export const transferSchema = z.object({
  fromAccountId:  ACCOUNT_ID_SCHEMA,
  toAccountId:    ACCOUNT_ID_SCHEMA,
  amount:         AMOUNT_SCHEMA,
  currency:       CURRENCY_SCHEMA,
  idempotencyKey: IDEMPOTENCY_SCHEMA,
  description:    z.string().min(1).max(512).optional(),
  source:         z.enum(['system', 'admin', 'api', 'gameplay']).optional(),
  referenceId:    z.string().max(128).optional(),
  referenceType:  z.string().max(64).optional(),
}).refine(
  (data) => data.fromAccountId !== data.toAccountId,
  { message: 'fromAccountId and toAccountId must be different', path: ['toAccountId'] },
)

export const journalEntrySchema = z.object({
  accountId: ACCOUNT_ID_SCHEMA,
  entryType: z.enum(['debit', 'credit']),
  amount:    AMOUNT_SCHEMA,
  currency:  CURRENCY_SCHEMA,
})

export const commitJournalSchema = z.object({
  idempotencyKey: IDEMPOTENCY_SCHEMA,
  description:    z.string().min(1).max(512),
  source:         z.enum(['system', 'admin', 'api', 'gameplay']),
  entries:        z.array(journalEntrySchema).min(2).max(50),
  referenceId:    z.string().max(128).optional(),
  referenceType:  z.string().max(64).optional(),
})

export const reverseJournalSchema = z.object({
  idempotencyKey: IDEMPOTENCY_SCHEMA,
})

export const createOrganizationSchema = z.object({
  name:               z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/, 'Name must be lowercase alphanumeric with hyphens/underscores'),
  displayName:        z.string().min(1).max(256),
  type:               z.enum(['business', 'faction', 'government', 'charity']),
  ownerId:            z.string().min(1).max(128),
  treasuryAccountId:  z.string().min(1).max(128).optional(),
  metadata:           z.record(z.string().max(512)).optional(),
})

export const addMemberSchema = z.object({
  characterId: z.string().min(1).max(128),
  role:        z.enum(['owner', 'director', 'accountant', 'employee', 'auditor']),
  expiresAt:   z.string().datetime().optional(),
})

export const issueInvoiceSchema = z.object({
  issuerId:      z.string().min(1).max(128),
  issuerType:    z.enum(['character', 'organization']),
  recipientId:   z.string().min(1).max(128),
  recipientType: z.enum(['character', 'organization']),
  amount:        AMOUNT_SCHEMA,
  currency:      CURRENCY_SCHEMA,
  description:   z.string().min(1).max(512),
  dueAt:         z.string().datetime().optional(),
  metadata:      z.record(z.unknown()).optional(),
})

export const payInvoiceSchema = z.object({
  fromAccountId: ACCOUNT_ID_SCHEMA,
  toAccountId:   ACCOUNT_ID_SCHEMA,
})

export const listJournalsQuerySchema = z.object({
  status:        z.enum(['pending', 'committed', 'reversed']).optional(),
  referenceType: z.string().max(64).optional(),
  referenceId:   z.string().max(128).optional(),
  limit:         z.coerce.number().int().min(1).max(100).default(20),
  offset:        z.coerce.number().int().min(0).default(0),
})

export const listAccountsQuerySchema = z.object({
  ownerType:   z.enum(['character', 'organization', 'system']).optional(),
  ownerId:     z.string().max(128).optional(),
  accountType: z.enum(['cash', 'bank', 'treasury', 'escrow', 'system']).optional(),
  status:      z.enum(['active', 'frozen', 'closed']).optional(),
  limit:       z.coerce.number().int().min(1).max(100).default(20),
  offset:      z.coerce.number().int().min(0).default(0),
})

export const listInvoicesQuerySchema = z.object({
  issuerId:      z.string().max(128).optional(),
  issuerType:    z.enum(['character', 'organization']).optional(),
  recipientId:   z.string().max(128).optional(),
  recipientType: z.enum(['character', 'organization']).optional(),
  status:        z.enum(['draft', 'issued', 'paid', 'cancelled', 'overdue']).optional(),
  limit:         z.coerce.number().int().min(1).max(100).default(20),
  offset:        z.coerce.number().int().min(0).default(0),
})

export type CreateFinancialAccountRequest = z.infer<typeof createFinancialAccountSchema>
export type UpdateFinancialAccountRequest = z.infer<typeof updateFinancialAccountSchema>
export type TransferRequest = z.infer<typeof transferSchema>
export type CommitJournalRequest = z.infer<typeof commitJournalSchema>
export type ReverseJournalRequest = z.infer<typeof reverseJournalSchema>
export type CreateOrganizationRequest = z.infer<typeof createOrganizationSchema>
export type AddMemberRequest = z.infer<typeof addMemberSchema>
export type IssueInvoiceRequest = z.infer<typeof issueInvoiceSchema>
export type PayInvoiceRequest = z.infer<typeof payInvoiceSchema>
export type ListJournalsQuery = z.infer<typeof listJournalsQuerySchema>
export type ListAccountsQuery = z.infer<typeof listAccountsQuerySchema>
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>

// ── Phase 22 — Commerce ───────────────────────────────────────────────────────

const SHOP_ID_SCHEMA    = z.string().min(1).max(128)
const ITEM_ID_SCHEMA    = z.string().min(1).max(128)
const CHARACTER_SCHEMA  = z.string().min(1).max(128)
const CURRENCY_22_SCHEMA = z.string().min(1).max(16)

export const createShopSchema = z.object({
  name:             z.string().min(1).max(256),
  type:             z.enum(['npc', 'player', 'organization', 'vending', 'admin']),
  currency:         CURRENCY_22_SCHEMA,
  ownerOrgId:       z.string().min(1).max(128).optional(),
  sellerAccountId:  z.string().min(1).max(128).optional(),
  buyerAccountId:   z.string().min(1).max(128).optional(),
  metadata:         z.record(z.unknown()).optional(),
})

export const updateShopStatusSchema = z.object({
  status: z.enum(['active', 'disabled', 'maintenance']),
})

export const upsertShopItemSchema = z.object({
  itemId:    ITEM_ID_SCHEMA,
  stock:     z.number().int().min(-1).optional(),
  price:     z.number().positive().finite(),
  sellPrice: z.number().nonnegative().finite().nullable().optional(),
  currency:  CURRENCY_22_SCHEMA,
  minLevel:  z.number().int().nonnegative().nullable().optional(),
  metadata:  z.record(z.unknown()).nullable().optional(),
})

export const purchaseSchema = z.object({
  idempotencyKey: IDEMPOTENCY_SCHEMA,
  characterId:    CHARACTER_SCHEMA,
  shopId:         SHOP_ID_SCHEMA,
  itemId:         ITEM_ID_SCHEMA,
  quantity:       z.number().int().positive().max(999),
  currency:       CURRENCY_22_SCHEMA,
  buyerAccountId: z.string().min(1).max(128),
})

export const sellSchema = z.object({
  idempotencyKey:  IDEMPOTENCY_SCHEMA,
  characterId:     CHARACTER_SCHEMA,
  shopId:          SHOP_ID_SCHEMA,
  itemId:          ITEM_ID_SCHEMA,
  quantity:        z.number().int().positive().max(999),
  currency:        CURRENCY_22_SCHEMA,
  sellerAccountId: z.string().min(1).max(128),
})

export const listOrdersQuerySchema = z.object({
  characterId: CHARACTER_SCHEMA.optional(),
  shopId:      SHOP_ID_SCHEMA.optional(),
  status:      z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
  orderType:   z.enum(['purchase', 'sell']).optional(),
  limit:       z.coerce.number().int().min(1).max(100).default(20),
  offset:      z.coerce.number().int().min(0).default(0),
})

export const listReceiptsQuerySchema = z.object({
  characterId: CHARACTER_SCHEMA.optional(),
  shopId:      SHOP_ID_SCHEMA.optional(),
  limit:       z.coerce.number().int().min(1).max(100).default(20),
  offset:      z.coerce.number().int().min(0).default(0),
})

export const createTaxRuleSchema = z.object({
  name:              z.string().min(1).max(256),
  category:          z.enum(['tax', 'fee']),
  type:              z.enum(['percentage', 'flat']),
  rate:              z.number().positive().finite(),
  currency:          CURRENCY_22_SCHEMA.optional(),
  appliesToShopType: z.enum(['npc', 'player', 'organization', 'vending', 'admin']).optional(),
  targetAccountId:   z.string().min(1).max(128),
})

export const listShopsQuerySchema = z.object({
  type:       z.enum(['npc', 'player', 'organization', 'vending', 'admin']).optional(),
  status:     z.enum(['active', 'disabled', 'maintenance']).optional(),
  ownerOrgId: z.string().max(128).optional(),
  limit:      z.coerce.number().int().positive().max(100).optional(),
  offset:     z.coerce.number().int().min(0).optional(),
})

export type CreateShopRequest = z.infer<typeof createShopSchema>
export type UpdateShopStatusRequest = z.infer<typeof updateShopStatusSchema>
export type UpsertShopItemRequest = z.infer<typeof upsertShopItemSchema>
export type PurchaseRequest = z.infer<typeof purchaseSchema>
export type SellRequest = z.infer<typeof sellSchema>
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>
export type ListReceiptsQuery = z.infer<typeof listReceiptsQuerySchema>
export type CreateTaxRuleRequest = z.infer<typeof createTaxRuleSchema>
export type ListShopsQuery = z.infer<typeof listShopsQuerySchema>

// ── Phase 23 — Jobs, Professions & Work Contracts ─────────────────────────────

const JOB_TYPE_SCHEMA   = z.enum(['civilian', 'organization', 'government', 'freelance', 'system'])
const JOB_STATUS_SCHEMA = z.enum(['active', 'disabled', 'archived'])
const EMP_STATUS_SCHEMA = z.enum(['active', 'suspended', 'terminated', 'expired'])
const SALARY_SCHEMA     = z.number().nonnegative().finite().max(1_000_000_000)
const CURRENCY_JOB_SCHEMA = z.string().min(1).max(16)
const SLUG_SCHEMA       = z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/, 'Slug must be lowercase alphanumeric, hyphens, or underscores')
const IDEMPOTENCY_JOB   = z.string().min(1).max(256)

export const createJobSchema = z.object({
  slug:            SLUG_SCHEMA,
  name:            z.string().min(1).max(256),
  type:            JOB_TYPE_SCHEMA,
  organizationId:  z.string().min(1).max(128).optional(),
  salaryAccountId: z.string().min(1).max(128).optional(),
  metadata:        z.record(z.unknown()).optional(),
})

export const updateJobSchema = z.object({
  name:            z.string().min(1).max(256).optional(),
  status:          JOB_STATUS_SCHEMA.optional(),
  salaryAccountId: z.string().min(1).max(128).nullable().optional(),
  metadata:        z.record(z.unknown()).nullable().optional(),
})

export const createJobGradeSchema = z.object({
  slug:           SLUG_SCHEMA,
  name:           z.string().min(1).max(256),
  level:          z.number().int().min(0).max(9999),
  salaryAmount:   SALARY_SCHEMA,
  salaryCurrency: CURRENCY_JOB_SCHEMA,
  permissions:    z.array(z.string().max(128)).optional(),
})

export const listJobsQuerySchema = z.object({
  type:           JOB_TYPE_SCHEMA.optional(),
  status:         JOB_STATUS_SCHEMA.optional(),
  organizationId: z.string().max(128).optional(),
  limit:          z.coerce.number().int().positive().max(100).optional(),
  offset:         z.coerce.number().int().min(0).optional(),
})

export const createContractSchema = z.object({
  characterId:         z.string().min(1).max(128),
  organizationId:      z.string().min(1).max(128).optional(),
  jobId:               z.string().min(1).max(128),
  gradeId:             z.string().min(1).max(128),
  salaryAmount:        SALARY_SCHEMA,
  salaryCurrency:      CURRENCY_JOB_SCHEMA,
  startedAt:           z.string().datetime().optional(),
  endsAt:              z.string().datetime().nullable().optional(),
  createdByPrincipalId: z.string().min(1).max(128),
})

export const terminateContractSchema = z.object({
  reason: z.string().max(1024).optional(),
})

export const listContractsQuerySchema = z.object({
  characterId:    z.string().max(128).optional(),
  organizationId: z.string().max(128).optional(),
  jobId:          z.string().max(128).optional(),
  status:         EMP_STATUS_SCHEMA.optional(),
  limit:          z.coerce.number().int().positive().max(100).optional(),
  offset:         z.coerce.number().int().min(0).optional(),
})

export const clockInSchema = z.object({
  contractId:       z.string().min(1).max(128),
  characterId:      z.string().min(1).max(128),
  jobId:            z.string().min(1).max(128),
  locationMetadata: z.record(z.unknown()).optional(),
})

export const clockOutSchema = z.object({
  characterId:      z.string().min(1).max(128),
  locationMetadata: z.record(z.unknown()).optional(),
})

export const listWorkSessionsQuerySchema = z.object({
  contractId:  z.string().max(128).optional(),
  jobId:       z.string().max(128).optional(),
  status:      z.enum(['active', 'completed', 'abandoned']).optional(),
  limit:       z.coerce.number().int().positive().max(100).optional(),
  offset:      z.coerce.number().int().min(0).optional(),
})

export const previewPayrollSchema = z.object({
  organizationId:      z.string().min(1).max(128),
  periodStart:         z.string().datetime(),
  periodEnd:           z.string().datetime(),
  currency:            CURRENCY_JOB_SCHEMA,
  idempotencyKey:      IDEMPOTENCY_JOB,
  createdByPrincipalId: z.string().min(1).max(128),
})

export const commitPayrollSchema = z.object({
  runId:            z.string().min(1).max(128),
  orgAccountId:     z.string().min(1).max(128),
  payrollAccountId: z.string().min(1).max(128),
})

export type CreateJobRequest = z.infer<typeof createJobSchema>
export type UpdateJobRequest = z.infer<typeof updateJobSchema>
export type CreateJobGradeRequest = z.infer<typeof createJobGradeSchema>
export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>
export type CreateContractRequest = z.infer<typeof createContractSchema>
export type TerminateContractRequest = z.infer<typeof terminateContractSchema>
export type ListContractsQuery = z.infer<typeof listContractsQuerySchema>
export type ClockInRequest = z.infer<typeof clockInSchema>
export type ClockOutRequest = z.infer<typeof clockOutSchema>
export type ListWorkSessionsQuery = z.infer<typeof listWorkSessionsQuerySchema>
export type PreviewPayrollRequest = z.infer<typeof previewPayrollSchema>
export type CommitPayrollRequest = z.infer<typeof commitPayrollSchema>

// ── Phase 24 — Government, Law & Enforcement ──────────────────────────────────

const LAW_SEVERITY_SCHEMA  = z.enum(['infraction', 'misdemeanor', 'felony'])
const LAW_IDEMPOTENCY      = z.string().min(1).max(256)
const PRINCIPAL_ID_24      = z.string().min(1).max(128)
const CHARACTER_ID_24      = z.string().min(1).max(128)
const AGENCY_ID_24         = z.string().min(1).max(128)
const WARRANT_ID_24        = z.string().min(1).max(128)
const AMOUNT_24            = z.number().positive().finite()
const CURRENCY_24          = z.string().min(1).max(16).default('USD')

export const createAgencySchema = z.object({
  slug:           z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/, 'Slug must be lowercase alphanumeric, hyphens, or underscores'),
  name:           z.string().min(1).max(256),
  type:           z.enum(['police', 'ems', 'government', 'court', 'corrections']),
  organizationId: z.string().min(1).max(128).optional(),
  description:    z.string().min(1).max(1024).optional(),
})

export const listAgenciesQuerySchema = z.object({
  type:   z.enum(['police', 'ems', 'government', 'court', 'corrections']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  limit:  z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

export const issueWarrantSchema = z.object({
  characterId:         CHARACTER_ID_24,
  issuedByPrincipalId: PRINCIPAL_ID_24,
  agencyId:            AGENCY_ID_24,
  severity:            LAW_SEVERITY_SCHEMA,
  reason:              z.string().min(1).max(2048),
  expiresAt:           z.string().datetime().optional(),
})

export const revokeWarrantSchema = z.object({
  reason: z.string().min(1).max(1024),
})

export const listWarrantsQuerySchema = z.object({
  characterId: CHARACTER_ID_24.optional(),
  agencyId:    AGENCY_ID_24.optional(),
  status:      z.enum(['active', 'executed', 'expired', 'revoked']).optional(),
  severity:    LAW_SEVERITY_SCHEMA.optional(),
  limit:       z.coerce.number().int().positive().max(100).optional(),
  offset:      z.coerce.number().int().min(0).optional(),
})

export const issueCitationSchema = z.object({
  characterId:         CHARACTER_ID_24,
  issuedByPrincipalId: PRINCIPAL_ID_24,
  agencyId:            AGENCY_ID_24,
  reason:              z.string().min(1).max(2048),
  amount:              AMOUNT_24,
  currency:            CURRENCY_24,
  idempotencyKey:      LAW_IDEMPOTENCY,
})

export const payCitationSchema = z.object({
  fromAccountId: z.string().min(1).max(128),
  toAccountId:   z.string().min(1).max(128),
})

export const listCitationsQuerySchema = z.object({
  characterId: CHARACTER_ID_24.optional(),
  agencyId:    AGENCY_ID_24.optional(),
  status:      z.enum(['unpaid', 'paid', 'voided', 'disputed']).optional(),
  limit:       z.coerce.number().int().positive().max(100).optional(),
  offset:      z.coerce.number().int().min(0).optional(),
})

export const recordArrestSchema = z.object({
  characterId:            CHARACTER_ID_24,
  arrestedByPrincipalId:  PRINCIPAL_ID_24,
  agencyId:               AGENCY_ID_24,
  warrantId:              WARRANT_ID_24.optional(),
  reason:                 z.string().min(1).max(2048),
  severity:               LAW_SEVERITY_SCHEMA,
  notes:                  z.string().max(4096).optional(),
})

export const listArrestsQuerySchema = z.object({
  characterId: CHARACTER_ID_24.optional(),
  agencyId:    AGENCY_ID_24.optional(),
  limit:       z.coerce.number().int().positive().max(100).optional(),
  offset:      z.coerce.number().int().min(0).optional(),
})

export const enterJailSchema = z.object({
  characterId:     CHARACTER_ID_24,
  arrestRecordId:  z.string().min(1).max(128),
  releaseAt:       z.string().datetime().optional(),
})

export const releaseJailSchema = z.object({
  releasedByPrincipalId: PRINCIPAL_ID_24,
})

export const collectEvidenceSchema = z.object({
  caseId:                 z.string().min(1).max(128).optional(),
  collectedByPrincipalId: PRINCIPAL_ID_24,
  label:                  z.string().min(1).max(512),
  content:                z.string().min(1),
  metadata:               z.record(z.unknown()).optional(),
})

export const transferCustodySchema = z.object({
  toPrincipalId: PRINCIPAL_ID_24,
  notes:         z.string().max(1024).optional(),
})

export const listEvidenceQuerySchema = z.object({
  caseId: z.string().max(128).optional(),
  limit:  z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

export const createLegalCaseSchema = z.object({
  title:                 z.string().min(1).max(512),
  agencyId:              AGENCY_ID_24,
  createdByPrincipalId:  PRINCIPAL_ID_24,
  notes:                 z.string().max(4096).optional(),
})

export const listLegalCasesQuerySchema = z.object({
  agencyId: AGENCY_ID_24.optional(),
  status:   z.enum(['open', 'closed', 'archived']).optional(),
  limit:    z.coerce.number().int().positive().max(100).optional(),
  offset:   z.coerce.number().int().min(0).optional(),
})

export type CreateAgencyRequest        = z.infer<typeof createAgencySchema>
export type ListAgenciesQuery          = z.infer<typeof listAgenciesQuerySchema>
export type IssueWarrantRequest        = z.infer<typeof issueWarrantSchema>
export type RevokeWarrantRequest       = z.infer<typeof revokeWarrantSchema>
export type ListWarrantsQuery          = z.infer<typeof listWarrantsQuerySchema>
export type IssueCitationRequest       = z.infer<typeof issueCitationSchema>
export type PayCitationRequest         = z.infer<typeof payCitationSchema>
export type ListCitationsQuery         = z.infer<typeof listCitationsQuerySchema>
export type RecordArrestRequest        = z.infer<typeof recordArrestSchema>
export type ListArrestsQuery           = z.infer<typeof listArrestsQuerySchema>

// ── Phase 26: Medical / EMS / Trauma ────────────────────────────────────────

const MEDICAL_PRINCIPAL_ID  = z.string().min(1).max(128)
const BODY_REGION_SCHEMA    = z.enum(['head', 'chest', 'abdomen', 'left_arm', 'right_arm', 'left_leg', 'right_leg', 'spine'])
const MEDICAL_SEVERITY_SCHEMA = z.enum(['minor', 'moderate', 'critical', 'fatal'])
const TRAUMA_STATE_SCHEMA   = z.enum(['stable', 'bleeding', 'unconscious', 'cardiac_arrest', 'fractured', 'pain_shock', 'stabilized', 'deceased'])
const HOSPITAL_STATUS_SCHEMA = z.enum(['admitted', 'icu', 'surgery', 'discharged', 'deceased'])
const TREATMENT_TYPE_SCHEMA  = z.enum(['bandage', 'defibrillator', 'medication', 'splint', 'tourniquet', 'cpr', 'revive', 'stabilize', 'transfer', 'other'])

export const recordInjurySchema = z.object({
  characterId:            z.string().min(1).max(128),
  agencyId:               z.string().min(1).max(128).optional(),
  incidentId:             z.string().min(1).max(128).optional(),
  recordedByPrincipalId:  MEDICAL_PRINCIPAL_ID,
  region:                 BODY_REGION_SCHEMA,
  severity:               MEDICAL_SEVERITY_SCHEMA,
  description:            z.string().min(1).max(2048),
  metadata:               z.record(z.unknown()).optional(),
})

export const listInjuriesQuerySchema = z.object({
  characterId: z.string().max(128).optional(),
  incidentId:  z.string().max(128).optional(),
  severity:    MEDICAL_SEVERITY_SCHEMA.optional(),
  limit:       z.coerce.number().int().positive().max(100).optional(),
  offset:      z.coerce.number().int().min(0).optional(),
})

export const updateTraumaSchema = z.object({
  newState:              TRAUMA_STATE_SCHEMA,
  updatedByPrincipalId:  MEDICAL_PRINCIPAL_ID,
  notes:                 z.string().max(2048).optional(),
})

export const revivePatientSchema = z.object({
  revivedByPrincipalId: MEDICAL_PRINCIPAL_ID,
  incidentId:           z.string().min(1).max(128).optional(),
  notes:                z.string().max(2048).optional(),
})

export const applyTreatmentSchema = z.object({
  characterId:           z.string().min(1).max(128),
  appliedByPrincipalId:  MEDICAL_PRINCIPAL_ID,
  incidentId:            z.string().min(1).max(128).optional(),
  type:                  TREATMENT_TYPE_SCHEMA,
  itemId:                z.string().min(1).max(128).optional(),
  notes:                 z.string().max(2048).optional(),
  previousTrauma:        TRAUMA_STATE_SCHEMA.optional(),
  resultingTrauma:       TRAUMA_STATE_SCHEMA.optional(),
  metadata:              z.record(z.unknown()).optional(),
})

export const createMedicalReportSchema = z.object({
  characterId:           z.string().min(1).max(128),
  createdByPrincipalId:  MEDICAL_PRINCIPAL_ID,
  incidentId:            z.string().min(1).max(128).optional(),
  arrestId:              z.string().min(1).max(128).optional(),
  diagnosis:             z.string().min(1).max(4096),
  notes:                 z.string().max(4096).optional(),
  injuryIds:             z.array(z.string().min(1).max(128)).optional(),
  treatmentIds:          z.array(z.string().min(1).max(128)).optional(),
  vitalsSnapshot:        z.record(z.unknown()).optional(),
})

export const closeMedicalReportSchema = z.object({
  closedByPrincipalId: MEDICAL_PRINCIPAL_ID,
})

export const listMedicalReportsQuerySchema = z.object({
  characterId: z.string().max(128).optional(),
  incidentId:  z.string().max(128).optional(),
  openOnly:    z.coerce.boolean().optional(),
  limit:       z.coerce.number().int().positive().max(100).optional(),
  offset:      z.coerce.number().int().min(0).optional(),
})

export const admitToHospitalSchema = z.object({
  characterId:           z.string().min(1).max(128),
  admittedByPrincipalId: MEDICAL_PRINCIPAL_ID,
  facilityId:            z.string().min(1).max(128).optional(),
  incidentId:            z.string().min(1).max(128).optional(),
  notes:                 z.string().max(2048).optional(),
})

export const updateHospitalStatusSchema = z.object({
  newStatus:              HOSPITAL_STATUS_SCHEMA,
  updatedByPrincipalId:   MEDICAL_PRINCIPAL_ID,
  notes:                  z.string().max(2048).optional(),
})

export type RecordInjuryRequest         = z.infer<typeof recordInjurySchema>
export type ListInjuriesQuery           = z.infer<typeof listInjuriesQuerySchema>
export type UpdateTraumaRequest         = z.infer<typeof updateTraumaSchema>
export type RevivePatientRequest        = z.infer<typeof revivePatientSchema>
export type ApplyTreatmentRequest       = z.infer<typeof applyTreatmentSchema>
export type CreateMedicalReportRequest  = z.infer<typeof createMedicalReportSchema>
export type CloseMedicalReportRequest   = z.infer<typeof closeMedicalReportSchema>
export type ListMedicalReportsQuery     = z.infer<typeof listMedicalReportsQuerySchema>
export type AdmitToHospitalRequest      = z.infer<typeof admitToHospitalSchema>
export type UpdateHospitalStatusRequest = z.infer<typeof updateHospitalStatusSchema>
export type EnterJailRequest           = z.infer<typeof enterJailSchema>
export type ReleaseJailRequest         = z.infer<typeof releaseJailSchema>
export type CollectEvidenceRequest     = z.infer<typeof collectEvidenceSchema>
export type TransferCustodyRequest     = z.infer<typeof transferCustodySchema>
export type ListEvidenceQuery          = z.infer<typeof listEvidenceQuerySchema>
export type CreateLegalCaseRequest     = z.infer<typeof createLegalCaseSchema>
export type ListLegalCasesQuery        = z.infer<typeof listLegalCasesQuerySchema>

// ── Phase 25 — Dispatch, Incidents & MDT ─────────────────────────────────────

const DISPATCH_PRIORITY_SCHEMA  = z.enum(['low', 'medium', 'high', 'critical'])
const DISPATCH_SOURCE_SCHEMA    = z.enum(['civilian', 'officer', 'automated', 'api'])
const INCIDENT_STATUS_SCHEMA    = z.enum(['open', 'active', 'resolved', 'archived'])
const BOLO_STATUS_SCHEMA        = z.enum(['active', 'expired', 'archived'])
const RESPONDER_STATUS_SCHEMA   = z.enum(['assigned', 'enroute', 'on_scene', 'unavailable', 'cleared'])
const DISPATCH_IDEMPOTENCY      = z.string().min(1).max(256)
const PRINCIPAL_ID_25           = z.string().min(1).max(128)
const AGENCY_ID_25              = z.string().min(1).max(128)

export const createDispatchCallSchema = z.object({
  source:           DISPATCH_SOURCE_SCHEMA,
  callerIdentifier: z.string().max(255).optional(),
  location:         z.string().min(1).max(512),
  priority:         DISPATCH_PRIORITY_SCHEMA,
  description:      z.string().min(1).max(4096),
  idempotencyKey:   DISPATCH_IDEMPOTENCY,
})

export const listDispatchCallsQuerySchema = z.object({
  source:   DISPATCH_SOURCE_SCHEMA.optional(),
  priority: DISPATCH_PRIORITY_SCHEMA.optional(),
  openOnly: z.coerce.boolean().optional(),
  limit:    z.coerce.number().int().positive().max(100).optional(),
  offset:   z.coerce.number().int().min(0).optional(),
})

export const acceptDispatchCallSchema = z.object({
  incidentId: z.string().min(1).max(128),
})

export const createIncidentSchema = z.object({
  callId:                z.string().min(1).max(128).optional(),
  agencyId:              AGENCY_ID_25,
  priority:              DISPATCH_PRIORITY_SCHEMA,
  title:                 z.string().min(1).max(512),
  location:              z.string().max(512).optional(),
  createdByPrincipalId:  PRINCIPAL_ID_25,
})

export const listIncidentsQuerySchema = z.object({
  agencyId: AGENCY_ID_25.optional(),
  status:   INCIDENT_STATUS_SCHEMA.optional(),
  priority: DISPATCH_PRIORITY_SCHEMA.optional(),
  limit:    z.coerce.number().int().positive().max(100).optional(),
  offset:   z.coerce.number().int().min(0).optional(),
})

export const addIncidentNoteSchema = z.object({
  principalId: PRINCIPAL_ID_25,
  text:        z.string().min(1).max(4096),
})

export const assignResponderSchema = z.object({
  principalId: PRINCIPAL_ID_25,
  characterId: z.string().min(1).max(128).optional(),
  agencyId:    AGENCY_ID_25,
})

export const updateResponderStatusSchema = z.object({
  status: RESPONDER_STATUS_SCHEMA,
})

export const createBoloSchema = z.object({
  agencyId:               AGENCY_ID_25,
  createdByPrincipalId:   PRINCIPAL_ID_25,
  severity:               z.enum(['infraction', 'misdemeanor', 'felony']),
  description:            z.string().min(1).max(4096),
  linkedWarrantId:        z.string().min(1).max(128).optional(),
  linkedCharacterId:      z.string().min(1).max(128).optional(),
  linkedVehicleId:        z.string().min(1).max(128).optional(),
  expiresAt:              z.string().datetime().optional(),
})

export const listBolosQuerySchema = z.object({
  agencyId:          AGENCY_ID_25.optional(),
  status:            BOLO_STATUS_SCHEMA.optional(),
  linkedCharacterId: z.string().max(128).optional(),
  limit:             z.coerce.number().int().positive().max(100).optional(),
  offset:            z.coerce.number().int().min(0).optional(),
})

export const addBoloNoteSchema = z.object({
  principalId: PRINCIPAL_ID_25,
  text:        z.string().min(1).max(4096),
})

export type CreateDispatchCallRequest    = z.infer<typeof createDispatchCallSchema>
export type ListDispatchCallsQuery       = z.infer<typeof listDispatchCallsQuerySchema>
export type AcceptDispatchCallRequest    = z.infer<typeof acceptDispatchCallSchema>
export type CreateIncidentRequest        = z.infer<typeof createIncidentSchema>
export type ListIncidentsQuery           = z.infer<typeof listIncidentsQuerySchema>
export type AddIncidentNoteRequest       = z.infer<typeof addIncidentNoteSchema>
export type AssignResponderRequest       = z.infer<typeof assignResponderSchema>
export type UpdateResponderStatusRequest = z.infer<typeof updateResponderStatusSchema>
export type CreateBoloRequest            = z.infer<typeof createBoloSchema>
export type ListBolosQuery               = z.infer<typeof listBolosQuerySchema>
export type AddBoloNoteRequest           = z.infer<typeof addBoloNoteSchema>

// ── Phase 29: EMS Runtime Operations ─────────────────────────────────────────

const EMS_TRIAGE_CATEGORY_SCHEMA  = z.enum(['red', 'yellow', 'green', 'black'])
const EMS_PRINCIPAL_ID            = z.string().min(1).max(128)

export const createEmergencySchema = z.object({
  characterId:          z.string().min(1).max(128),
  incidentId:           z.string().min(1).max(128).optional(),
  createdByPrincipalId: EMS_PRINCIPAL_ID,
  notes:                z.string().max(2048).optional(),
})

export const triageEmergencySchema = z.object({
  category:    EMS_TRIAGE_CATEGORY_SCHEMA,
  principalId: EMS_PRINCIPAL_ID,
  notes:       z.string().max(2048).optional(),
})

export const assignEmergencySchema = z.object({
  responderUnitId: z.string().min(1).max(128),
  principalId:     EMS_PRINCIPAL_ID,
})

export const stabilizeEmergencySchema = z.object({
  principalId: EMS_PRINCIPAL_ID,
  notes:       z.string().max(2048).optional(),
})

export const transportEmergencySchema = z.object({
  facilityId:  z.string().min(1).max(128),
  principalId: EMS_PRINCIPAL_ID,
})

export const closeEmergencySchema = z.object({
  principalId: EMS_PRINCIPAL_ID,
  notes:       z.string().max(2048).optional(),
})

export type CreateEmergencyRequest  = z.infer<typeof createEmergencySchema>
export type TriageEmergencyRequest  = z.infer<typeof triageEmergencySchema>
export type AssignEmergencyRequest  = z.infer<typeof assignEmergencySchema>
export type StabilizeEmergencyRequest = z.infer<typeof stabilizeEmergencySchema>
export type TransportEmergencyRequest = z.infer<typeof transportEmergencySchema>
export type CloseEmergencyRequest   = z.infer<typeof closeEmergencySchema>

// ── Vehicle Runtime Schemas ───────────────────────────────────────────────────

const VEHICLE_PRINCIPAL_ID = z.string().min(1).max(128)
const VEHICLE_STATUS_SCHEMA = z.enum(['stored', 'spawned', 'active', 'impounded', 'destroyed'])
const VEHICLE_CATEGORY_SCHEMA = z.enum(['civilian', 'police', 'ems', 'fire', 'government', 'other'])
const IMPOUND_REASON_SCHEMA = z.enum(['traffic_stop', 'abandoned', 'evidence', 'unpaid_fees', 'emergency_tow', 'other'])

export const registerVehicleSchema = z.object({
  ownerId:         z.string().min(1).max(128).nullable().optional(),
  organizationId:  z.string().min(1).max(128).nullable().optional(),
  plate:           z.string().min(1).max(16),
  vin:             z.string().min(1).max(64),
  model:           z.string().min(1).max(128),
  category:        VEHICLE_CATEGORY_SCHEMA.optional(),
  fuel:            z.number().min(0).max(100).optional(),
  bodyHealth:      z.number().min(0).max(1000).optional(),
  engineHealth:    z.number().min(0).max(1000).optional(),
  garageId:        z.string().min(1).max(128).nullable().optional(),
  colorPrimary:    z.number().int().min(0).optional(),
  colorSecondary:  z.number().int().min(0).optional(),
  modHash:         z.string().max(512).nullable().optional(),
  principalId:     VEHICLE_PRINCIPAL_ID,
})

export const spawnVehicleSchema = z.object({
  spawnedByPrincipalId: VEHICLE_PRINCIPAL_ID,
  x:                    z.number(),
  y:                    z.number(),
  z:                    z.number(),
  heading:              z.number().optional(),
  fuel:                 z.number().min(0).max(100).optional(),
  bodyHealth:           z.number().min(0).max(1000).optional(),
  engineHealth:         z.number().min(0).max(1000).optional(),
})

export const retrieveVehicleSchema = z.object({
  garageId:              z.string().min(1).max(128),
  retrievedByPrincipalId: VEHICLE_PRINCIPAL_ID,
  x:                     z.number(),
  y:                     z.number(),
  z:                     z.number(),
  heading:               z.number().optional(),
})

export const storeVehicleSchema = z.object({
  garageId:              z.string().min(1).max(128),
  storedByPrincipalId:   VEHICLE_PRINCIPAL_ID,
  fuel:                  z.number().min(0).max(100).optional(),
  bodyHealth:            z.number().min(0).max(1000).optional(),
  engineHealth:          z.number().min(0).max(1000).optional(),
  lastX:                 z.number().optional(),
  lastY:                 z.number().optional(),
  lastZ:                 z.number().optional(),
  lastHeading:           z.number().optional(),
})

export const impoundVehicleSchema = z.object({
  impoundedByPrincipalId: VEHICLE_PRINCIPAL_ID,
  reason:                 IMPOUND_REASON_SCHEMA,
  agencyId:               z.string().min(1).max(128).nullable().optional(),
  locationId:             z.string().min(1).max(128).nullable().optional(),
  evidenceHold:           z.boolean().optional(),
  fee:                    z.number().min(0).optional(),
  notes:                  z.string().max(2048).nullable().optional(),
})

export const releaseVehicleSchema = z.object({
  releasedByPrincipalId: VEHICLE_PRINCIPAL_ID,
  garageId:              z.string().min(1).max(128).nullable().optional(),
  notes:                 z.string().max(2048).nullable().optional(),
})

export const syncRuntimeSchema = z.object({
  x:             z.number(),
  y:             z.number(),
  z:             z.number(),
  heading:       z.number(),
  fuel:          z.number().min(0).max(100).optional(),
  bodyHealth:    z.number().min(0).max(1000).optional(),
  engineHealth:  z.number().min(0).max(1000).optional(),
  isLocked:      z.boolean().optional(),
  isEngineOn:    z.boolean().optional(),
  netId:         z.number().int().nullable().optional(),
  serverHandle:  z.number().int().nullable().optional(),
  mileageDelta:  z.number().min(0).optional(),
})

export const assignFleetSchema = z.object({
  vehicleId:             z.string().min(1).max(128),
  organizationId:        z.string().min(1).max(128).nullable().optional(),
  principalId:           VEHICLE_PRINCIPAL_ID.nullable().optional(),
  assignedByPrincipalId: VEHICLE_PRINCIPAL_ID,
  role:                  z.string().min(1).max(64).optional(),
  expiresInSeconds:      z.number().int().positive().optional(),
})

export const unassignFleetSchema = z.object({
  unassignedByPrincipalId: VEHICLE_PRINCIPAL_ID,
})

export const vehicleListQuerySchema = z.object({
  status: VEHICLE_STATUS_SCHEMA.optional(),
})

export type RegisterVehicleRequest  = z.infer<typeof registerVehicleSchema>
export type SpawnVehicleRequest     = z.infer<typeof spawnVehicleSchema>
export type RetrieveVehicleRequest  = z.infer<typeof retrieveVehicleSchema>
export type StoreVehicleRequest     = z.infer<typeof storeVehicleSchema>
export type ImpoundVehicleRequest   = z.infer<typeof impoundVehicleSchema>
export type ReleaseVehicleRequest   = z.infer<typeof releaseVehicleSchema>
export type SyncRuntimeRequest      = z.infer<typeof syncRuntimeSchema>
export type AssignFleetRequest      = z.infer<typeof assignFleetSchema>
export type UnassignFleetRequest    = z.infer<typeof unassignFleetSchema>

// ── Property Runtime Schemas ──────────────────────────────────────────────────

const PROPERTY_PRINCIPAL_ID   = z.string().min(1).max(128)
const PROPERTY_STATUS_SCHEMA  = z.enum(['available','owned','occupied','locked','breached','seized','abandoned'])
const PROPERTY_ACCESS_SCHEMA  = z.enum(['owner','co_owner','tenant','guest','organization','emergency_ems','emergency_law'])
const PROPERTY_STASH_SCHEMA   = z.enum(['personal','shared','evidence','medical','organization'])
const PROPERTY_ALARM_SCHEMA   = z.enum(['off','armed','triggered'])

export const registerPropertySchema = z.object({
  name:             z.string().min(1).max(255),
  address:          z.string().min(1).max(512),
  interiorType:     z.string().min(1).max(128),
  shellId:          z.string().max(128).nullable().optional(),
  ownerId:          PROPERTY_PRINCIPAL_ID.nullable().optional(),
  organizationId:   z.string().min(1).max(128).nullable().optional(),
  storageCapacity:  z.number().int().positive().optional(),
  notes:            z.string().max(2048).nullable().optional(),
  principalId:      PROPERTY_PRINCIPAL_ID,
})

export const purchasePropertySchema = z.object({
  buyerPrincipalId: PROPERTY_PRINCIPAL_ID,
  organizationId:   z.string().min(1).max(128).nullable().optional(),
})

export const enterPropertySchema = z.object({
  principalId: PROPERTY_PRINCIPAL_ID,
})

export const exitPropertySchema = z.object({
  principalId: PROPERTY_PRINCIPAL_ID,
})

export const lockPropertySchema = z.object({
  principalId: PROPERTY_PRINCIPAL_ID,
})

export const unlockPropertySchema = z.object({
  principalId: PROPERTY_PRINCIPAL_ID,
})

export const breachPropertySchema = z.object({
  breachingPrincipalId: PROPERTY_PRINCIPAL_ID,
  accessType:           z.enum(['emergency_law','emergency_ems']),
  reason:               z.string().min(1).max(512),
  agencyId:             z.string().min(1).max(128).nullable().optional(),
})

export const endBreachSchema = z.object({
  principalId:      PROPERTY_PRINCIPAL_ID,
  lockAfterBreach:  z.boolean().optional(),
})

export const seizePropertySchema = z.object({
  seizedByPrincipalId: PROPERTY_PRINCIPAL_ID,
  reason:              z.string().max(512).nullable().optional(),
})

export const grantAccessSchema = z.object({
  principalId:           PROPERTY_PRINCIPAL_ID,
  accessType:            PROPERTY_ACCESS_SCHEMA,
  grantedByPrincipalId:  PROPERTY_PRINCIPAL_ID,
  expiresInSeconds:      z.number().int().positive().optional(),
})

export const revokeAccessSchema = z.object({
  revokedByPrincipalId: PROPERTY_PRINCIPAL_ID,
})

export const issueKeySchema = z.object({
  issuedToPrincipalId:  PROPERTY_PRINCIPAL_ID,
  issuedByPrincipalId:  PROPERTY_PRINCIPAL_ID,
})

export const depositStorageSchema = z.object({
  stashId:              z.string().min(1).max(128),
  itemName:             z.string().min(1).max(128),
  quantity:             z.number().int().positive(),
  metadata:             z.unknown().optional(),
  addedByPrincipalId:   PROPERTY_PRINCIPAL_ID,
})

export const withdrawStorageSchema = z.object({
  stashId:              z.string().min(1).max(128),
  itemName:             z.string().min(1).max(128),
  quantity:             z.number().int().positive(),
  removedByPrincipalId: PROPERTY_PRINCIPAL_ID,
})

export const linkGarageSchema = z.object({
  garageId:              z.string().min(1).max(128),
  linkedByPrincipalId:   PROPERTY_PRINCIPAL_ID,
  label:                 z.string().max(255).optional(),
  capacity:              z.number().int().positive().optional(),
})

export const retrieveFromPropertySchema = z.object({
  vehicleId:             z.string().min(1).max(128),
  garageId:              z.string().min(1).max(128),
  retrievedByPrincipalId: PROPERTY_PRINCIPAL_ID,
  x:                     z.number(),
  y:                     z.number(),
  z:                     z.number(),
  heading:               z.number().optional(),
})

export type RegisterPropertyRequest      = z.infer<typeof registerPropertySchema>
export type PurchasePropertyRequest      = z.infer<typeof purchasePropertySchema>
export type EnterPropertyRequest         = z.infer<typeof enterPropertySchema>
export type ExitPropertyRequest          = z.infer<typeof exitPropertySchema>
export type LockPropertyRequest          = z.infer<typeof lockPropertySchema>
export type UnlockPropertyRequest        = z.infer<typeof unlockPropertySchema>
export type BreachPropertyRequest        = z.infer<typeof breachPropertySchema>
export type EndBreachRequest             = z.infer<typeof endBreachSchema>
export type SeizePropertyRequest         = z.infer<typeof seizePropertySchema>
export type GrantAccessRequest           = z.infer<typeof grantAccessSchema>
export type RevokeAccessRequest          = z.infer<typeof revokeAccessSchema>
export type IssueKeyRequest              = z.infer<typeof issueKeySchema>
export type DepositStorageRequest        = z.infer<typeof depositStorageSchema>
export type WithdrawStorageRequest       = z.infer<typeof withdrawStorageSchema>
export type LinkGarageRequest            = z.infer<typeof linkGarageSchema>
export type RetrieveFromPropertyRequest  = z.infer<typeof retrieveFromPropertySchema>

// ── Combat schemas ────────────────────────────────────────────────────────────

const COMBAT_PRINCIPAL_ID = z.string().min(1).max(128)
const WEAPON_CATEGORY_SCHEMA = z.enum(['pistol','rifle','shotgun','smg','sniper','melee','explosive','thrown','unarmed'])
const COMBAT_BODY_REGION_SCHEMA = z.enum(['head','chest','abdomen','left_arm','right_arm','left_leg','right_leg','back','unknown'])
const INJURY_SEVERITY_SCHEMA = z.enum(['minor','moderate','severe','critical','fatal'])

export const registerWeaponSchema = z.object({
  ownerId:                COMBAT_PRINCIPAL_ID.nullable().optional(),
  organizationId:         z.string().min(1).max(128).nullable().optional(),
  model:                  z.string().min(1).max(128),
  category:               WEAPON_CATEGORY_SCHEMA,
  serial:                 z.string().min(1).max(64),
  registeredByPrincipalId: COMBAT_PRINCIPAL_ID.nullable().optional(),
})

export const equipWeaponSchema = z.object({
  weaponId:           z.string().min(1).max(26),
  holderPrincipalId:  COMBAT_PRINCIPAL_ID,
  currentAmmo:        z.number().int().min(0).max(9999),
  maxAmmo:            z.number().int().min(0).max(9999),
  attachmentState:    z.record(z.string()).optional(),
})

export const unequipWeaponSchema = z.object({
  weaponId:           z.string().min(1).max(26),
  holderPrincipalId:  COMBAT_PRINCIPAL_ID,
})

export const syncAmmoSchema = z.object({
  weaponId:           z.string().min(1).max(26),
  holderPrincipalId:  COMBAT_PRINCIPAL_ID,
  currentAmmo:        z.number().int().min(0).max(9999),
})

export const applyDamageSchema = z.object({
  sessionId:              z.string().min(1).max(26).nullable().optional(),
  attackerPrincipalId:    COMBAT_PRINCIPAL_ID,
  victimPrincipalId:      COMBAT_PRINCIPAL_ID,
  weaponId:               z.string().min(1).max(26).nullable().optional(),
  weaponModel:            z.string().min(1).max(128),
  hitBone:                COMBAT_BODY_REGION_SCHEMA,
  damageAmount:           z.number().int().min(0).max(32767),
  mitigatedAmount:        z.number().int().min(0).max(32767),
  replayNonce:            z.string().min(1).max(64),
  hitX:                   z.number().nullable().optional(),
  hitY:                   z.number().nullable().optional(),
  hitZ:                   z.number().nullable().optional(),
  ballistics: z.object({
    velocity:       z.number().optional(),
    distance:       z.number().optional(),
    impactAngle:    z.number().optional(),
    penetrationData: z.string().max(512).optional(),
  }).optional(),
})

export const startCombatSessionSchema = z.object({
  initiatorPrincipalId: COMBAT_PRINCIPAL_ID,
})

export const endCombatSessionSchema = z.object({
  outcome: z.string().max(256).optional(),
})

export const applyInjurySchema = z.object({
  principalId:          COMBAT_PRINCIPAL_ID,
  bodyRegion:           COMBAT_BODY_REGION_SCHEMA,
  severity:             INJURY_SEVERITY_SCHEMA,
  sourceDamageEventId:  z.string().min(1).max(26).nullable().optional(),
})

export const seizeWeaponSchema = z.object({
  seizedByPrincipalId: COMBAT_PRINCIPAL_ID,
})

export type RegisterWeaponRequest    = z.infer<typeof registerWeaponSchema>
export type EquipWeaponRequest       = z.infer<typeof equipWeaponSchema>
export type UnequipWeaponRequest     = z.infer<typeof unequipWeaponSchema>
export type SyncAmmoRequest          = z.infer<typeof syncAmmoSchema>
export type ApplyDamageRequest       = z.infer<typeof applyDamageSchema>
export type StartCombatSessionRequest = z.infer<typeof startCombatSessionSchema>
export type EndCombatSessionRequest  = z.infer<typeof endCombatSessionSchema>
export type ApplyInjuryRequest       = z.infer<typeof applyInjurySchema>
export type SeizeWeaponRequest       = z.infer<typeof seizeWeaponSchema>

// ── Criminal schemas ──────────────────────────────────────────────────────────

const CRIMINAL_PRINCIPAL_ID = z.string().min(1).max(128)
const OPERATION_TYPE_SCHEMA = z.enum(['heist','drug_run','smuggling','extortion','assassination','theft','other'])
const GANG_MEMBER_RANK_SCHEMA = z.enum(['leader','officer','member','associate'])
const RAID_OUTCOME_SCHEMA = z.enum(['success','failure','partial','aborted'])

export const createGangSchema = z.object({
  name:               z.string().min(1).max(64),
  tag:                z.string().min(1).max(8),
  leaderPrincipalId:  CRIMINAL_PRINCIPAL_ID,
  territoryId:        z.string().max(128).nullable().optional(),
})

export const addGangMemberSchema = z.object({
  principalId:              CRIMINAL_PRINCIPAL_ID,
  rank:                     GANG_MEMBER_RANK_SCHEMA,
  invitedByPrincipalId:     CRIMINAL_PRINCIPAL_ID.optional(),
})

export const createOperationSchema = z.object({
  label:              z.string().min(1).max(255),
  operationType:      OPERATION_TYPE_SCHEMA,
  ownerPrincipalId:   CRIMINAL_PRINCIPAL_ID,
  gangId:             z.string().min(1).max(26).nullable().optional(),
  metadata:           z.record(z.unknown()).nullable().optional(),
})

export const operationOutcomeSchema = z.object({
  outcome: z.string().max(512).optional(),
})

export const registerContrabandSchema = z.object({
  propertyId:                 z.string().max(128).nullable().optional(),
  stashId:                    z.string().max(128).nullable().optional(),
  itemName:                   z.string().min(1).max(128),
  quantity:                   z.number().int().positive(),
  registeredByPrincipalId:    CRIMINAL_PRINCIPAL_ID,
})

export const seizeContrabandSchema = z.object({
  seizedByPrincipalId: CRIMINAL_PRINCIPAL_ID,
})

export const recordTradeSchema = z.object({
  sellerPrincipalId:  CRIMINAL_PRINCIPAL_ID,
  buyerPrincipalId:   CRIMINAL_PRINCIPAL_ID,
  itemName:           z.string().min(1).max(128),
  quantity:           z.number().int().positive(),
  price:              z.number().int().min(0),
  locationLabel:      z.string().max(255).optional(),
})

export const stageRaidSchema = z.object({
  propertyId:             z.string().min(1).max(128),
  initiatingAgencyId:     z.string().max(128).nullable().optional(),
  leadPrincipalId:        CRIMINAL_PRINCIPAL_ID,
  participants:           z.array(z.string().min(1).max(128)).min(1),
  notes:                  z.string().max(2048).optional(),
})

export const completeRaidSchema = z.object({
  outcome: RAID_OUTCOME_SCHEMA,
  notes:   z.string().max(2048).optional(),
})

export const abortRaidSchema = z.object({
  notes: z.string().max(2048).optional(),
})

export type CreateGangRequest          = z.infer<typeof createGangSchema>
export type AddGangMemberRequest       = z.infer<typeof addGangMemberSchema>
export type CreateOperationRequest     = z.infer<typeof createOperationSchema>
export type OperationOutcomeRequest    = z.infer<typeof operationOutcomeSchema>
export type RegisterContrabandRequest  = z.infer<typeof registerContrabandSchema>
export type SeizeContrabandRequest     = z.infer<typeof seizeContrabandSchema>
export type RecordTradeRequest         = z.infer<typeof recordTradeSchema>
export type StageRaidRequest           = z.infer<typeof stageRaidSchema>
export type CompleteRaidRequest        = z.infer<typeof completeRaidSchema>
export type AbortRaidRequest           = z.infer<typeof abortRaidSchema>

// ── World schemas ─────────────────────────────────────────────────────────────

const WORLD_ENTITY_TYPE_SCHEMA = z.enum(['vehicle','object','ped','pickup','blip','zone','other'])
const SCENE_TYPE_SCHEMA = z.enum(['crime_scene','accident','blockade','event','construction','other'])
const CLEANUP_REASON_SCHEMA = z.enum(['timeout','manual','server_restart','owner_disconnect','scene_destroyed'])

export const registerEntitySchema = z.object({
  entityType:           WORLD_ENTITY_TYPE_SCHEMA,
  ownerPrincipalId:     z.string().min(1).max(128).nullable().optional(),
  networkId:            z.number().int().optional(),
  model:                z.string().min(1).max(128),
  x:                    z.number(),
  y:                    z.number(),
  z:                    z.number(),
  heading:              z.number(),
  spawnNonce:           z.string().min(1).max(64),
  sceneId:              z.string().max(128).nullable().optional(),
})

export const reconcileEntitySchema = z.object({
  x:          z.number(),
  y:          z.number(),
  z:          z.number(),
  heading:    z.number(),
  networkId:  z.number().int().optional(),
})

export const createSceneSchema = z.object({
  sceneId:              z.string().min(1).max(128),
  creatorPrincipalId:   z.string().min(1).max(128),
  label:                z.string().min(1).max(255),
  replicationNode:      z.string().max(128).optional(),
})

export const persistSceneSchema = z.object({
  sceneId:          z.string().min(1).max(128),
  sceneType:        SCENE_TYPE_SCHEMA,
  worldRegion:      z.string().max(128).optional(),
  data:             z.record(z.unknown()),
  expiresInSeconds: z.number().int().positive().optional(),
})

export const scheduleCleanupSchema = z.object({
  targetType:     z.string().min(1).max(64),
  targetId:       z.string().min(1).max(128),
  cleanupReason:  CLEANUP_REASON_SCHEMA,
  nodeId:         z.string().max(128).optional(),
})

export type RegisterEntityRequest   = z.infer<typeof registerEntitySchema>
export type ReconcileEntityRequest  = z.infer<typeof reconcileEntitySchema>
export type CreateSceneRequest      = z.infer<typeof createSceneSchema>
export type PersistSceneRequest     = z.infer<typeof persistSceneSchema>
export type ScheduleCleanupRequest  = z.infer<typeof scheduleCleanupSchema>

// ─── Phase 35: Vehicle Simulation ─────────────────────────────────────────────

const FUEL_GRADE_SCHEMA = z.enum(['regular', 'premium', 'diesel', 'electric'])

export const syncFuelSchema = z.object({
  vehicleRuntimeId: z.string().min(1).max(128),
  currentFuel:      z.number().nonnegative(),
  fuelGrade:        FUEL_GRADE_SCHEMA,
  consumptionRate:  z.number().nonnegative(),
})

export const consumeFuelSchema = z.object({
  vehicleRuntimeId: z.string().min(1).max(128),
  amount:           z.number().positive(),
})

export const refuelSchema = z.object({
  vehicleRuntimeId: z.string().min(1).max(128),
  amount:           z.number().positive(),
})

export const syncDamageSchema = z.object({
  vehicleRuntimeId: z.string().min(1).max(128),
  engineHealth:     z.number().min(0).max(1000),
  bodyHealth:       z.number().min(0).max(1000),
  fuelTankHealth:   z.number().min(0).max(1000),
  panelDamage:      z.record(z.number()).optional(),
  tireState:        z.record(z.string()).optional(),
  isEngineDestroyed: z.boolean().optional(),
  isOnFire:          z.boolean().optional(),
})

export const applyVehicleDamageSchema = z.object({
  vehicleRuntimeId: z.string().min(1).max(128),
  engineDelta:      z.number().optional(),
  bodyDelta:        z.number().optional(),
  fuelTankDelta:    z.number().optional(),
})

export const registerVehicleRegistrationSchema = z.object({
  vehicleId:          z.string().min(1).max(128),
  ownerPrincipalId:   z.string().min(1).max(128),
  plate:              z.string().min(1).max(16),
  registeredAt:       z.string().datetime().optional(),
  expiresAt:          z.string().datetime(),
})

export const startPursuitSchema = z.object({
  vehicleRuntimeId:            z.string().min(1).max(128),
  suspectPrincipalId:          z.string().min(1).max(128),
  initiatingOfficerPrincipalId: z.string().min(1).max(128),
  initiatingAgencyId:          z.string().max(128).optional(),
  pursuitNonce:                z.string().min(1).max(128),
  startLocationX:              z.number().optional(),
  startLocationY:              z.number().optional(),
  startLocationZ:              z.number().optional(),
})

export const endPursuitSchema = z.object({
  pursuitId:   z.string().min(1).max(128),
  toStatus:    z.enum(['ended', 'escaped', 'terminated']),
  endLocationX: z.number().optional(),
  endLocationY: z.number().optional(),
  endLocationZ: z.number().optional(),
  notes:        z.string().max(1000).optional(),
})

export const recordViolationSchema = z.object({
  vehicleId:               z.string().min(1).max(128),
  vehicleRuntimeId:        z.string().max(128).optional(),
  principalId:             z.string().min(1).max(128),
  violationType:           z.enum(['speeding', 'reckless_driving', 'running_red_light', 'wrong_way', 'illegal_parking', 'hit_and_run', 'dui', 'other']),
  speedRecorded:           z.number().optional(),
  speedLimit:              z.number().optional(),
  locationX:               z.number().optional(),
  locationY:               z.number().optional(),
  locationZ:               z.number().optional(),
  recordedByPrincipalId:   z.string().max(128).optional(),
  fineAmount:              z.number().nonnegative(),
})

export const vehicleHeartbeatSchema = z.object({
  vehicleRuntimeId:   z.string().min(1).max(128),
  distanceDelta:      z.number().nonnegative().optional(),
  topSpeedSnapshot:   z.number().nonnegative().optional(),
  collisionIncrement: z.boolean().optional(),
})

export type SyncFuelRequest         = z.infer<typeof syncFuelSchema>
export type ConsumeFuelRequest      = z.infer<typeof consumeFuelSchema>
export type RefuelRequest           = z.infer<typeof refuelSchema>
export type SyncDamageRequest       = z.infer<typeof syncDamageSchema>
export type ApplyVehicleDamageRequest = z.infer<typeof applyVehicleDamageSchema>
export type RegisterVehicleRegistrationRequest = z.infer<typeof registerVehicleRegistrationSchema>
export type StartPursuitRequest     = z.infer<typeof startPursuitSchema>
export type EndPursuitRequest       = z.infer<typeof endPursuitSchema>
export type RecordViolationRequest  = z.infer<typeof recordViolationSchema>
export type VehicleHeartbeatRequest = z.infer<typeof vehicleHeartbeatSchema>

// ─── Phase 36: Banking & Market Runtime ───────────────────────────────────────

export const bankTransferSchema = z.object({
  fromPrincipalId:  z.string().min(1).max(128),
  toPrincipalId:    z.string().min(1).max(128),
  amount:           z.string().regex(/^\d+$/, 'must be a non-negative integer string'),
  idempotencyKey:   z.string().min(1).max(128),
  description:      z.string().max(500).optional(),
  metadata:         z.record(z.unknown()).optional(),
})

export const createListingSchema = z.object({
  sellerPrincipalId: z.string().min(1).max(128),
  itemName:          z.string().min(1).max(255),
  itemCategory:      z.string().max(128).optional(),
  quantity:          z.number().int().positive(),
  pricePerUnit:      z.string().regex(/^\d+$/),
  description:       z.string().max(1000).optional(),
  listingNonce:      z.string().min(1).max(128),
  expiresInHours:    z.number().int().positive().default(72),
})

export const purchaseListingSchema = z.object({
  listingId:          z.string().min(1).max(128),
  buyerPrincipalId:   z.string().min(1).max(128),
  idempotencyKey:     z.string().min(1).max(128),
})

export const createAuctionSchema = z.object({
  sellerPrincipalId:     z.string().min(1).max(128),
  itemName:              z.string().min(1).max(255),
  itemCategory:          z.string().max(128).optional(),
  quantity:              z.number().int().positive(),
  startingBid:           z.string().regex(/^\d+$/),
  minimumBidIncrement:   z.string().regex(/^\d+$/),
  reservePrice:          z.string().regex(/^\d+$/).optional(),
  auctionNonce:          z.string().min(1).max(128),
  durationHours:         z.number().int().positive().default(24),
})

export const placeBidSchema = z.object({
  auctionId:        z.string().min(1).max(128),
  bidderPrincipalId: z.string().min(1).max(128),
  bidAmount:        z.string().regex(/^\d+$/),
})

export const freezeAccountSchema = z.object({
  principalId:         z.string().min(1).max(128),
  frozenByPrincipalId: z.string().min(1).max(128),
  reason:              z.string().min(1).max(500),
})

export const settleAuctionSchema = z.object({
  auctionId:        z.string().min(1).max(128),
  idempotencyKey:   z.string().min(1).max(128),
})

export type BankTransferRequest    = z.infer<typeof bankTransferSchema>
export type CreateListingRequest   = z.infer<typeof createListingSchema>
export type PurchaseListingRequest = z.infer<typeof purchaseListingSchema>
export type CreateAuctionRequest   = z.infer<typeof createAuctionSchema>
export type PlaceBidRequest        = z.infer<typeof placeBidSchema>
export type FreezeAccountRequest   = z.infer<typeof freezeAccountSchema>
export type SettleAuctionRequest   = z.infer<typeof settleAuctionSchema>

// ─── Phase 37: Faction & Territory Runtime ────────────────────────────────────

export const createFactionSchema = z.object({
  name:                z.string().min(1).max(128),
  tag:                 z.string().min(1).max(8),
  leaderPrincipalId:   z.string().min(1).max(128),
  factionType:         z.enum(['gang', 'police', 'military', 'government', 'civilian', 'other']),
  colorHex:            z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  description:         z.string().max(1000).optional(),
})

export const claimTerritorySchema = z.object({
  territoryId:         z.string().min(1).max(128),
  factionId:           z.string().min(1).max(128),
  claimedByPrincipalId: z.string().min(1).max(128),
  claimType:           z.enum(['capture', 'purchase', 'grant', 'inheritance']),
  claimNonce:          z.string().min(1).max(128),
  notes:               z.string().max(1000).optional(),
})

export const startConflictSchema = z.object({
  territoryId:             z.string().min(1).max(128),
  attackerFactionId:       z.string().min(1).max(128),
  defenderFactionId:       z.string().max(128).optional(),
  initiatingPrincipalId:   z.string().min(1).max(128),
  conflictType:            z.enum(['territory_capture', 'resource_dispute', 'retaliation', 'war', 'skirmish']),
  conflictNonce:           z.string().min(1).max(128),
  notes:                   z.string().max(1000).optional(),
})

export const resolveConflictSchema = z.object({
  conflictId:   z.string().min(1).max(128),
  outcome:      z.enum(['attacker_won', 'defender_won', 'stalemate', 'aborted']),
  notes:        z.string().max(1000).optional(),
})

export const captureResourceNodeSchema = z.object({
  nodeId:              z.string().min(1).max(128),
  factionId:           z.string().min(1).max(128),
  capturingPrincipalId: z.string().min(1).max(128),
})

export const addFactionMemberSchema = z.object({
  factionId:   z.string().min(1).max(128),
  principalId: z.string().min(1).max(128),
})

export type CreateFactionRequest        = z.infer<typeof createFactionSchema>
export type ClaimTerritoryRequest       = z.infer<typeof claimTerritorySchema>
export type StartConflictRequest        = z.infer<typeof startConflictSchema>
export type ResolveConflictRequest      = z.infer<typeof resolveConflictSchema>
export type CaptureResourceNodeRequest  = z.infer<typeof captureResourceNodeSchema>
export type AddFactionMemberRequest     = z.infer<typeof addFactionMemberSchema>
