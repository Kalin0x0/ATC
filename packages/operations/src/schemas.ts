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

// ─── Phase 38: Housing Economy ────────────────────────────────────────────────

export const createRentalContractSchema = z.object({
  propertyId:          z.string().min(1).max(128),
  tenantPrincipalId:   z.string().min(1).max(128),
  landlordPrincipalId: z.string().min(1).max(128),
  monthlyRent:         z.string().regex(/^\d+$/, 'Must be integer string'),
  depositAmount:       z.string().regex(/^\d+$/, 'Must be integer string'),
  contractNonce:       z.string().min(1).max(128),
  startDate:           z.string().datetime(),
  endDate:             z.string().datetime().optional(),
  terms:               z.string().max(2000).optional(),
})

export const payRentSchema = z.object({
  contractId:       z.string().min(1).max(128),
  amount:           z.string().regex(/^\d+$/, 'Must be integer string'),
  idempotencyKey:   z.string().min(1).max(128),
  notes:            z.string().max(500).optional(),
})

export const terminateRentalContractSchema = z.object({
  contractId:    z.string().min(1).max(128),
  terminatedBy:  z.string().min(1).max(128),
  reason:        z.string().max(500).optional(),
})

export const assessPropertyTaxSchema = z.object({
  propertyId:        z.string().min(1).max(128),
  ownerPrincipalId:  z.string().min(1).max(128),
  periodLabel:       z.string().min(1).max(64),
  taxAmount:         z.string().regex(/^\d+$/, 'Must be integer string'),
  dueAt:             z.string().datetime(),
})

export const triggerForeclosureSchema = z.object({
  propertyId:          z.string().min(1).max(128),
  ownerPrincipalId:    z.string().min(1).max(128),
  foreclosureNonce:    z.string().min(1).max(128),
  reason:              z.string().max(500).optional(),
})

export const valuatePropertySchema = z.object({
  propertyId:     z.string().min(1).max(128),
  valuatedBy:     z.string().min(1).max(128),
  valuationAmount: z.string().regex(/^\d+$/, 'Must be integer string'),
  notes:          z.string().max(500).optional(),
})

export const housingPaymentSchema = z.object({
  contractId:      z.string().min(1).max(128),
  payerPrincipalId: z.string().min(1).max(128),
  amount:          z.string().regex(/^\d+$/, 'Must be integer string'),
  paymentType:     z.enum(['rent', 'deposit', 'tax', 'fee', 'penalty']),
  idempotencyKey:  z.string().min(1).max(128),
  notes:           z.string().max(500).optional(),
})

export type CreateRentalContractRequest  = z.infer<typeof createRentalContractSchema>
export type PayRentRequest               = z.infer<typeof payRentSchema>
export type TerminateRentalContractRequest = z.infer<typeof terminateRentalContractSchema>
export type AssessPropertyTaxRequest     = z.infer<typeof assessPropertyTaxSchema>
export type TriggerForeclosureRequest    = z.infer<typeof triggerForeclosureSchema>
export type ValuatePropertyRequest       = z.infer<typeof valuatePropertySchema>
export type HousingPaymentRequest        = z.infer<typeof housingPaymentSchema>

// ─── Phase 39: NPC Runtime ────────────────────────────────────────────────────

export const spawnNpcSchema = z.object({
  zoneId:            z.string().min(1).max(128),
  spawnNonce:        z.string().min(1).max(128),
  npcType:           z.string().min(1).max(64).default('civilian'),
  metadata:          z.record(z.unknown()).optional(),
  ownerServerId:     z.string().min(1).max(128).optional(),
})

export const despawnNpcSchema = z.object({
  npcId:         z.string().min(1).max(128),
  reason:        z.string().min(1).max(128).default('manual'),
  ownerServerId: z.string().min(1).max(128).optional(),
})

export const recordNpcBehaviorSchema = z.object({
  npcId:     z.string().min(1).max(128),
  behavior:  z.string().min(1).max(128),
  params:    z.record(z.unknown()).optional(),
})

export const npcHeartbeatSchema = z.object({
  npcId:          z.string().min(1).max(128),
  ownerServerId:  z.string().min(1).max(128),
})

export const updateCrowdDensitySchema = z.object({
  zoneId:         z.string().min(1).max(128),
  density:        z.number().min(0).max(1),
  targetDensity:  z.number().min(0).max(1).optional(),
  activeNpcCount: z.number().int().min(0).optional(),
})

export const cleanupStaleNpcsSchema = z.object({
  ownerServerId:    z.string().min(1).max(128),
  staleThresholdMs: z.number().int().min(1000).default(30000),
})

export type SpawnNpcRequest           = z.infer<typeof spawnNpcSchema>
export type DespawnNpcSchema          = z.infer<typeof despawnNpcSchema>
export type RecordNpcBehaviorRequest  = z.infer<typeof recordNpcBehaviorSchema>
export type NpcHeartbeatRequest       = z.infer<typeof npcHeartbeatSchema>
export type UpdateCrowdDensityRequest = z.infer<typeof updateCrowdDensitySchema>
export type CleanupStaleNpcsRequest   = z.infer<typeof cleanupStaleNpcsSchema>

// ─── Phase 40: City Runtime ───────────────────────────────────────────────────

export const registerInfrastructureSchema = z.object({
  nodeId:               z.string().min(1).max(128),
  nodeName:             z.string().min(1).max(255),
  infrastructureType:   z.enum(['power_station', 'water_treatment', 'gas_main', 'telecom_hub', 'road_segment', 'bridge', 'tunnel', 'sewage', 'other']),
  ownerServerId:        z.string().min(1).max(128).optional(),
  positionX:            z.number().optional(),
  positionY:            z.number().optional(),
  positionZ:            z.number().optional(),
})

export const updateInfrastructureHealthSchema = z.object({
  nodeId:       z.string().min(1).max(128),
  healthPercent: z.number().min(0).max(100),
  status:       z.enum(['operational', 'degraded', 'offline', 'maintenance', 'destroyed']).optional(),
})

export const reportInfrastructureFailureSchema = z.object({
  nodeId:        z.string().min(1).max(128),
  failureNonce:  z.string().min(1).max(128),
  failureType:   z.enum(['power_outage', 'water_leak', 'gas_leak', 'road_damage', 'bridge_failure', 'telecom_outage', 'other']),
  severity:      z.enum(['low', 'medium', 'high', 'critical']),
  description:   z.string().max(1000).optional(),
})

export const resolveInfrastructureFailureSchema = z.object({
  failureId:    z.string().min(1).max(128),
  resolvedBy:   z.string().min(1).max(128),
})

export const updateTrafficSignalSchema = z.object({
  signalId:       z.string().min(1).max(128),
  signalName:     z.string().min(1).max(255),
  state:          z.enum(['green', 'yellow', 'red', 'flashing', 'offline']).optional(),
  changedBy:      z.string().min(1).max(128).optional(),
})

export const overrideTrafficSignalSchema = z.object({
  signalId:       z.string().min(1).max(128),
  signalName:     z.string().min(1).max(255),
  overrideBy:     z.string().min(1).max(128),
  state:          z.enum(['green', 'yellow', 'red', 'flashing', 'offline']),
  durationSeconds: z.number().int().min(1).max(3600),
})

export const updateEnvironmentSchema = z.object({
  regionId:           z.string().min(1).max(128),
  weather:            z.enum(['clear', 'cloudy', 'rain', 'thunder', 'snow', 'fog', 'smog', 'overcast']).optional(),
  timeOfDay:          z.enum(['dawn', 'morning', 'afternoon', 'evening', 'night', 'midnight']).optional(),
  temperature:        z.number().min(-50).max(60).optional(),
  windSpeed:          z.number().min(0).max(200).optional(),
  visibility:         z.number().min(0).max(1).optional(),
  isEmergencyWeather: z.boolean().optional(),
  activeEventId:      z.string().max(128).nullable().optional(),
})

export const recordResourceConsumptionSchema = z.object({
  gridId:       z.string().min(1).max(128),
  resourceType: z.enum(['power_kwh', 'water_liters', 'gas_m3', 'bandwidth_mb']),
  amount:       z.number().min(0),
  consumerId:   z.string().min(1).max(128).optional(),
  periodLabel:  z.string().min(1).max(64).optional(),
})

export const reportUtilityOutageSchema = z.object({
  gridId:        z.string().min(1).max(128),
  gridName:      z.string().min(1).max(255),
  utilityType:   z.enum(['power', 'water', 'gas', 'telecom', 'sewage']),
  outageNonce:   z.string().min(1).max(128),
  reason:        z.string().max(500),
  affectedZones: z.array(z.string()).optional(),
})

export const restoreUtilityGridSchema = z.object({
  gridId:                  z.string().min(1).max(128),
  restoredByPrincipalId:   z.string().min(1).max(128),
})

export type RegisterInfrastructureRequest       = z.infer<typeof registerInfrastructureSchema>
export type UpdateInfrastructureHealthRequest   = z.infer<typeof updateInfrastructureHealthSchema>
export type ReportInfrastructureFailureRequest  = z.infer<typeof reportInfrastructureFailureSchema>
export type ResolveInfrastructureFailureRequest = z.infer<typeof resolveInfrastructureFailureSchema>
export type UpdateTrafficSignalRequest          = z.infer<typeof updateTrafficSignalSchema>
export type OverrideTrafficSignalRequest        = z.infer<typeof overrideTrafficSignalSchema>
export type UpdateEnvironmentRequest            = z.infer<typeof updateEnvironmentSchema>
export type RecordResourceConsumptionRequest    = z.infer<typeof recordResourceConsumptionSchema>
export type ReportUtilityOutageRequest          = z.infer<typeof reportUtilityOutageSchema>
export type RestoreUtilityGridRequest           = z.infer<typeof restoreUtilityGridSchema>

// ─── Phase 41: Survival Runtime ───────────────────────────────────────────────

export const survivalTickSchema = z.object({
  playerId:        z.string().min(1).max(128),
  ownerServerId:   z.string().min(1).max(128),
  bodyTemp:        z.number().min(-60).max(100),
  hydrationLevel:  z.number().min(0).max(100),
  fatigueLevel:    z.number().min(0).max(100),
  survivalStatus:  z.enum(['normal', 'cold', 'hot', 'dehydrated', 'exhausted', 'critical']),
  tempTrend:       z.number().optional(),
  depletionRate:   z.number().min(0).optional(),
  restDebt:        z.number().min(0).optional(),
  exposureZone:    z.string().max(128).optional(),
})

export const applyPenaltySchema = z.object({
  playerId:    z.string().min(1).max(128),
  penaltyFlag: z.string().min(1).max(128),
  reason:      z.string().max(500),
})

export const reconcileSurvivalSchema = z.object({
  activePlayerIds: z.array(z.string().min(1).max(128)),
})

export const recordDrinkSchema = z.object({
  playerId: z.string().min(1).max(128),
  amount:   z.number().min(0).max(100),
})

export const recordRestSchema = z.object({
  playerId:       z.string().min(1).max(128),
  recoveryAmount: z.number().min(0).max(100),
})

export const createHazardSchema = z.object({
  hazardId:       z.string().min(1).max(128),
  hazardType:     z.string().min(1).max(64),
  zoneId:         z.string().min(1).max(128),
  severity:       z.number().min(0).max(100),
  ownerServerId:  z.string().max(128).optional(),
})

export const deactivateHazardSchema = z.object({
  hazardId: z.string().min(1).max(128),
})

export const recordExposureSchema = z.object({
  playerId:     z.string().min(1).max(128),
  hazardId:     z.string().min(1).max(128),
  exposureType: z.string().min(1).max(64),
  severity:     z.number().min(0).max(100),
})

export type SurvivalTickRequest     = z.infer<typeof survivalTickSchema>
export type ApplyPenaltyRequest     = z.infer<typeof applyPenaltySchema>
export type ReconcileSurvivalRequest = z.infer<typeof reconcileSurvivalSchema>
export type RecordDrinkRequest      = z.infer<typeof recordDrinkSchema>
export type RecordRestRequest       = z.infer<typeof recordRestSchema>
export type CreateHazardRequest     = z.infer<typeof createHazardSchema>
export type DeactivateHazardRequest = z.infer<typeof deactivateHazardSchema>
export type RecordExposureRequest   = z.infer<typeof recordExposureSchema>

// ─── Phase 42: Crafting Runtime ───────────────────────────────────────────────

export const registerCraftingRecipeSchema = z.object({
  recipeId:             z.string().min(1).max(128),
  recipeName:           z.string().min(1).max(256),
  outputItemId:         z.string().min(1).max(128),
  outputQuantity:       z.number().int().positive(),
  recipeType:           z.enum(['basic', 'advanced', 'industrial']),
  requiredStation:      z.string().max(128).optional(),
  craftingTimeSeconds:  z.number().int().positive(),
  isDiscoverable:       z.boolean().optional(),
})

export const acquireBlueprintSchema = z.object({
  principalId: z.string().min(1).max(128),
  recipeId:    z.string().min(1).max(128),
  source:      z.string().min(1).max(128),
})

export const registerStationSchema = z.object({
  stationId:   z.string().min(1).max(128),
  stationType: z.string().min(1).max(64),
})

export const startProductionJobSchema = z.object({
  queueId:                  z.string().min(1).max(128),
  recipeId:                 z.string().min(1).max(128),
  initiatedByPrincipalId:   z.string().min(1).max(128),
  quantityOrdered:          z.number().int().positive(),
  jobNonce:                 z.string().min(1).max(128),
})

export const completeProductionJobSchema = z.object({
  jobId:            z.string().min(1).max(128),
  quantityProduced: z.number().int().nonnegative(),
})

export const failProductionJobSchema = z.object({
  jobId:  z.string().min(1).max(128),
  reason: z.string().max(500),
})

export const cancelProductionJobSchema = z.object({
  jobId:       z.string().min(1).max(128),
  cancelledBy: z.string().min(1).max(128),
})

export type RegisterCraftingRecipeRequest = z.infer<typeof registerCraftingRecipeSchema>
export type AcquireBlueprintRequest       = z.infer<typeof acquireBlueprintSchema>
export type RegisterStationRequest        = z.infer<typeof registerStationSchema>
export type StartProductionJobRequest     = z.infer<typeof startProductionJobSchema>
export type CompleteProductionJobRequest  = z.infer<typeof completeProductionJobSchema>
export type FailProductionJobRequest      = z.infer<typeof failProductionJobSchema>
export type CancelProductionJobRequest    = z.infer<typeof cancelProductionJobSchema>

// ─── Phase 43: Logistics Runtime ──────────────────────────────────────────────

export const createShipmentSchema = z.object({
  shipmentNonce:        z.string().min(1).max(128),
  originId:             z.string().min(1).max(128),
  destinationId:        z.string().min(1).max(128),
  carrierPrincipalId:   z.string().max(128).optional(),
  cargoManifest:        z.array(z.string()).optional(),
})

export const departShipmentSchema = z.object({
  shipmentId: z.string().min(1).max(128),
})

export const deliverShipmentSchema = z.object({
  shipmentId: z.string().min(1).max(128),
})

export const failShipmentSchema = z.object({
  shipmentId: z.string().min(1).max(128),
  reason:     z.string().max(500),
})

export const registerSupplyRouteSchema = z.object({
  routeId:                    z.string().min(1).max(128),
  routeName:                  z.string().min(1).max(256),
  originNodeId:               z.string().min(1).max(128),
  destinationNodeId:          z.string().min(1).max(128),
  routeType:                  z.enum(['ground', 'air', 'sea', 'rail']),
  distanceKm:                 z.number().nonnegative(),
  estimatedDurationMinutes:   z.number().int().positive(),
})

export const registerLogisticsFleetSchema = z.object({
  fleetId:           z.string().min(1).max(128),
  fleetName:         z.string().min(1).max(256),
  ownerPrincipalId:  z.string().min(1).max(128),
  vehicleIds:        z.array(z.string()).optional(),
})

export const assignLogisticsFleetSchema = z.object({
  fleetId: z.string().min(1).max(128),
  routeId: z.string().min(1).max(128),
})

export const upsertSupplyChainSchema = z.object({
  chainId:   z.string().min(1).max(128),
  chainName: z.string().min(1).max(256),
  nodes:     z.array(z.string()),
  edges:     z.array(z.object({ from: z.string(), to: z.string() })),
})

export const disruptSupplyChainSchema = z.object({
  chainId: z.string().min(1).max(128),
})

export type CreateShipmentRequest         = z.infer<typeof createShipmentSchema>
export type DepartShipmentRequest         = z.infer<typeof departShipmentSchema>
export type DeliverShipmentRequest        = z.infer<typeof deliverShipmentSchema>
export type FailShipmentRequest           = z.infer<typeof failShipmentSchema>
export type RegisterSupplyRouteRequest    = z.infer<typeof registerSupplyRouteSchema>
export type RegisterLogisticsFleetRequest = z.infer<typeof registerLogisticsFleetSchema>
export type AssignLogisticsFleetRequest   = z.infer<typeof assignLogisticsFleetSchema>
export type UpsertSupplyChainRequest      = z.infer<typeof upsertSupplyChainSchema>
export type DisruptSupplyChainRequest     = z.infer<typeof disruptSupplyChainSchema>

// ── Phase 44: Maritime, Aviation & Airspace Runtime ───────────────────────────

export const registerVesselSchema = z.object({
  vesselId:              z.string().min(1).max(128),
  vesselName:            z.string().min(1).max(255),
  vesselType:            z.string().min(1).max(64),
  ownedByPrincipalId:    z.string().min(1).max(128).optional(),
})

export const updateVesselPositionSchema = z.object({
  vesselId:    z.string().min(1).max(128),
  positionX:   z.number(),
  positionY:   z.number(),
  positionZ:   z.number().optional(),
  heading:     z.number().optional(),
  speedKnots:  z.number().min(0).optional(),
  zoneId:      z.string().min(1).max(128).optional(),
})

export const dockVesselSchema = z.object({
  dockingNonce: z.string().min(1).max(128),
  vesselId:     z.string().min(1).max(128),
  dockZoneId:   z.string().min(1).max(128),
  slotId:       z.string().min(1).max(128).optional(),
})

export const undockVesselSchema = z.object({
  dockingId: z.string().min(1).max(128),
})

export const registerAircraftSchema = z.object({
  aircraftId:            z.string().min(1).max(128),
  aircraftName:          z.string().min(1).max(255),
  aircraftType:          z.string().min(1).max(64),
  ownedByPrincipalId:    z.string().min(1).max(128).optional(),
})

export const createFlightSchema = z.object({
  flightNonce:         z.string().min(1).max(128),
  aircraftId:          z.string().min(1).max(128),
  originZoneId:        z.string().min(1).max(128),
  destinationZoneId:   z.string().min(1).max(128),
})

export const departFlightSchema = z.object({
  flightId: z.string().min(1).max(128),
})

export const landFlightSchema = z.object({
  flightId: z.string().min(1).max(128),
})

export const divertFlightSchema = z.object({
  flightId: z.string().min(1).max(128),
})

export const registerAirspaceZoneSchema = z.object({
  zoneId:          z.string().min(1).max(128),
  zoneName:        z.string().min(1).max(255),
  zoneType:        z.string().min(1).max(64),
  minAltitudeM:    z.number().min(0),
  maxAltitudeM:    z.number().min(0),
  ownerServerId:   z.string().min(1).max(128).optional(),
})

export const updateAirspaceStatusSchema = z.object({
  zoneId: z.string().min(1).max(128),
  status: z.enum(['open', 'restricted', 'closed', 'emergency']),
})

export type RegisterVesselRequest       = z.infer<typeof registerVesselSchema>
export type UpdateVesselPositionRequest = z.infer<typeof updateVesselPositionSchema>
export type DockVesselRequest           = z.infer<typeof dockVesselSchema>
export type UndockVesselRequest         = z.infer<typeof undockVesselSchema>
export type RegisterAircraftRequest     = z.infer<typeof registerAircraftSchema>
export type CreateFlightRequest         = z.infer<typeof createFlightSchema>
export type DepartFlightRequest         = z.infer<typeof departFlightSchema>
export type LandFlightRequest           = z.infer<typeof landFlightSchema>
export type DivertFlightRequest         = z.infer<typeof divertFlightSchema>
export type RegisterAirspaceZoneRequest = z.infer<typeof registerAirspaceZoneSchema>
export type UpdateAirspaceStatusRequest = z.infer<typeof updateAirspaceStatusSchema>

// ── Phase 45: Communication, Radio & Signal Runtime ───────────────────────────

export const createRadioChannelSchema = z.object({
  channelId:          z.string().min(1).max(128),
  channelName:        z.string().min(1).max(255),
  channelType:        z.enum(['open', 'encrypted', 'emergency', 'dispatch', 'tactical']),
  frequency:          z.number().min(0),
  ownerPrincipalId:   z.string().min(1).max(128).optional(),
  isEncrypted:        z.boolean().optional(),
  maxMembers:         z.number().int().positive().optional(),
})

export const joinChannelSchema = z.object({
  channelId:    z.string().min(1).max(128),
  principalId:  z.string().min(1).max(128),
  role:         z.enum(['listener', 'speaker', 'moderator', 'admin']).optional(),
})

export const leaveChannelSchema = z.object({
  channelId:   z.string().min(1).max(128),
  principalId: z.string().min(1).max(128),
})

export const updateChannelStatusSchema = z.object({
  channelId: z.string().min(1).max(128),
  status:    z.enum(['active', 'inactive', 'jammed', 'offline']),
})

export const upsertSignalSchema = z.object({
  signalId:       z.string().min(1).max(128),
  channelId:      z.string().min(1).max(128).optional(),
  signalType:     z.enum(['radio', 'digital', 'emergency', 'encrypted', 'broadcast']),
  strength:       z.number().min(0).max(100),
  status:         z.enum(['active', 'degraded', 'lost', 'jammed']).optional(),
  originZoneId:   z.string().min(1).max(128).optional(),
  ownerServerId:  z.string().min(1).max(128),
})

export const emergencyBroadcastSchema = z.object({
  broadcastNonce:            z.string().min(1).max(128),
  initiatedByPrincipalId:    z.string().min(1).max(128),
  message:                   z.string().min(1).max(2000),
  severity:                  z.enum(['info', 'warning', 'critical', 'emergency']),
  targetZoneId:              z.string().min(1).max(128).optional(),
  expiresAt:                 z.string().datetime().optional(),
})

export const cancelBroadcastSchema = z.object({
  broadcastId: z.string().min(1).max(128),
})

export const setEncryptionSchema = z.object({
  channelId:           z.string().min(1).max(128),
  encryptionKeyHash:   z.string().min(1).max(255),
})

export const reconcileSignalsSchema = z.object({
  thresholdMs: z.number().int().min(1000).default(30000),
})

export type CreateRadioChannelRequest   = z.infer<typeof createRadioChannelSchema>
export type JoinChannelRequest          = z.infer<typeof joinChannelSchema>
export type LeaveChannelRequest         = z.infer<typeof leaveChannelSchema>
export type UpdateChannelStatusRequest  = z.infer<typeof updateChannelStatusSchema>
export type UpsertSignalRequest         = z.infer<typeof upsertSignalSchema>
export type EmergencyBroadcastRequest   = z.infer<typeof emergencyBroadcastSchema>
export type CancelBroadcastRequest      = z.infer<typeof cancelBroadcastSchema>
export type SetEncryptionRequest        = z.infer<typeof setEncryptionSchema>
export type ReconcileSignalsRequest     = z.infer<typeof reconcileSignalsSchema>

// ── Phase 46: Disaster, Crisis & Emergency Management Runtime ─────────────────

export const declareDisasterSchema = z.object({
  disasterNonce:              z.string().min(1).max(128),
  disasterType:               z.enum(['earthquake', 'flood', 'fire', 'chemical', 'nuclear', 'storm', 'blackout', 'pandemic', 'riot', 'custom']),
  disasterName:               z.string().min(1).max(255),
  severity:                   z.number().min(0).max(100),
  affectedZoneIds:            z.array(z.string().min(1).max(128)).optional(),
  initiatedByPrincipalId:     z.string().min(1).max(128).optional(),
  ownerServerId:              z.string().min(1).max(128).optional(),
})

export const updateDisasterStatusSchema = z.object({
  disasterId: z.string().min(1).max(128),
  status:     z.enum(['active', 'contained', 'resolved', 'escalated']),
})

export const propagateHazardSchema = z.object({
  zoneId:             z.string().min(1).max(128),
  disasterId:         z.string().min(1).max(128).optional(),
  hazardType:         z.enum(['radiation', 'chemical', 'biological', 'fire', 'flood', 'structural', 'exclusion']),
  severity:           z.number().min(0).max(100),
  propagationRadius:  z.number().min(0).optional(),
})

export const clearHazardZoneSchema = z.object({
  zoneId: z.string().min(1).max(128),
})

export const initiateEvacuationSchema = z.object({
  evacuationNonce: z.string().min(1).max(128),
  disasterId:      z.string().min(1).max(128).optional(),
  zoneId:          z.string().min(1).max(128),
  evacuationType:  z.string().min(1).max(64),
  targetCount:     z.number().int().positive().optional(),
})

export const updateEvacuationProgressSchema = z.object({
  evacuationId:    z.string().min(1).max(128),
  evacuatedCount:  z.number().int().min(0),
})

export const completeEvacuationSchema = z.object({
  evacuationId: z.string().min(1).max(128),
})

export const dispatchResponseSchema = z.object({
  disasterId:             z.string().min(1).max(128).optional(),
  responseType:           z.enum(['fire_brigade', 'medical', 'police', 'military', 'hazmat', 'search_rescue', 'civil_defense']),
  responderPrincipalId:   z.string().min(1).max(128).optional(),
})

export const updateResponseStatusSchema = z.object({
  responseId: z.string().min(1).max(128),
  status:     z.enum(['dispatched', 'on_scene', 'withdrawn', 'completed']),
})

export const startRecoverySchema = z.object({
  disasterId:              z.string().min(1).max(128),
  recoveryPhase:           z.string().min(1).max(64),
  progressPercent:         z.number().min(0).max(100),
  estimatedCompletionAt:   z.string().datetime().optional(),
})

export const updateRecoveryProgressSchema = z.object({
  disasterId:       z.string().min(1).max(128),
  progressPercent:  z.number().min(0).max(100),
})

export type DeclareDisasterRequest        = z.infer<typeof declareDisasterSchema>
export type UpdateDisasterStatusRequest   = z.infer<typeof updateDisasterStatusSchema>
export type PropagateHazardRequest        = z.infer<typeof propagateHazardSchema>
export type ClearHazardZoneRequest        = z.infer<typeof clearHazardZoneSchema>
export type InitiateEvacuationRequest     = z.infer<typeof initiateEvacuationSchema>
export type UpdateEvacuationProgressRequest = z.infer<typeof updateEvacuationProgressSchema>
export type CompleteEvacuationRequest     = z.infer<typeof completeEvacuationSchema>
export type DispatchResponseRequest       = z.infer<typeof dispatchResponseSchema>
export type UpdateResponseStatusRequest   = z.infer<typeof updateResponseStatusSchema>
export type StartRecoveryRequest          = z.infer<typeof startRecoverySchema>
export type UpdateRecoveryProgressRequest = z.infer<typeof updateRecoveryProgressSchema>

// ── Phase 47: Mission, Objective & Dynamic Scenario Runtime ──────────────────

export const createMissionSchema = z.object({
  missionNonce:       z.string().min(1).max(128),
  missionType:        z.enum(['main', 'side', 'dynamic', 'faction', 'emergency', 'custom']),
  missionName:        z.string().min(1).max(255),
  ownerServerId:      z.string().min(1).max(128).optional(),
  ownerPrincipalId:   z.string().min(1).max(128).optional(),
  configData:         z.record(z.unknown()).optional(),
})

export const startMissionSchema = z.object({
  missionId: z.string().min(1).max(26),
})

export const completeMissionSchema = z.object({
  missionId: z.string().min(1).max(26),
})

export const failMissionSchema = z.object({
  missionId: z.string().min(1).max(26),
})

export const createObjectiveSchema = z.object({
  objectiveId:    z.string().min(1).max(26),
  missionId:      z.string().min(1).max(26),
  objectiveType:  z.enum(['reach', 'collect', 'eliminate', 'protect', 'deliver', 'interact', 'custom']),
  objectiveName:  z.string().min(1).max(255),
  sequenceOrder:  z.number().int().min(0).optional(),
  completionData: z.record(z.unknown()).optional(),
})

export const completeObjectiveSchema = z.object({
  objectiveId: z.string().min(1).max(26),
})

export const assignMissionSchema = z.object({
  missionId:    z.string().min(1).max(26),
  assigneeId:   z.string().min(1).max(128),
  assigneeType: z.enum(['player', 'group', 'npc', 'server']).optional(),
  role:         z.enum(['owner', 'participant', 'observer']).optional(),
})

export const releaseMissionAssignmentSchema = z.object({
  missionId:  z.string().min(1).max(26),
  assigneeId: z.string().min(1).max(128),
})

export const registerScenarioSchema = z.object({
  scenarioId:     z.string().min(1).max(128),
  scenarioType:   z.enum(['combat', 'rescue', 'transport', 'investigation', 'escort', 'custom']),
  missionId:      z.string().min(1).max(26).optional(),
  configData:     z.record(z.unknown()).optional(),
  ownerServerId:  z.string().min(1).max(128).optional(),
})

export const createDynamicEventSchema = z.object({
  eventNonce:     z.string().min(1).max(128),
  eventType:      z.enum(['ambush', 'accident', 'weather', 'crowd', 'crime', 'emergency', 'custom']),
  triggerData:    z.record(z.unknown()).optional(),
  zoneId:         z.string().min(1).max(128).optional(),
  ownerServerId:  z.string().min(1).max(128).optional(),
  expiresAt:      z.string().datetime().optional(),
})

export const resolveEventSchema = z.object({
  eventId: z.string().min(1).max(26),
})

export const progressMissionSchema = z.object({
  missionId:   z.string().min(1).max(26),
  objectiveId: z.string().min(1).max(26),
})

export type CreateMissionRequest          = z.infer<typeof createMissionSchema>
export type StartMissionRequest           = z.infer<typeof startMissionSchema>
export type CompleteMissionRequest        = z.infer<typeof completeMissionSchema>
export type FailMissionRequest            = z.infer<typeof failMissionSchema>
export type CreateObjectiveRequest        = z.infer<typeof createObjectiveSchema>
export type CompleteObjectiveRequest      = z.infer<typeof completeObjectiveSchema>
export type AssignMissionRequest          = z.infer<typeof assignMissionSchema>
export type ReleaseMissionAssignmentRequest = z.infer<typeof releaseMissionAssignmentSchema>
export type RegisterScenarioRequest       = z.infer<typeof registerScenarioSchema>
export type CreateDynamicEventRequest     = z.infer<typeof createDynamicEventSchema>
export type ResolveEventRequest           = z.infer<typeof resolveEventSchema>
export type ProgressMissionRequest        = z.infer<typeof progressMissionSchema>

// ── Phase 48: Reputation, Diplomacy & Social Influence Runtime ───────────────

export const adjustReputationSchema = z.object({
  principalId: z.string().min(1).max(128),
  factionId:   z.string().min(1).max(128),
  delta:       z.number().min(-1000).max(1000),
  reason:      z.string().min(1).max(255),
  actorId:     z.string().min(1).max(128).optional(),
})

export const upsertReputationSchema = z.object({
  principalId:      z.string().min(1).max(128),
  factionId:        z.string().min(1).max(128),
  reputationScore:  z.number().min(-1000).max(1000),
  tier:             z.enum(['hostile', 'unfriendly', 'neutral', 'friendly', 'allied', 'revered']),
})

export const setDiplomaticRelationSchema = z.object({
  factionAId:    z.string().min(1).max(128),
  factionBId:    z.string().min(1).max(128),
  status:        z.enum(['war', 'hostile', 'neutral', 'friendly', 'allied', 'vassal']),
  relationScore: z.number().min(-1000).max(1000),
})

export const adjustSocialStandingSchema = z.object({
  principalId: z.string().min(1).max(128),
  delta:       z.number().min(-1000).max(1000),
  reason:      z.string().min(1).max(255),
})

export const upsertSocialStandingSchema = z.object({
  principalId:   z.string().min(1).max(128),
  standingScore: z.number().min(0).max(1000),
  tier:          z.enum(['criminal', 'disreputable', 'common', 'respected', 'prominent', 'elite']),
})

export const scheduleDecaySchema = z.object({
  principalId:  z.string().min(1).max(128),
  factionId:    z.string().min(1).max(128).optional(),
  decayRate:    z.number().min(0.001).max(100),
  nextDecayAt:  z.string().datetime(),
})

export const recordInfluenceSchema = z.object({
  principalId:   z.string().min(1).max(128),
  changeAmount:  z.number(),
  changeType:    z.enum(['gain', 'loss', 'decay', 'reset', 'transfer', 'event']),
  changeReason:  z.string().min(1).max(255),
  factionId:     z.string().min(1).max(128).optional(),
  actorId:       z.string().min(1).max(128).optional(),
})

export type AdjustReputationRequest       = z.infer<typeof adjustReputationSchema>
export type UpsertReputationRequest       = z.infer<typeof upsertReputationSchema>
export type SetDiplomaticRelationRequest  = z.infer<typeof setDiplomaticRelationSchema>
export type AdjustSocialStandingRequest   = z.infer<typeof adjustSocialStandingSchema>
export type UpsertSocialStandingRequest   = z.infer<typeof upsertSocialStandingSchema>
export type ScheduleDecayRequest          = z.infer<typeof scheduleDecaySchema>
export type RecordInfluenceRequest        = z.infer<typeof recordInfluenceSchema>

// ── Phase 49: Advanced AI Tactical & Autonomous Response Runtime ─────────────

export const upsertAiEntitySchema = z.object({
  entityId:       z.string().min(1).max(128),
  entityType:     z.enum(['npc', 'vehicle', 'drone', 'turret', 'guard', 'creature', 'custom']),
  aiState:        z.enum(['idle', 'patrolling', 'alert', 'engaged', 'fleeing', 'dead', 'recovering']).optional(),
  behaviorMode:   z.enum(['passive', 'defensive', 'aggressive', 'stealth', 'support', 'custom']).optional(),
  ownerServerId:  z.string().min(1).max(128).optional(),
  positionData:   z.record(z.unknown()).optional(),
  threatLevel:    z.number().min(0).max(100).optional(),
})

export const updateAiStateSchema = z.object({
  entityId: z.string().min(1).max(128),
  aiState:  z.enum(['idle', 'patrolling', 'alert', 'engaged', 'fleeing', 'dead', 'recovering']),
})

export const startPatrolSchema = z.object({
  patrolNonce:    z.string().min(1).max(128),
  entityId:       z.string().min(1).max(128),
  patrolType:     z.enum(['foot', 'vehicle', 'air', 'water', 'static', 'custom']),
  routeData:      z.record(z.unknown()).optional(),
  ownerServerId:  z.string().min(1).max(128).optional(),
})

export const completePatrolSchema = z.object({
  patrolId: z.string().min(1).max(26),
})

export const assessThreatSchema = z.object({
  assessmentId:    z.string().min(1).max(26).optional(),
  entityId:        z.string().min(1).max(128),
  threatSourceId:  z.string().min(1).max(128).optional(),
  threatLevel:     z.enum(['minimal', 'low', 'moderate', 'high', 'critical']),
  threatType:      z.enum(['player', 'vehicle', 'group', 'zone', 'faction', 'unknown']),
  assessmentData:  z.record(z.unknown()).optional(),
  expiresAt:       z.string().datetime().optional(),
})

export const requestReinforcementSchema = z.object({
  reinforcementNonce:  z.string().min(1).max(128),
  requestingEntityId:  z.string().min(1).max(128).optional(),
  reinforcementType:   z.enum(['ground', 'air', 'vehicle', 'special_ops', 'medical', 'support', 'custom']),
  quantity:            z.number().int().min(1).max(100).optional(),
  ownerServerId:       z.string().min(1).max(128).optional(),
})

export const activateTacticalResponseSchema = z.object({
  entityId:       z.string().min(1).max(128),
  responseType:   z.enum(['pursuit', 'combat', 'investigation', 'evacuation', 'lockdown', 'suppression', 'custom']),
  targetId:       z.string().min(1).max(128).optional(),
  tacticalData:   z.record(z.unknown()).optional(),
  ownerServerId:  z.string().min(1).max(128).optional(),
})

export const updateReinforcementStatusSchema = z.object({
  reinforcementId: z.string().min(1).max(26),
  status:          z.enum(['dispatched', 'arrived', 'withdrawn', 'cancelled']),
})

export const recoverAiEntitySchema = z.object({
  entityId: z.string().min(1).max(128),
})

export const cleanupAiRuntimeSchema = z.object({
  thresholdMs: z.number().int().min(1000).default(60000),
})

export type UpsertAiEntityRequest             = z.infer<typeof upsertAiEntitySchema>
export type UpdateAiStateRequest              = z.infer<typeof updateAiStateSchema>
export type StartPatrolRequest                = z.infer<typeof startPatrolSchema>
export type CompletePatrolRequest             = z.infer<typeof completePatrolSchema>
export type AssessThreatRequest               = z.infer<typeof assessThreatSchema>
export type RequestReinforcementRequest       = z.infer<typeof requestReinforcementSchema>
export type ActivateTacticalResponseRequest   = z.infer<typeof activateTacticalResponseSchema>
export type UpdateReinforcementStatusRequest  = z.infer<typeof updateReinforcementStatusSchema>
export type RecoverAiEntityRequest            = z.infer<typeof recoverAiEntitySchema>
export type CleanupAiRuntimeRequest           = z.infer<typeof cleanupAiRuntimeSchema>

// ── Phase 50: Replication, Streaming & Spatial Ownership Runtime ─────────────

export const upsertSpatialNodeSchema = z.object({
  nodeId:        z.string().min(1).max(128),
  nodeType:      z.enum(['server', 'zone', 'region', 'partition', 'custom']),
  ownerServerId: z.string().min(1).max(128).optional(),
  regionId:      z.string().min(1).max(128).optional(),
  positionData:  z.record(z.unknown()).optional(),
})

export const claimOwnershipSchema = z.object({
  entityId:      z.string().min(1).max(128),
  entityType:    z.enum(['npc', 'vehicle', 'player', 'zone', 'object', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  regionId:      z.string().min(1).max(128).optional(),
})

export const transferOwnershipSchema = z.object({
  entityId:     z.string().min(1).max(128),
  fromServerId: z.string().min(1).max(128),
  toServerId:   z.string().min(1).max(128),
})

export const updateStreamingStateSchema = z.object({
  entityId:       z.string().min(1).max(128),
  streamingState: z.enum(['active', 'paused', 'frozen', 'culled']),
  ownerServerId:  z.string().min(1).max(128).optional(),
})

export const createSnapshotSchema = z.object({
  entityId:       z.string().min(1).max(128),
  snapshotType:   z.enum(['full', 'delta', 'checkpoint']),
  ownerServerId:  z.string().min(1).max(128),
  snapshotData:   z.record(z.unknown()),
  sequenceNumber: z.number().int().min(0),
})

export const upsertInterestRegionSchema = z.object({
  regionId:      z.string().min(1).max(128),
  regionType:    z.enum(['zone', 'cell', 'sector', 'custom']),
  ownerServerId: z.string().min(1).max(128).optional(),
  boundsData:    z.record(z.unknown()).optional(),
})

export const cleanupReplicationSchema = z.object({
  thresholdMs: z.number().int().min(1000).default(60000),
})

export type UpsertSpatialNodeRequest     = z.infer<typeof upsertSpatialNodeSchema>
export type ClaimOwnershipRequest        = z.infer<typeof claimOwnershipSchema>
export type TransferOwnershipRequest     = z.infer<typeof transferOwnershipSchema>
export type UpdateStreamingStateRequest  = z.infer<typeof updateStreamingStateSchema>
export type CreateSnapshotRequest        = z.infer<typeof createSnapshotSchema>
export type UpsertInterestRegionRequest  = z.infer<typeof upsertInterestRegionSchema>
export type CleanupReplicationRequest    = z.infer<typeof cleanupReplicationSchema>

// ── Phase 51: Cross-Node Migration & Runtime Reconciliation ──────────────────

export const startMigrationSchema = z.object({
  migrationNonce: z.string().min(1).max(128),
  entityId:       z.string().min(1).max(128),
  fromServerId:   z.string().min(1).max(128),
  toServerId:     z.string().min(1).max(128),
  migrationData:  z.record(z.unknown()).optional(),
})

export const transitionMigrationSchema = z.object({
  migrationId: z.string().min(1).max(26),
  reason:      z.string().min(1).max(512).optional(),
})

export const createNodeTransferSchema = z.object({
  entityId:     z.string().min(1).max(128),
  fromServerId: z.string().min(1).max(128),
  toServerId:   z.string().min(1).max(128),
  transferData: z.record(z.unknown()).optional(),
})

export const transitionNodeTransferSchema = z.object({
  transferId: z.string().min(1).max(26),
  status:     z.enum(['in_progress', 'completed', 'failed']),
})

export const startReconciliationSchema = z.object({
  reconciliationId:   z.string().min(1).max(26).optional(),
  reconciliationType: z.enum(['ownership', 'snapshot', 'migration', 'consistency', 'custom']),
  regionId:           z.string().min(1).max(128).optional(),
  serverId:           z.string().min(1).max(128).optional(),
})

export const replayCheckpointSchema = z.object({
  entityId:   z.string().min(1).max(128),
  snapshotId: z.string().min(1).max(26),
})

export const createRecoverySchema = z.object({
  entityId:       z.string().min(1).max(128),
  recoveryType:   z.enum(['snapshot', 'migration', 'ownership', 'custom']),
  targetServerId: z.string().min(1).max(128).optional(),
})

export type StartMigrationRequest          = z.infer<typeof startMigrationSchema>
export type TransitionMigrationRequest     = z.infer<typeof transitionMigrationSchema>
export type CreateNodeTransferRequest      = z.infer<typeof createNodeTransferSchema>
export type TransitionNodeTransferRequest  = z.infer<typeof transitionNodeTransferSchema>
export type StartReconciliationRequest     = z.infer<typeof startReconciliationSchema>
export type ReplayCheckpointRequest        = z.infer<typeof replayCheckpointSchema>
export type CreateRecoveryRequest          = z.infer<typeof createRecoverySchema>

// ── Phase 52: Massive Persistent World Orchestration ─────────────────────────

export const upsertWorldRegionSchema = z.object({
  regionId:      z.string().min(1).max(128),
  regionType:    z.enum(['city', 'wilderness', 'ocean', 'interior', 'instance', 'custom']),
  ownerServerId: z.string().min(1).max(128).optional(),
  boundsData:    z.record(z.unknown()).optional(),
  capacityLimit: z.number().int().min(1).optional(),
})

export const transferRegionSchema = z.object({
  regionId:     z.string().min(1).max(128),
  fromServerId: z.string().min(1).max(128),
  toServerId:   z.string().min(1).max(128),
})

export const allocateShardSchema = z.object({
  shardId:       z.string().min(1).max(128),
  shardType:     z.enum(['world', 'instance', 'arena', 'lobby', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  regionId:      z.string().min(1).max(128).optional(),
  capacityLimit: z.number().int().min(1).optional(),
})

export const transferShardSchema = z.object({
  shardId:      z.string().min(1).max(128),
  fromServerId: z.string().min(1).max(128),
  toServerId:   z.string().min(1).max(128),
})

export const upsertRegionalSimulationSchema = z.object({
  regionId:       z.string().min(1).max(128),
  simulationType: z.enum(['full', 'partial', 'minimal', 'frozen']),
  ownerServerId:  z.string().min(1).max(128).optional(),
  simulationData: z.record(z.unknown()).optional(),
})

export const rebalanceWorldSchema = z.object({
  regionId:         z.string().min(1).max(128).optional(),
  thresholdPercent: z.number().int().min(1).max(100).default(80),
})

export const cleanupShardsSchema = z.object({
  thresholdMs: z.number().int().min(1000).default(60000),
})

export type UpsertWorldRegionRequest          = z.infer<typeof upsertWorldRegionSchema>
export type TransferRegionRequest             = z.infer<typeof transferRegionSchema>
export type AllocateShardRequest              = z.infer<typeof allocateShardSchema>
export type TransferShardRequest              = z.infer<typeof transferShardSchema>
export type UpsertRegionalSimulationRequest   = z.infer<typeof upsertRegionalSimulationSchema>
export type RebalanceWorldRequest             = z.infer<typeof rebalanceWorldSchema>
export type CleanupShardsRequest              = z.infer<typeof cleanupShardsSchema>

// ── Phase 53 — Advanced Combat, Ballistics & Tactical Simulation ─────────────

export const startCombatSimulationSchema = z.object({
  sessionId:     z.string().min(1).max(128),
  combatType:    z.enum(['pvp', 'pve', 'faction', 'siege', 'skirmish', 'custom']),
  entityId:      z.string().min(1).max(128),
  targetId:      z.string().min(1).max(128).optional(),
  ownerServerId: z.string().min(1).max(128),
  regionId:      z.string().min(1).max(128).optional(),
  sessionNonce:  z.string().min(1).max(128),
  combatData:    z.record(z.unknown()).optional(),
})

export const endCombatSimulationSchema = z.object({
  reason: z.string().min(1).max(256).optional(),
})

export const recordBallisticImpactSchema = z.object({
  sessionId:        z.string().min(1).max(128),
  entityId:         z.string().min(1).max(128),
  ballisticType:    z.enum(['bullet', 'explosive', 'melee', 'energy', 'custom']),
  trajectoryData:   z.record(z.unknown()).optional(),
  impactData:       z.record(z.unknown()).optional(),
  velocity:         z.number().min(0).optional(),
  penetrationDepth: z.number().min(0).optional(),
  ownerServerId:    z.string().min(1).max(128),
})

export const applyTacticalDamageSchema = z.object({
  sessionId:        z.string().min(1).max(128),
  entityId:         z.string().min(1).max(128),
  attackerId:       z.string().min(1).max(128).optional(),
  damageType:       z.enum(['ballistic', 'explosive', 'melee', 'fire', 'toxic', 'custom']),
  damageAmount:     z.number().min(0),
  armorPenetration: z.number().min(0).default(0),
  bodyZone:         z.string().min(1).max(64).optional(),
  damageData:       z.record(z.unknown()).optional(),
  ownerServerId:    z.string().min(1).max(128),
})

export const applySuppressionSchema = z.object({
  entityId:         z.string().min(1).max(128),
  suppressorId:     z.string().min(1).max(128).optional(),
  suppressionType:  z.enum(['gunfire', 'explosion', 'smoke', 'flashbang', 'psychological', 'custom']),
  suppressionLevel: z.number().int().min(0).max(100),
  ownerServerId:    z.string().min(1).max(128),
  regionId:         z.string().min(1).max(128).optional(),
  expiresAt:        z.string().datetime().optional(),
})

export const upsertArmorSchema = z.object({
  entityId:             z.string().min(1).max(128),
  armorType:            z.enum(['none', 'light', 'medium', 'heavy', 'ballistic', 'custom']),
  protectionLevel:      z.number().int().min(0).max(100),
  penetrationThreshold: z.number().min(0),
  currentIntegrity:     z.number().min(0).max(100),
  ownerServerId:        z.string().min(1).max(128),
  armorData:            z.record(z.unknown()).optional(),
})

export const cleanupCombatSchema = z.object({
  thresholdMs: z.number().int().min(1000).default(60000),
})

export type StartCombatSimulationRequest = z.infer<typeof startCombatSimulationSchema>
export type EndCombatSimulationRequest   = z.infer<typeof endCombatSimulationSchema>
export type RecordBallisticImpactRequest = z.infer<typeof recordBallisticImpactSchema>
export type ApplyTacticalDamageRequest   = z.infer<typeof applyTacticalDamageSchema>
export type ApplySuppressionRequest      = z.infer<typeof applySuppressionSchema>
export type UpsertArmorRequest           = z.infer<typeof upsertArmorSchema>
export type CleanupCombatRequest         = z.infer<typeof cleanupCombatSchema>

// ── Phase 54 — Persistent Narrative, Campaign & World Event Runtime ──────────

export const startCampaignSchema = z.object({
  campaignId:    z.string().min(1).max(128),
  campaignType:  z.enum(['main', 'side', 'faction', 'dynamic', 'world', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  regionId:      z.string().min(1).max(128).optional(),
  campaignNonce: z.string().min(1).max(128),
  campaignData:  z.record(z.unknown()).optional(),
})

export const triggerWorldEventSchema = z.object({
  eventId:          z.string().min(1).max(128),
  eventType:        z.enum(['weather', 'political', 'economic', 'conflict', 'disaster', 'social', 'custom']),
  ownerServerId:    z.string().min(1).max(128),
  regionId:         z.string().min(1).max(128).optional(),
  triggerCondition: z.string().max(256).optional(),
  eventData:        z.record(z.unknown()).optional(),
  expiresAt:        z.string().datetime().optional(),
})

export const advanceStoryProgressionSchema = z.object({
  id:              z.string().min(1).max(26),
  newStageKey:     z.string().min(1).max(256),
  progressionData: z.record(z.unknown()).optional(),
})

export const startNarrativeSessionSchema = z.object({
  sessionId:     z.string().min(1).max(128),
  entityId:      z.string().min(1).max(128),
  campaignId:    z.string().min(1).max(128).optional(),
  narrativeType: z.enum(['cutscene', 'dialogue', 'mission', 'event', 'ambient', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  narrativeData: z.record(z.unknown()).optional(),
})

export const setStoryStateSchema = z.object({
  entityId:      z.string().min(1).max(128),
  branchKey:     z.string().min(1).max(256),
  stateType:     z.enum(['choice', 'outcome', 'flag', 'variable', 'trigger', 'custom']),
  storyData:     z.record(z.unknown()).optional(),
  ownerServerId: z.string().min(1).max(128),
})

export const cleanupNarrativeSchema = z.object({
  thresholdMs: z.number().int().min(1000).default(60000),
})

export type StartCampaignRequest             = z.infer<typeof startCampaignSchema>
export type TriggerWorldEventRequest         = z.infer<typeof triggerWorldEventSchema>
export type AdvanceStoryProgressionRequest   = z.infer<typeof advanceStoryProgressionSchema>
export type StartNarrativeSessionRequest     = z.infer<typeof startNarrativeSessionSchema>
export type SetStoryStateRequest             = z.infer<typeof setStoryStateSchema>
export type CleanupNarrativeRequest          = z.infer<typeof cleanupNarrativeSchema>

// ── Phase 55 — Runtime Recovery, Failover & Chaos Resilience ────────────────

export const initiateFailoverSchema = z.object({
  failoverId:      z.string().min(1).max(128),
  failoverType:    z.enum(['planned', 'emergency', 'cascade', 'rolling', 'custom']),
  sourceServerId:  z.string().min(1).max(128),
  targetServerId:  z.string().min(1).max(128),
  failoverNonce:   z.string().min(1).max(128),
  failoverData:    z.record(z.unknown()).optional(),
})

export const createRecoveryOperationSchema = z.object({
  operationId:    z.string().min(1).max(128),
  operationType:  z.enum(['snapshot_restore', 'state_repair', 'ownership_reclaim', 'replication_sync', 'full_recovery', 'custom']),
  entityId:       z.string().min(1).max(128).optional(),
  ownerServerId:  z.string().min(1).max(128),
  recoveryData:   z.record(z.unknown()).optional(),
})

export const createResilienceSnapshotSchema = z.object({
  entityId:       z.string().min(1).max(128),
  snapshotType:   z.enum(['full', 'partial', 'delta', 'checkpoint', 'custom']),
  ownerServerId:  z.string().min(1).max(128),
  snapshotData:   z.record(z.unknown()),
  sequenceNumber: z.number().int().min(0),
})

export const startChaosTestSchema = z.object({
  testId:         z.string().min(1).max(128),
  testType:       z.enum(['network_partition', 'server_crash', 'latency_injection', 'resource_exhaustion', 'split_brain', 'custom']),
  targetServerId: z.string().min(1).max(128).optional(),
  chaosData:      z.record(z.unknown()).optional(),
})

export const upsertResilienceSchema = z.object({
  recordId:       z.string().min(1).max(128),
  resilienceType: z.enum(['server', 'region', 'cluster', 'shard', 'service', 'custom']),
  ownerServerId:  z.string().min(1).max(128),
  healthScore:    z.number().int().min(0).max(100),
  resilienceData: z.record(z.unknown()).optional(),
})

export const cleanupResilienceSchema = z.object({
  thresholdMs: z.number().int().min(1000).default(60000),
})

export type InitiateFailoverRequest          = z.infer<typeof initiateFailoverSchema>
export type CreateRecoveryOperationRequest   = z.infer<typeof createRecoveryOperationSchema>
export type CreateResilienceSnapshotRequest  = z.infer<typeof createResilienceSnapshotSchema>
export type StartChaosTestRequest            = z.infer<typeof startChaosTestSchema>
export type UpsertResilienceRequest          = z.infer<typeof upsertResilienceSchema>
export type CleanupResilienceRequest         = z.infer<typeof cleanupResilienceSchema>

// ── Phase 56: Distributed Observability, Telemetry & Runtime Tracing ──────────

export const startTraceSchema = z.object({
  traceType: z.enum(['request', 'event', 'query', 'job', 'rpc', 'custom']),
  sourceNode: z.string().min(1).max(128),
  ownerServerId: z.string().min(1).max(128),
  traceNonce: z.string().min(1).max(128),
  targetNode: z.string().min(1).max(128).optional(),
  traceData: z.record(z.unknown()).optional(),
})

export const recordMetricSchema = z.object({
  metricType: z.string().min(1).max(64),
  ownerServerId: z.string().min(1).max(128),
  value: z.number(),
  entityId: z.string().min(1).max(128).optional(),
  unit: z.string().min(1).max(32).optional(),
  metricData: z.record(z.unknown()).optional(),
})

export const createCorrelationSchema = z.object({
  failureType: z.enum(['node_crash', 'timeout', 'network_partition', 'resource_exhaustion', 'cascade', 'custom']),
  sourceNode: z.string().min(1).max(128),
  ownerServerId: z.string().min(1).max(128),
  correlationData: z.record(z.unknown()).optional(),
})

export const runDiagnosticSchema = z.object({
  diagnosticType: z.enum(['health_check', 'performance', 'connectivity', 'memory', 'resource', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  entityId: z.string().min(1).max(128).optional(),
  diagnosticData: z.record(z.unknown()).optional(),
})

export const upsertTraceStateSchema = z.object({
  entityId: z.string().min(1).max(128),
  traceLevel: z.enum(['debug', 'info', 'warn', 'error']),
  ownerServerId: z.string().min(1).max(128),
  expiresAt: z.string().datetime().optional(),
  traceData: z.record(z.unknown()).optional(),
})

export const cleanupObservabilitySchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type StartTraceRequest           = z.infer<typeof startTraceSchema>
export type RecordMetricRequest         = z.infer<typeof recordMetricSchema>
export type CreateCorrelationRequest    = z.infer<typeof createCorrelationSchema>
export type RunDiagnosticRequest        = z.infer<typeof runDiagnosticSchema>
export type UpsertTraceStateRequest     = z.infer<typeof upsertTraceStateSchema>
export type CleanupObservabilityRequest = z.infer<typeof cleanupObservabilitySchema>

// ── Phase 57: Deployment, Cluster Orchestration & Runtime Lifecycle ───────────

export const registerNodeSchema = z.object({
  nodeType: z.enum(['game', 'api', 'proxy', 'worker', 'cache', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  nodeNonce: z.string().min(1).max(128),
  address: z.string().min(1).max(256).optional(),
  nodeData: z.record(z.unknown()).optional(),
})

export const startDeploymentSchema = z.object({
  deploymentType: z.enum(['rolling', 'blue_green', 'canary', 'hotfix', 'full', 'custom']),
  targetNode: z.string().min(1).max(128),
  ownerServerId: z.string().min(1).max(128),
  deploymentNonce: z.string().min(1).max(128),
  deploymentData: z.record(z.unknown()).optional(),
})

export const startScalingSchema = z.object({
  scalingType: z.enum(['scale_up', 'scale_down', 'rebalance', 'eviction', 'custom']),
  targetCount: z.number().int().min(0),
  ownerServerId: z.string().min(1).max(128),
  scalingNonce: z.string().min(1).max(128),
  scalingData: z.record(z.unknown()).optional(),
})

export const allocateEntitySchema = z.object({
  entityId: z.string().min(1).max(128),
  nodeId: z.string().min(1).max(128),
  ownerServerId: z.string().min(1).max(128),
  allocationData: z.record(z.unknown()).optional(),
})

export const upsertLifecycleSchema = z.object({
  nodeId: z.string().min(1).max(128),
  lifecycleType: z.enum(['standard', 'rolling', 'graceful', 'forced', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  status: z.enum(['active', 'draining', 'stopped', 'failed']).optional(),
  lifecycleData: z.record(z.unknown()).optional(),
})

export const cleanupClusterSchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type RegisterNodeRequest    = z.infer<typeof registerNodeSchema>
export type StartDeploymentRequest = z.infer<typeof startDeploymentSchema>
export type StartScalingRequest    = z.infer<typeof startScalingSchema>
export type AllocateEntityRequest  = z.infer<typeof allocateEntitySchema>
export type UpsertLifecycleRequest = z.infer<typeof upsertLifecycleSchema>
export type CleanupClusterRequest  = z.infer<typeof cleanupClusterSchema>

// ── Phase 58: Global Persistence, Snapshot Compression & Long-Term State Recovery ──

export const createGlobalSnapshotSchema = z.object({
  snapshotType: z.enum(['full', 'incremental', 'differential', 'checkpoint', 'emergency', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  snapshotNonce: z.string().min(1).max(128),
  entityId: z.string().min(1).max(128).optional(),
  snapshotData: z.record(z.unknown()).optional(),
})

export const startCompressionSchema = z.object({
  snapshotId: z.string().min(1).max(128),
  compressionType: z.enum(['gzip', 'lz4', 'zstd', 'brotli', 'none', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  compressionNonce: z.string().min(1).max(128),
  compressionData: z.record(z.unknown()).optional(),
})

export const upsertPersistenceStateSchema = z.object({
  entityId: z.string().min(1).max(128),
  persistenceType: z.enum(['entity', 'world', 'session', 'cache', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  status: z.enum(['active', 'syncing', 'stale', 'error']).optional(),
  persistenceData: z.record(z.unknown()).optional(),
})

export const startLongtermRecoverySchema = z.object({
  recoveryType: z.enum(['point_in_time', 'snapshot', 'archive', 'full_restore', 'partial', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  recoveryNonce: z.string().min(1).max(128),
  entityId: z.string().min(1).max(128).optional(),
  recoveryData: z.record(z.unknown()).optional(),
})

export const createArchiveSchema = z.object({
  sourceSnapshotId: z.string().min(1).max(128),
  archiveType: z.enum(['cold', 'warm', 'compressed', 'offsite', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  archiveNonce: z.string().min(1).max(128),
  compressionType: z.string().min(1).max(32).optional(),
  archiveData: z.record(z.unknown()).optional(),
})

export const cleanupPersistenceSchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type CreateGlobalSnapshotRequest    = z.infer<typeof createGlobalSnapshotSchema>
export type StartCompressionRequest        = z.infer<typeof startCompressionSchema>
export type UpsertPersistenceStateRequest  = z.infer<typeof upsertPersistenceStateSchema>
export type StartLongtermRecoveryRequest   = z.infer<typeof startLongtermRecoverySchema>
export type CreateArchiveRequest           = z.infer<typeof createArchiveSchema>
export type CleanupPersistenceRequest      = z.infer<typeof cleanupPersistenceSchema>

// ── Phase 59: Federation, Multi-Region & Inter-Cluster Runtime ────────────────

export const registerFederationNodeSchema = z.object({
  nodeType:      z.enum(['game_server', 'api_server', 'edge_node', 'hub_node', 'relay_node', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  nodeNonce:     z.string().min(1).max(128),
  regionId:      z.string().min(1).max(128).optional(),
  address:       z.string().min(1).max(256).optional(),
  nodeData:      z.record(z.unknown()).optional(),
})

export const syncRegionSchema = z.object({
  regionId:      z.string().min(1).max(128),
  regionType:    z.enum(['primary', 'secondary', 'edge', 'backup', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  syncNonce:     z.string().min(1).max(128).optional(),
  regionData:    z.record(z.unknown()).optional(),
})

export const createInterclusterRouteSchema = z.object({
  sourceCluster: z.string().min(1).max(128),
  targetCluster: z.string().min(1).max(128),
  routeType:     z.enum(['direct', 'relay', 'failover', 'broadcast', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  routeNonce:    z.string().min(1).max(128),
  routeData:     z.record(z.unknown()).optional(),
})

export const claimFederationOwnershipSchema = z.object({
  entityId:       z.string().min(1).max(128),
  ownerClusterId: z.string().min(1).max(128),
  ownershipType:  z.enum(['exclusive', 'shared', 'leased', 'delegated', 'custom']),
  ownerServerId:  z.string().min(1).max(128),
  ownershipData:  z.record(z.unknown()).optional(),
})

export const transferFederationOwnershipSchema = z.object({
  entityId:      z.string().min(1).max(128),
  newClusterId:  z.string().min(1).max(128),
})

export const startConsistencyCheckSchema = z.object({
  regionId:      z.string().min(1).max(128),
  checkType:     z.enum(['hash', 'count', 'timestamp', 'full', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  checkNonce:    z.string().min(1).max(128),
  checkData:     z.record(z.unknown()).optional(),
})

export const cleanupFederationSchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type RegisterFederationNodeRequest      = z.infer<typeof registerFederationNodeSchema>
export type SyncRegionRequest                  = z.infer<typeof syncRegionSchema>
export type CreateInterclusterRouteRequest     = z.infer<typeof createInterclusterRouteSchema>
export type ClaimFederationOwnershipRequest    = z.infer<typeof claimFederationOwnershipSchema>
export type TransferFederationOwnershipRequest = z.infer<typeof transferFederationOwnershipSchema>
export type StartConsistencyCheckRequest       = z.infer<typeof startConsistencyCheckSchema>
export type CleanupFederationRequest           = z.infer<typeof cleanupFederationSchema>

// ── Phase 60: Advanced Runtime Security, Intrusion Response & Autonomous Protection ──

export const detectIntrusionSchema = z.object({
  intrusionType: z.enum(['unauthorized_access', 'rate_limit_breach', 'replay_attack', 'injection', 'tampering', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  intrusionNonce: z.string().min(1).max(128),
  entityId:      z.string().min(1).max(128).optional(),
  sourceNode:    z.string().min(1).max(256).optional(),
  intrusionData: z.record(z.unknown()).optional(),
})

export const detectThreatSchema = z.object({
  threatType:    z.enum(['botnet', 'exploit', 'dos', 'data_leak', 'privilege_escalation', 'custom']),
  severity:      z.enum(['low', 'medium', 'high', 'critical']),
  ownerServerId: z.string().min(1).max(128),
  threatNonce:   z.string().min(1).max(128),
  entityId:      z.string().min(1).max(128).optional(),
  threatData:    z.record(z.unknown()).optional(),
})

export const isolateEntitySchema = z.object({
  entityId:      z.string().min(1).max(128),
  isolationType: z.enum(['player', 'server', 'resource', 'session', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  isolationData: z.record(z.unknown()).optional(),
})

export const createEscalationSchema = z.object({
  escalationType: z.enum(['admin_review', 'automated_ban', 'service_isolation', 'emergency_shutdown', 'custom']),
  ownerServerId:  z.string().min(1).max(128),
  escalationNonce: z.string().min(1).max(128),
  entityId:       z.string().min(1).max(128).optional(),
  escalationData: z.record(z.unknown()).optional(),
})

export const createContainmentSchema = z.object({
  entityId:         z.string().min(1).max(128),
  containmentType:  z.enum(['block', 'throttle', 'isolate', 'terminate', 'custom']),
  ownerServerId:    z.string().min(1).max(128),
  containmentNonce: z.string().min(1).max(128),
  containmentData:  z.record(z.unknown()).optional(),
})

export const cleanupSecurityRuntimeSchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type DetectIntrusionRequest        = z.infer<typeof detectIntrusionSchema>
export type DetectThreatRequest           = z.infer<typeof detectThreatSchema>
export type IsolateEntityRequest          = z.infer<typeof isolateEntitySchema>
export type CreateEscalationRequest       = z.infer<typeof createEscalationSchema>
export type CreateContainmentRequest      = z.infer<typeof createContainmentSchema>
export type CleanupSecurityRuntimeRequest = z.infer<typeof cleanupSecurityRuntimeSchema>

// ── Phase 61: Autonomous Economy Regulation, Resource Balancing & Systemic Stabilization ──

export const createEconomyRegulationSchema = z.object({
  regulationType:  z.enum(['price_floor', 'price_ceiling', 'supply_cap', 'demand_cap', 'subsidy', 'custom']),
  ownerServerId:   z.string().min(1).max(128),
  regulationNonce: z.string().min(1).max(128),
  regionId:        z.string().min(1).max(128).optional(),
  regulationData:  z.record(z.unknown()).optional(),
  expiresAt:       z.string().datetime().optional(),
})

export const startResourceBalancingSchema = z.object({
  resourceType:    z.enum(['cash', 'goods', 'property', 'jobs', 'housing', 'custom']),
  ownerServerId:   z.string().min(1).max(128),
  balancingNonce:  z.string().min(1).max(128),
  targetRegionId:  z.string().min(1).max(128).optional(),
  balancingData:   z.record(z.unknown()).optional(),
})

export const upsertInflationSchema = z.object({
  regionId:       z.string().min(1).max(128),
  inflationRate:  z.number(),
  status:         z.enum(['stable', 'inflationary', 'deflationary', 'hyperinflationary']),
  ownerServerId:  z.string().min(1).max(128),
  inflationData:  z.record(z.unknown()).optional(),
})

export const upsertTaxRateSchema = z.object({
  regionId:      z.string().min(1).max(128),
  taxType:       z.enum(['income', 'sales', 'property', 'corporate', 'import', 'custom']),
  rate:          z.number().min(0).max(100),
  ownerServerId: z.string().min(1).max(128),
  taxData:       z.record(z.unknown()).optional(),
})

export const startMarketStabilizationSchema = z.object({
  marketType:          z.enum(['goods', 'services', 'real_estate', 'labor', 'financial', 'custom']),
  ownerServerId:       z.string().min(1).max(128),
  stabilizationNonce:  z.string().min(1).max(128),
  regionId:            z.string().min(1).max(128).optional(),
  stabilizationData:   z.record(z.unknown()).optional(),
})

export const cleanupEconomyRegulationSchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type CreateEconomyRegulationRequest   = z.infer<typeof createEconomyRegulationSchema>
export type StartResourceBalancingRequest    = z.infer<typeof startResourceBalancingSchema>
export type UpsertInflationRequest           = z.infer<typeof upsertInflationSchema>
export type UpsertTaxRateRequest             = z.infer<typeof upsertTaxRateSchema>
export type StartMarketStabilizationRequest  = z.infer<typeof startMarketStabilizationSchema>
export type CleanupEconomyRegulationRequest  = z.infer<typeof cleanupEconomyRegulationSchema>

// ── Phase 62: Autonomous Civilization, Governance & Political Runtime ────────

export const createGovernanceSchema = z.object({
  governanceId:    z.string().min(1).max(128),
  governanceType:  z.enum(['democracy', 'oligarchy', 'autocracy', 'federation', 'custom']),
  ownerServerId:   z.string().min(1).max(128),
  regionId:        z.string().min(1).max(128).optional(),
  governanceNonce: z.string().min(1).max(128),
  governanceData:  z.record(z.unknown()).optional(),
})

export const startElectionSchema = z.object({
  electionId:    z.string().min(1).max(128),
  electionType:  z.enum(['general', 'regional', 'emergency', 'referendum', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  regionId:      z.string().min(1).max(128),
  electionNonce: z.string().min(1).max(128),
  candidateData: z.record(z.unknown()).optional(),
})

export const closeElectionSchema = z.object({
  resultData: z.record(z.unknown()).optional(),
})

export const enactLegislationSchema = z.object({
  legislationId:    z.string().min(1).max(128),
  legislationType:  z.enum(['law', 'regulation', 'ordinance', 'decree', 'custom']),
  ownerServerId:    z.string().min(1).max(128),
  regionId:         z.string().min(1).max(128).optional(),
  legislationNonce: z.string().min(1).max(128),
  legislationData:  z.record(z.unknown()).optional(),
  enactedAt:        z.string().datetime().optional(),
  expiresAt:        z.string().datetime().optional(),
})

export const upsertCivicInfluenceSchema = z.object({
  entityId:        z.string().min(1).max(128),
  influenceType:   z.enum(['political', 'economic', 'social', 'military', 'custom']),
  influenceScore:  z.number(),
  ownerServerId:   z.string().min(1).max(128),
  regionId:        z.string().min(1).max(128).optional(),
  influenceData:   z.record(z.unknown()).optional(),
})

export const applyPolicySchema = z.object({
  policyId:    z.string().min(1).max(128),
  policyType:  z.enum(['economic', 'social', 'military', 'environmental', 'governance', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  regionId:    z.string().min(1).max(128).optional(),
  policyNonce: z.string().min(1).max(128),
  policyData:  z.record(z.unknown()).optional(),
  appliedAt:   z.string().datetime().optional(),
  expiresAt:   z.string().datetime().optional(),
})

export const cleanupGovernanceSchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type CreateGovernanceRequest      = z.infer<typeof createGovernanceSchema>
export type StartElectionRequest         = z.infer<typeof startElectionSchema>
export type CloseElectionRequest         = z.infer<typeof closeElectionSchema>
export type EnactLegislationRequest      = z.infer<typeof enactLegislationSchema>
export type UpsertCivicInfluenceRequest  = z.infer<typeof upsertCivicInfluenceSchema>
export type ApplyPolicyRequest           = z.infer<typeof applyPolicySchema>
export type CleanupGovernanceRequest     = z.infer<typeof cleanupGovernanceSchema>

// ── Phase 63: Deep Simulation Ecology, Resource Evolution & Environmental Persistence ──

export const createEcologySchema = z.object({
  ecologyType:   z.enum(['forest', 'ocean', 'desert', 'tundra', 'urban', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  regionId:      z.string().min(1).max(128).optional(),
  ecologyNonce:  z.string().min(1).max(128),
  ecologyData:   z.record(z.unknown()).optional(),
})

export const startEvolutionSchema = z.object({
  evolutionType:  z.enum(['climate_shift', 'biome_change', 'species_migration', 'pollution', 'restoration', 'custom']),
  ownerServerId:  z.string().min(1).max(128),
  regionId:       z.string().min(1).max(128).optional(),
  evolutionNonce: z.string().min(1).max(128),
  evolutionData:  z.record(z.unknown()).optional(),
})

export const startRegenerationSchema = z.object({
  resourceType:       z.enum(['flora', 'fauna', 'mineral', 'water', 'soil', 'custom']),
  ownerServerId:      z.string().min(1).max(128),
  regionId:           z.string().min(1).max(128).optional(),
  regenerationNonce:  z.string().min(1).max(128),
  regenerationData:   z.record(z.unknown()).optional(),
})

export const upsertClimateSchema = z.object({
  regionId:      z.string().min(1).max(128),
  climateType:   z.enum(['tropical', 'temperate', 'arctic', 'arid', 'continental', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  temperature:   z.number(),
  humidity:      z.number(),
  climateData:   z.record(z.unknown()).optional(),
})

export const upsertWildlifeSchema = z.object({
  zoneId:        z.string().min(1).max(128),
  wildlifeType:  z.enum(['predator', 'prey', 'scavenger', 'herbivore', 'marine', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  population:    z.number().int().nonnegative(),
  wildlifeData:  z.record(z.unknown()).optional(),
})

export const cleanupEcologySchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type CreateEcologyRequest      = z.infer<typeof createEcologySchema>
export type StartEvolutionRequest     = z.infer<typeof startEvolutionSchema>
export type StartRegenerationRequest  = z.infer<typeof startRegenerationSchema>
export type UpsertClimateRequest      = z.infer<typeof upsertClimateSchema>
export type UpsertWildlifeRequest     = z.infer<typeof upsertWildlifeSchema>
export type CleanupEcologyRequest     = z.infer<typeof cleanupEcologySchema>

// ── Phase 64: Meta-Orchestration, Runtime Self-Healing & Autonomous Infrastructure Coordination ──

export const registerMetaRuntimeSchema = z.object({
  metaType:      z.enum(['orchestrator', 'scheduler', 'balancer', 'watchdog', 'coordinator', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  metaNonce:     z.string().min(1).max(128),
  metaData:      z.record(z.unknown()).optional(),
})

export const startHealingSchema = z.object({
  healingType:   z.enum(['restart', 'failover', 'rollback', 'rebalance', 'patch', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  targetNode:    z.string().min(1).max(128),
  healingNonce:  z.string().min(1).max(128),
  healingData:   z.record(z.unknown()).optional(),
})

export const startRepairSchema = z.object({
  repairType:    z.enum(['data_repair', 'state_sync', 'schema_fix', 'consistency_check', 'index_rebuild', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  targetNode:    z.string().min(1).max(128),
  repairNonce:   z.string().min(1).max(128),
  repairData:    z.record(z.unknown()).optional(),
})

export const upsertAllocationSchema = z.object({
  entityId:        z.string().min(1).max(128),
  allocationType:  z.enum(['compute', 'memory', 'network', 'storage', 'process', 'custom']),
  ownerServerId:   z.string().min(1).max(128),
  allocationData:  z.record(z.unknown()).optional(),
})

export const upsertCoordinationSchema = z.object({
  nodeId:             z.string().min(1).max(128),
  coordinationType:   z.enum(['leader', 'follower', 'observer', 'standby', 'custom']),
  ownerServerId:      z.string().min(1).max(128),
  coordinationData:   z.record(z.unknown()).optional(),
})

export const cleanupMetaRuntimeSchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type RegisterMetaRuntimeRequest  = z.infer<typeof registerMetaRuntimeSchema>
export type StartHealingRequest         = z.infer<typeof startHealingSchema>
export type StartRepairRequest          = z.infer<typeof startRepairSchema>
export type UpsertAllocationRequest     = z.infer<typeof upsertAllocationSchema>
export type UpsertCoordinationRequest   = z.infer<typeof upsertCoordinationSchema>
export type CleanupMetaRuntimeRequest   = z.infer<typeof cleanupMetaRuntimeSchema>

// ── Phase 65: Universal Runtime Protocol, Inter-System Contracts & Runtime Federation APIs ──

export const registerProtocolSchema = z.object({
  protocolType:  z.enum(['negotiation', 'federation', 'bridge', 'handshake', 'contract', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  protocolNonce: z.string().min(1).max(128),
  protocolData:  z.record(z.unknown()).optional(),
})

export const registerContractSchema = z.object({
  contractType:    z.enum(['peer', 'subordinate', 'primary', 'relay', 'custom']),
  ownerServerId:   z.string().min(1).max(128),
  targetServerId:  z.string().min(1).max(128),
  contractNonce:   z.string().min(1).max(128),
  contractData:    z.record(z.unknown()).optional(),
  expiresAt:       z.string().datetime().optional(),
})

export const upsertRegistrySchema = z.object({
  nodeId:        z.string().min(1).max(128),
  entryType:     z.enum(['service', 'gateway', 'broker', 'proxy', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  endpointData:  z.record(z.unknown()).optional(),
})

export const initiateHandshakeSchema = z.object({
  handshakeType:   z.enum(['initiate', 'acknowledge', 'complete', 'reject', 'timeout', 'custom']),
  ownerServerId:   z.string().min(1).max(128),
  remoteServerId:  z.string().min(1).max(128),
  handshakeNonce:  z.string().min(1).max(128),
  handshakeData:   z.record(z.unknown()).optional(),
})

export const upsertBridgeSchema = z.object({
  bridgeId:       z.string().min(1).max(128),
  bridgeType:     z.enum(['grpc', 'http', 'websocket', 'tcp', 'custom']),
  ownerServerId:  z.string().min(1).max(128),
  remoteServerId: z.string().min(1).max(128),
  bridgeData:     z.record(z.unknown()).optional(),
})

export const cleanupProtocolSchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type RegisterProtocolRequest    = z.infer<typeof registerProtocolSchema>
export type RegisterContractRequest    = z.infer<typeof registerContractSchema>
export type UpsertRegistryRequest      = z.infer<typeof upsertRegistrySchema>
export type InitiateHandshakeRequest   = z.infer<typeof initiateHandshakeSchema>
export type UpsertBridgeRequest        = z.infer<typeof upsertBridgeSchema>
export type CleanupProtocolRequest     = z.infer<typeof cleanupProtocolSchema>

// ── Phase 66: Autonomous Runtime Evolution, Adaptive Optimization & Self-Tuning Infrastructure ──

export const startRuntimeEvolutionSchema = z.object({
  evolutionType:  z.enum(['schema', 'behavior', 'protocol', 'topology', 'config', 'custom']),
  ownerServerId:  z.string().min(1).max(128),
  evolutionNonce: z.string().min(1).max(128),
  evolutionData:  z.record(z.unknown()).optional(),
})

export const startOptimizationSchema = z.object({
  optimizationType:  z.enum(['cpu', 'memory', 'latency', 'throughput', 'concurrency', 'custom']),
  ownerServerId:     z.string().min(1).max(128),
  targetNode:        z.string().min(1).max(128),
  optimizationNonce: z.string().min(1).max(128),
  optimizationData:  z.record(z.unknown()).optional(),
})

export const upsertTuningSchema = z.object({
  entityId:      z.string().min(1).max(128),
  tuningType:    z.enum(['threshold', 'interval', 'capacity', 'priority', 'weight', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  tuningData:    z.record(z.unknown()).optional(),
})

export const triggerAutonomousEvolutionSchema = z.object({
  autonomousType:  z.enum(['self_heal', 'self_tune', 'self_scale', 'self_optimize', 'custom']),
  ownerServerId:   z.string().min(1).max(128),
  autonomousNonce: z.string().min(1).max(128),
  triggerData:     z.record(z.unknown()).optional(),
})

export const upsertDistributedOptSchema = z.object({
  nodeId:        z.string().min(1).max(128),
  optType:       z.enum(['load_balance', 'shard_rebalance', 'cache_warm', 'route_optimize', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  optData:       z.record(z.unknown()).optional(),
})

export const cleanupEvolutionSchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type StartRuntimeEvolutionRequest      = z.infer<typeof startRuntimeEvolutionSchema>
export type StartOptimizationRequest          = z.infer<typeof startOptimizationSchema>
export type UpsertTuningRequest               = z.infer<typeof upsertTuningSchema>
export type TriggerAutonomousEvolutionRequest = z.infer<typeof triggerAutonomousEvolutionSchema>
export type UpsertDistributedOptRequest       = z.infer<typeof upsertDistributedOptSchema>
export type CleanupEvolutionRequest           = z.infer<typeof cleanupEvolutionSchema>

// ── Phase 67: Final Distributed Consistency, Runtime Locking & Deterministic World Integrity ──

export const createIntegritySchema = z.object({
  integrityType:  z.enum(['checkpoint', 'snapshot', 'hash_verify', 'state_audit', 'consistency_check', 'custom']),
  ownerServerId:  z.string().min(1).max(128),
  integrityNonce: z.string().min(1).max(128),
  integrityData:  z.record(z.unknown()).optional(),
})

export const acquireLockSchema = z.object({
  resourceKey:    z.string().min(1).max(255),
  lockType:       z.enum(['exclusive', 'shared', 'advisory', 'intent', 'custom']),
  ownerServerId:  z.string().min(1).max(128),
  lockNonce:      z.string().min(1).max(128),
  expiresAt:      z.string().datetime().optional(),
  lockData:       z.record(z.unknown()).optional(),
})

export const upsertConsistencySchema = z.object({
  nodeId:           z.string().min(1).max(128),
  consistencyType:  z.enum(['eventual', 'strong', 'causal', 'sequential', 'custom']),
  ownerServerId:    z.string().min(1).max(128),
  consistencyData:  z.record(z.unknown()).optional(),
})

export const startValidationSchema = z.object({
  validationType:  z.enum(['world_state', 'entity_state', 'transaction', 'replication', 'custom']),
  ownerServerId:   z.string().min(1).max(128),
  targetId:        z.string().min(1).max(128).optional(),
  validationNonce: z.string().min(1).max(128),
  validationData:  z.record(z.unknown()).optional(),
})

export const startWorldReconciliationSchema = z.object({
  reconciliationType:  z.enum(['delta_sync', 'full_sync', 'conflict_resolve', 'merge', 'rollback', 'custom']),
  ownerServerId:       z.string().min(1).max(128),
  reconciliationNonce: z.string().min(1).max(128),
  reconciliationData:  z.record(z.unknown()).optional(),
})

export const cleanupIntegritySchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type CreateIntegrityRequest          = z.infer<typeof createIntegritySchema>
export type AcquireLockRequest              = z.infer<typeof acquireLockSchema>
export type UpsertConsistencyRequest        = z.infer<typeof upsertConsistencySchema>
export type StartValidationRequest          = z.infer<typeof startValidationSchema>
export type StartWorldReconciliationRequest = z.infer<typeof startWorldReconciliationSchema>
export type CleanupIntegrityRequest         = z.infer<typeof cleanupIntegritySchema>

// ── Phase 68: Unified Runtime Governance, Global Coordination & Cross-System Arbitration ──

export const createGovernanceDirectiveSchema = z.object({
  directiveType:  z.enum(['mandate', 'advisory', 'prohibition', 'emergency', 'custom']),
  ownerServerId:  z.string().min(1).max(128),
  directiveNonce: z.string().min(1).max(128),
  directiveData:  z.record(z.unknown()).optional(),
})

export const startArbitrationSchema = z.object({
  arbitrationType:  z.enum(['conflict', 'resource', 'authority', 'policy', 'custom']),
  ownerServerId:    z.string().min(1).max(128),
  arbitrationNonce: z.string().min(1).max(128),
  arbitrationData:  z.record(z.unknown()).optional(),
})

export const proposeConsensusSchema = z.object({
  consensusType:  z.enum(['raft', 'paxos', 'bft', 'simple_majority', 'unanimous', 'custom']),
  ownerServerId:  z.string().min(1).max(128),
  consensusNonce: z.string().min(1).max(128),
  consensusData:  z.record(z.unknown()).optional(),
})

export const upsertPolicySchema = z.object({
  policyId:      z.string().min(1).max(128),
  policyType:    z.enum(['resource', 'access', 'behavior', 'rate_limit', 'security', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  policyData:    z.record(z.unknown()).optional(),
})

export const claimGovernanceOwnershipSchema = z.object({
  resourceId:    z.string().min(1).max(128),
  ownershipType: z.enum(['exclusive', 'shared', 'leased', 'delegated', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  ownershipData: z.record(z.unknown()).optional(),
})

export const cleanupGovernanceRuntimeSchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type CreateGovernanceDirectiveRequest   = z.infer<typeof createGovernanceDirectiveSchema>
export type StartArbitrationRequest            = z.infer<typeof startArbitrationSchema>
export type ProposeConsensusRequest            = z.infer<typeof proposeConsensusSchema>
export type UpsertPolicyRequest                = z.infer<typeof upsertPolicySchema>
export type ClaimGovernanceOwnershipRequest    = z.infer<typeof claimGovernanceOwnershipSchema>
export type CleanupGovernanceRuntimeRequest    = z.infer<typeof cleanupGovernanceRuntimeSchema>

// ── Phase 69: Autonomous Runtime Continuity, Infinite Persistence & Temporal Recovery ──

export const createContinuitySchema = z.object({
  continuityType:  z.enum(['session', 'entity', 'world', 'system', 'custom']),
  ownerServerId:   z.string().min(1).max(128),
  continuityNonce: z.string().min(1).max(128),
  continuityData:  z.record(z.unknown()).optional(),
})

export const initiateTemporalRecoverySchema = z.object({
  recoveryType:      z.enum(['point_in_time', 'epoch_rollback', 'delta_replay', 'full_restore', 'custom']),
  ownerServerId:     z.string().min(1).max(128),
  recoveryNonce:     z.string().min(1).max(128),
  targetTimestamp:   z.string().datetime().optional(),
  recoveryData:      z.record(z.unknown()).optional(),
})

export const createCheckpointSchema = z.object({
  checkpointType:  z.enum(['entity', 'world', 'system', 'transaction', 'custom']),
  ownerServerId:   z.string().min(1).max(128),
  checkpointNonce: z.string().min(1).max(128),
  checkpointData:  z.record(z.unknown()).optional(),
})

export const upsertPersistenceNodeSchema = z.object({
  nodeId:          z.string().min(1).max(128),
  nodeType:        z.enum(['primary', 'replica', 'archive', 'cache', 'custom']),
  ownerServerId:   z.string().min(1).max(128),
  persistenceData: z.record(z.unknown()).optional(),
})

export const createTemporalIntegritySchema = z.object({
  integrityType:  z.enum(['timestamp', 'epoch', 'sequence', 'hash', 'custom']),
  ownerServerId:  z.string().min(1).max(128),
  integrityNonce: z.string().min(1).max(128),
  integrityData:  z.record(z.unknown()).optional(),
})

export const cleanupContinuitySchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type CreateContinuityRequest          = z.infer<typeof createContinuitySchema>
export type InitiateTemporalRecoveryRequest  = z.infer<typeof initiateTemporalRecoverySchema>
export type CreateCheckpointRequest          = z.infer<typeof createCheckpointSchema>
export type UpsertPersistenceNodeRequest     = z.infer<typeof upsertPersistenceNodeSchema>
export type CreateTemporalIntegrityRequest   = z.infer<typeof createTemporalIntegritySchema>
export type CleanupContinuityRequest         = z.infer<typeof cleanupContinuitySchema>

// ── Phase 70: Final Runtime Consolidation, Deterministic Simulation Closure & Production Lockdown ──

export const initiateLockdownSchema = z.object({
  lockdownType:  z.enum(['partial', 'full', 'emergency', 'maintenance', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  lockdownNonce: z.string().min(1).max(128),
  lockdownData:  z.record(z.unknown()).optional(),
})

export const startClosureSchema = z.object({
  closureType:  z.enum(['graceful', 'forced', 'scheduled', 'emergency', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  closureNonce: z.string().min(1).max(128),
  closureData:  z.record(z.unknown()).optional(),
})

export const createProductionIntegrityCheckSchema = z.object({
  integrityType:  z.enum(['pre_deployment', 'post_deployment', 'runtime', 'rollback', 'custom']),
  ownerServerId:  z.string().min(1).max(128),
  integrityNonce: z.string().min(1).max(128),
  integrityData:  z.record(z.unknown()).optional(),
})

export const applySealSchema = z.object({
  sealType:      z.enum(['immutable', 'readonly', 'checksum', 'signature', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  resourceId:    z.string().min(1).max(128),
  sealNonce:     z.string().min(1).max(128),
  sealData:      z.record(z.unknown()).optional(),
})

export const startFinalizationSchema = z.object({
  finalizationType:  z.enum(['transaction', 'epoch', 'session', 'world_state', 'custom']),
  ownerServerId:     z.string().min(1).max(128),
  finalizationNonce: z.string().min(1).max(128),
  finalizationData:  z.record(z.unknown()).optional(),
})

export const cleanupLockdownSchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type InitiateLockdownRequest               = z.infer<typeof initiateLockdownSchema>
export type StartClosureRequest                   = z.infer<typeof startClosureSchema>
export type CreateProductionIntegrityCheckRequest = z.infer<typeof createProductionIntegrityCheckSchema>
export type ApplySealRequest                      = z.infer<typeof applySealSchema>
export type StartFinalizationRequest              = z.infer<typeof startFinalizationSchema>
export type CleanupLockdownRequest                = z.infer<typeof cleanupLockdownSchema>

// ── Phase 71: Runtime Certification, Validation & Deterministic Compliance Enforcement ──

export const createCertificationSchema = z.object({
  certificationType:  z.enum(['runtime', 'compliance', 'validation', 'integrity', 'performance', 'custom']),
  ownerServerId:      z.string().min(1).max(128),
  certificationNonce: z.string().min(1).max(128),
  certificationData:  z.record(z.unknown()).optional(),
})

export const createValidationSchema = z.object({
  validationType:  z.enum(['state', 'transition', 'epoch', 'snapshot', 'replay', 'custom']),
  ownerServerId:   z.string().min(1).max(128),
  validationNonce: z.string().min(1).max(128),
  validationData:  z.record(z.unknown()).optional(),
})

export const createComplianceSchema = z.object({
  complianceType:  z.enum(['policy', 'regulatory', 'security', 'performance', 'behavioral', 'custom']),
  ownerServerId:   z.string().min(1).max(128),
  complianceNonce: z.string().min(1).max(128),
  complianceData:  z.record(z.unknown()).optional(),
})

export const createVerificationSchema = z.object({
  verificationType:  z.enum(['signature', 'hash', 'proof', 'attestation', 'audit', 'custom']),
  ownerServerId:     z.string().min(1).max(128),
  verificationNonce: z.string().min(1).max(128),
  verificationData:  z.record(z.unknown()).optional(),
})

export const upsertCertificationCoordinationSchema = z.object({
  coordinationId:   z.string().min(1).max(128),
  coordinationType: z.enum(['cross_system', 'distributed', 'federated', 'peer', 'custom']),
  ownerServerId:    z.string().min(1).max(128),
  coordinationData: z.record(z.unknown()).optional(),
})

export const cleanupCertificationSchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type CreateCertificationRequest               = z.infer<typeof createCertificationSchema>
export type CreateValidationRequest                  = z.infer<typeof createValidationSchema>
export type CreateComplianceRequest                  = z.infer<typeof createComplianceSchema>
export type CreateVerificationRequest                = z.infer<typeof createVerificationSchema>
export type UpsertCertificationCoordinationRequest   = z.infer<typeof upsertCertificationCoordinationSchema>
export type CleanupCertificationRequest              = z.infer<typeof cleanupCertificationSchema>

// ── Phase 72: Autonomous Runtime Sovereignty, Infinite Cluster Continuity & Global Runtime Finalization ──

export const establishSovereigntySchema = z.object({
  sovereigntyType:  z.enum(['absolute', 'delegated', 'shared', 'temporary', 'custom']),
  ownerServerId:    z.string().min(1).max(128),
  sovereigntyNonce: z.string().min(1).max(128),
  sovereigntyData:  z.record(z.unknown()).optional(),
})

export const registerClusterSchema = z.object({
  clusterId:      z.string().min(1).max(128),
  clusterType:    z.enum(['primary', 'replica', 'observer', 'arbiter', 'custom']),
  ownerServerId:  z.string().min(1).max(128),
  clusterData:    z.record(z.unknown()).optional(),
})

export const initiateAutonomousFinalizationSchema = z.object({
  finalizationType:  z.enum(['epoch', 'session', 'cluster', 'runtime', 'custom']),
  ownerServerId:     z.string().min(1).max(128),
  finalizationNonce: z.string().min(1).max(128),
  finalizationData:  z.record(z.unknown()).optional(),
})

export const initiateSuccessionSchema = z.object({
  successionType:  z.enum(['planned', 'emergency', 'failover', 'upgrade', 'custom']),
  ownerServerId:   z.string().min(1).max(128),
  successionNonce: z.string().min(1).max(128),
  targetServerId:  z.string().min(1).max(128).optional(),
  successionData:  z.record(z.unknown()).optional(),
})

export const upsertSovereigntyCoordinationSchema = z.object({
  coordinationId:   z.string().min(1).max(128),
  coordinationType: z.enum(['global', 'regional', 'cluster', 'peer', 'custom']),
  ownerServerId:    z.string().min(1).max(128),
  coordinationData: z.record(z.unknown()).optional(),
})

export const cleanupSovereigntySchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type EstablishSovereigntyRequest            = z.infer<typeof establishSovereigntySchema>
export type RegisterClusterRequest                 = z.infer<typeof registerClusterSchema>
export type InitiateAutonomousFinalizationRequest  = z.infer<typeof initiateAutonomousFinalizationSchema>
export type InitiateSuccessionRequest              = z.infer<typeof initiateSuccessionSchema>
export type UpsertSovereigntyCoordinationRequest   = z.infer<typeof upsertSovereigntyCoordinationSchema>
export type CleanupSovereigntyRequest              = z.infer<typeof cleanupSovereigntySchema>

// ── Phase 73: ATC Core Deterministic Runtime Completion & Permanent Production Seal ──

export const initiateCoreFinalizationSchema = z.object({
  finalizationType:  z.enum(['runtime', 'epoch', 'session', 'world', 'custom']),
  ownerServerId:     z.string().min(1).max(128),
  finalizationNonce: z.string().min(1).max(128),
  finalizationData:  z.record(z.unknown()).optional(),
})

export const createDeterministicSealingSchema = z.object({
  sealingType:  z.enum(['hash', 'merkle', 'signature', 'epoch', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  sealingNonce:  z.string().min(1).max(128),
  sealingData:   z.record(z.unknown()).optional(),
})

export const createProductionCompletionSchema = z.object({
  completionType:  z.enum(['graceful', 'forced', 'scheduled', 'emergency', 'custom']),
  ownerServerId:   z.string().min(1).max(128),
  completionNonce: z.string().min(1).max(128),
  completionData:  z.record(z.unknown()).optional(),
})

export const upsertFinalizationCoordinationSchema = z.object({
  coordinationId:   z.string().min(1).max(128),
  coordinationType: z.enum(['distributed', 'cascading', 'parallel', 'sequential', 'custom']),
  ownerServerId:    z.string().min(1).max(128),
  coordinationData: z.record(z.unknown()).optional(),
})

export const applyFinalSealSchema = z.object({
  sealType:      z.enum(['permanent', 'temporary', 'conditional', 'emergency', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  resourceId:    z.string().min(1).max(128),
  sealNonce:     z.string().min(1).max(128),
  sealData:      z.record(z.unknown()).optional(),
})

export const cleanupCoreFinalizationSchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type InitiateCoreFinalizationRequest       = z.infer<typeof initiateCoreFinalizationSchema>
export type CreateDeterministicSealingRequest     = z.infer<typeof createDeterministicSealingSchema>
export type CreateProductionCompletionRequest     = z.infer<typeof createProductionCompletionSchema>
export type UpsertFinalizationCoordinationRequest = z.infer<typeof upsertFinalizationCoordinationSchema>
export type ApplyFinalSealRequest                 = z.infer<typeof applyFinalSealSchema>
export type CleanupCoreFinalizationRequest        = z.infer<typeof cleanupCoreFinalizationSchema>

// ── Phase 74: Unified Runtime API Gateway ─────────────────────────────────────
export const createRuntimeGatewaySchema = z.object({
  gatewayType:   z.enum(['api', 'proxy', 'mesh', 'edge', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  gatewayNonce:  z.string().min(1).max(128),
  gatewayData:   z.record(z.unknown()).optional(),
})

export const syncAccessMeshSchema = z.object({
  meshId:        z.string().min(1).max(128),
  meshType:      z.enum(['overlay', 'underlay', 'hybrid', 'federated', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  meshData:      z.record(z.unknown()).optional(),
})

export const syncGatewayRoutingSchema = z.object({
  routingId:     z.string().min(1).max(128),
  routingType:   z.enum(['static', 'dynamic', 'weighted', 'failover', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  routingData:   z.record(z.unknown()).optional(),
})

export const createRuntimeExposureSchema = z.object({
  exposureType:  z.enum(['public', 'internal', 'restricted', 'federated', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  exposureNonce: z.string().min(1).max(128),
  exposureData:  z.record(z.unknown()).optional(),
})

export const createSurfaceProtectionSchema = z.object({
  protectionType:  z.enum(['firewall', 'rate_limit', 'auth_guard', 'circuit_breaker', 'custom']),
  ownerServerId:   z.string().min(1).max(128),
  protectionNonce: z.string().min(1).max(128),
  protectionData:  z.record(z.unknown()).optional(),
})

export const cleanupRuntimeGatewaySchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type CreateRuntimeGatewayRequest    = z.infer<typeof createRuntimeGatewaySchema>
export type SyncAccessMeshRequest          = z.infer<typeof syncAccessMeshSchema>
export type SyncGatewayRoutingRequest      = z.infer<typeof syncGatewayRoutingSchema>
export type CreateRuntimeExposureRequest   = z.infer<typeof createRuntimeExposureSchema>
export type CreateSurfaceProtectionRequest = z.infer<typeof createSurfaceProtectionSchema>
export type CleanupRuntimeGatewayRequest   = z.infer<typeof cleanupRuntimeGatewaySchema>

// ── Phase 75: Distributed Runtime Hardening ───────────────────────────────────
export const initiateRuntimeHardeningSchema = z.object({
  hardeningType:  z.enum(['immutable', 'encrypted', 'verified', 'sealed', 'custom']),
  ownerServerId:  z.string().min(1).max(128),
  hardeningNonce: z.string().min(1).max(128),
  hardeningData:  z.record(z.unknown()).optional(),
})

export const createImmutableSecuritySchema = z.object({
  securityType:  z.enum(['policy', 'rule', 'constraint', 'invariant', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  securityNonce: z.string().min(1).max(128),
  securityData:  z.record(z.unknown()).optional(),
})

export const createSecurityValidationSchema = z.object({
  validationType:  z.enum(['signature', 'hash', 'certificate', 'token', 'custom']),
  ownerServerId:   z.string().min(1).max(128),
  validationNonce: z.string().min(1).max(128),
  validationData:  z.record(z.unknown()).optional(),
})

export const createSealValidationSchema = z.object({
  sealType:             z.enum(['hash', 'merkle', 'signature', 'epoch', 'custom']),
  ownerServerId:        z.string().min(1).max(128),
  sealValidationNonce:  z.string().min(1).max(128),
  resourceId:           z.string().min(1).max(128),
  sealData:             z.record(z.unknown()).optional(),
})

export const createThreatMitigationSchema = z.object({
  mitigationType:  z.enum(['block', 'throttle', 'quarantine', 'alert', 'custom']),
  ownerServerId:   z.string().min(1).max(128),
  mitigationNonce: z.string().min(1).max(128),
  mitigationData:  z.record(z.unknown()).optional(),
})

export const cleanupRuntimeHardeningSchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type InitiateRuntimeHardeningRequest    = z.infer<typeof initiateRuntimeHardeningSchema>
export type CreateImmutableSecurityRequest     = z.infer<typeof createImmutableSecuritySchema>
export type CreateSecurityValidationRequest    = z.infer<typeof createSecurityValidationSchema>
export type CreateSealValidationRequest        = z.infer<typeof createSealValidationSchema>
export type CreateThreatMitigationRequest      = z.infer<typeof createThreatMitigationSchema>
export type CleanupRuntimeHardeningRequest     = z.infer<typeof cleanupRuntimeHardeningSchema>

// ── Phase 76: ATC Core Permanent Runtime Sustainment ─────────────────────────
export const initiateRuntimeSustainmentSchema = z.object({
  sustainmentType:  z.enum(['continuous', 'periodic', 'on_demand', 'emergency', 'custom']),
  ownerServerId:    z.string().min(1).max(128),
  sustainmentNonce: z.string().min(1).max(128),
  sustainmentData:  z.record(z.unknown()).optional(),
})

export const initiateInfiniteRecoverySchema = z.object({
  recoveryId:    z.string().min(1).max(128),
  recoveryType:  z.enum(['full', 'partial', 'incremental', 'snapshot', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  recoveryData:  z.record(z.unknown()).optional(),
})

export const scheduleAutonomousMaintenanceSchema = z.object({
  maintenanceType:  z.enum(['cleanup', 'optimization', 'repair', 'upgrade', 'custom']),
  ownerServerId:    z.string().min(1).max(128),
  maintenanceNonce: z.string().min(1).max(128),
  maintenanceData:  z.record(z.unknown()).optional(),
})

export const registerSustainmentNodeSchema = z.object({
  sustainmentNodeId: z.string().min(1).max(128),
  nodeType:          z.enum(['primary', 'secondary', 'observer', 'arbiter', 'custom']),
  ownerServerId:     z.string().min(1).max(128),
  nodeData:          z.record(z.unknown()).optional(),
})

export const createRuntimeLongevitySchema = z.object({
  longevityType:  z.enum(['checkpoint', 'snapshot', 'archive', 'milestone', 'custom']),
  ownerServerId:  z.string().min(1).max(128),
  longevityNonce: z.string().min(1).max(128),
  longevityData:  z.record(z.unknown()).optional(),
})

export const cleanupRuntimeSustainmentSchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type InitiateRuntimeSustainmentRequest    = z.infer<typeof initiateRuntimeSustainmentSchema>
export type InitiateInfiniteRecoveryRequest      = z.infer<typeof initiateInfiniteRecoverySchema>
export type ScheduleAutonomousMaintenanceRequest = z.infer<typeof scheduleAutonomousMaintenanceSchema>
export type RegisterSustainmentNodeRequest       = z.infer<typeof registerSustainmentNodeSchema>
export type CreateRuntimeLongevityRequest        = z.infer<typeof createRuntimeLongevitySchema>

// ── Phase 77: Developer Platform & SDK Stabilization ─────────────────────────
export const createDeveloperPlatformSchema = z.object({
  platformType:  z.enum(['sdk', 'plugin', 'extension', 'contract', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  platformNonce: z.string().min(1).max(128),
  platformData:  z.record(z.unknown()).optional(),
})

export const registerSdkSchema = z.object({
  sdkId:         z.string().min(1).max(128),
  sdkType:       z.enum(['core', 'plugin', 'runtime', 'integration', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  sdkData:       z.record(z.unknown()).optional(),
})

export const createPluginCompatibilitySchema = z.object({
  compatibilityType:  z.enum(['forward', 'backward', 'full', 'partial', 'custom']),
  ownerServerId:      z.string().min(1).max(128),
  compatibilityNonce: z.string().min(1).max(128),
  compatibilityData:  z.record(z.unknown()).optional(),
})

export const createExtensionRuntimeSchema = z.object({
  extensionType:  z.enum(['runtime', 'sdk', 'plugin', 'bridge', 'custom']),
  ownerServerId:  z.string().min(1).max(128),
  extensionNonce: z.string().min(1).max(128),
  extensionData:  z.record(z.unknown()).optional(),
})

export const createContractValidationSchema = z.object({
  contractType:  z.enum(['api', 'event', 'schema', 'interface', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  contractNonce: z.string().min(1).max(128),
  contractData:  z.record(z.unknown()).optional(),
})

export const cleanupDeveloperPlatformSchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type CreateDeveloperPlatformRequest  = z.infer<typeof createDeveloperPlatformSchema>
export type RegisterSdkRequest              = z.infer<typeof registerSdkSchema>
export type CreatePluginCompatibilityRequest = z.infer<typeof createPluginCompatibilitySchema>
export type CreateExtensionRuntimeRequest   = z.infer<typeof createExtensionRuntimeSchema>
export type CreateContractValidationRequest = z.infer<typeof createContractValidationSchema>
export type CleanupDeveloperPlatformRequest = z.infer<typeof cleanupDeveloperPlatformSchema>

// ── Phase 78: Production Deployment Governance & Release Coordination ─────────
export const initiateReleaseGovernanceSchema = z.object({
  governanceType: z.enum(['policy', 'compliance', 'review', 'approval', 'custom']),
  ownerServerId:  z.string().min(1).max(128),
  governanceNonce: z.string().min(1).max(128),
})

export const initiateProductionDeploymentSchema = z.object({
  deploymentId:   z.string().min(1).max(128),
  deploymentType: z.enum(['canary', 'blue_green', 'rolling', 'immediate', 'custom']),
  ownerServerId:  z.string().min(1).max(128),
  deploymentData: z.record(z.unknown()).optional(),
})

export const createReleaseValidationSchema = z.object({
  validationType:  z.enum(['smoke', 'integration', 'regression', 'acceptance', 'custom']),
  ownerServerId:   z.string().min(1).max(128),
  validationNonce: z.string().min(1).max(128),
})

export const initiateReleaseOrchestrationSchema = z.object({
  orchestrationId:   z.string().min(1).max(128),
  orchestrationType: z.enum(['sequential', 'parallel', 'staged', 'gated', 'custom']),
  ownerServerId:     z.string().min(1).max(128),
  orchestrationData: z.record(z.unknown()).optional(),
})

export const createGlobalReleaseSchema = z.object({
  releaseType:   z.enum(['major', 'minor', 'patch', 'hotfix', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  releaseNonce:  z.string().min(1).max(128),
})

export const cleanupReleaseGovernanceSchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type InitiateReleaseGovernanceRequest    = z.infer<typeof initiateReleaseGovernanceSchema>
export type InitiateProductionDeploymentRequest = z.infer<typeof initiateProductionDeploymentSchema>
export type CreateReleaseValidationRequest      = z.infer<typeof createReleaseValidationSchema>
export type InitiateReleaseOrchestrationRequest = z.infer<typeof initiateReleaseOrchestrationSchema>
export type CreateGlobalReleaseRequest          = z.infer<typeof createGlobalReleaseSchema>
export type CleanupReleaseGovernanceRequest     = z.infer<typeof cleanupReleaseGovernanceSchema>

// ── Phase 79: Final Deterministic Runtime Audit & Enterprise Readiness ────────
export const initiateEnterpriseReadinessSchema = z.object({
  readinessType:  z.enum(['technical', 'operational', 'security', 'compliance', 'custom']),
  ownerServerId:  z.string().min(1).max(128),
  readinessNonce: z.string().min(1).max(128),
})

export const createDeterministicAuditSchema = z.object({
  auditType:    z.enum(['state', 'transaction', 'event', 'consensus', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  auditNonce:   z.string().min(1).max(128),
})

export const createIntegrityVerificationSchema = z.object({
  verificationType: z.enum(['hash', 'signature', 'merkle', 'consensus', 'custom']),
  ownerServerId:    z.string().min(1).max(128),
  verificationNonce: z.string().min(1).max(128),
})

export const initiateProductionReadinessSchema = z.object({
  readinessCheckpointId: z.string().min(1).max(128),
  checkpointType:        z.enum(['pre_launch', 'canary', 'staged', 'final', 'custom']),
  ownerServerId:         z.string().min(1).max(128),
  readinessData:         z.record(z.unknown()).optional(),
})

export const registerAuditNodeSchema = z.object({
  auditNodeId:   z.string().min(1).max(128),
  nodeType:      z.enum(['primary', 'secondary', 'observer', 'arbiter', 'custom']),
  ownerServerId: z.string().min(1).max(128),
  auditNodeData: z.record(z.unknown()).optional(),
})

export const cleanupEnterpriseReadinessSchema = z.object({
  thresholdMs: z.number().int().positive(),
})

export type InitiateEnterpriseReadinessRequest   = z.infer<typeof initiateEnterpriseReadinessSchema>
export type CreateDeterministicAuditRequest      = z.infer<typeof createDeterministicAuditSchema>
export type CreateIntegrityVerificationRequest   = z.infer<typeof createIntegrityVerificationSchema>
export type InitiateProductionReadinessRequest   = z.infer<typeof initiateProductionReadinessSchema>
export type RegisterAuditNodeRequest             = z.infer<typeof registerAuditNodeSchema>
export type CleanupEnterpriseReadinessRequest    = z.infer<typeof cleanupEnterpriseReadinessSchema>
export type CleanupRuntimeSustainmentRequest     = z.infer<typeof cleanupRuntimeSustainmentSchema>
