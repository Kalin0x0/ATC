import type { AtcPermission } from './permission.js'
import type { AtcPluginCapability } from './plugin-runtime.js'

export type AtcPrincipalType = 'account' | 'service' | 'plugin' | 'system'

/** Trust level determines which capabilities a plugin is allowed to be granted. */
export type AtcPluginTrustLevel = 'internal' | 'trusted' | 'untrusted' | 'restricted'

/**
 * A Role is an immutable set of permissions, capabilities, and inheritance pointers.
 * Roles are resolved recursively (BFS) to compute effective permissions.
 */
export interface AtcRole {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly permissions: ReadonlyArray<AtcPermission>
  readonly capabilities: ReadonlyArray<AtcPluginCapability>
  /** Role IDs whose permissions are inherited by this role */
  readonly inherits: ReadonlyArray<string>
  /** Permissions explicitly denied by this role — overrides all allows */
  readonly denies: ReadonlyArray<AtcPermission>
}

/**
 * A Principal is a resolved runtime identity — an account, service, plugin, or system actor.
 * Permissions are evaluated via role inheritance + explicit grants/denies.
 */
export interface AtcPrincipal {
  readonly id: string
  readonly type: AtcPrincipalType
  /** Assigned role IDs (resolved by the authorization engine) */
  readonly roles: ReadonlyArray<string>
  /** Permissions granted directly to this principal (beyond roles) */
  readonly permissions: ReadonlyArray<AtcPermission>
  /** Capabilities granted directly to this principal */
  readonly capabilities: ReadonlyArray<AtcPluginCapability>
  /** Permissions explicitly denied for this principal — overrides all allows */
  readonly denies: ReadonlyArray<AtcPermission>
  /** For plugin-type principals: their trust level */
  readonly trustLevel?: AtcPluginTrustLevel
  /** Opaque, non-secret metadata */
  readonly metadata?: Record<string, string>
}

/** Scope of an authorization request (domain + optional resource ID) */
export interface AtcSecurityScope {
  readonly domain: string
  readonly resource?: string
  readonly instanceId?: string
}

/** Result of an authorization check */
export interface AtcAuthorizationResult {
  readonly authorized: boolean
  readonly reason: string
  readonly principalId: string
  readonly action: string
  /** Which role granted the permission (if applicable) */
  readonly matchedRole?: string
  /** True when denied by an explicit deny rule */
  readonly denied?: boolean
}

/** An immutable audit record describing a security-relevant action */
export interface AtcAuditEvent {
  readonly id: string
  readonly actorId: string
  readonly actorType: AtcPrincipalType
  readonly action: string
  readonly target: string | null
  readonly timestamp: string
  readonly sourceInstanceId: string | null
  readonly result: 'granted' | 'denied' | 'error'
  readonly metadata: Readonly<Record<string, unknown>>
}

// ── Phase 20 — Durable Identity Types ────────────────────────────────────────

export type PrincipalStatus = 'active' | 'disabled' | 'suspended'

/**
 * A principal record as stored in the database.
 * Use `AtcPrincipal` for runtime authorization checks.
 */
export interface StoredPrincipal {
  readonly id: string
  readonly type: AtcPrincipalType
  readonly status: PrincipalStatus
  readonly displayName: string
  readonly accountId: string | null
  readonly trustLevel: AtcPluginTrustLevel | null
  /** Direct permissions granted to this principal (beyond roles) */
  readonly directPermissions: ReadonlyArray<AtcPermission>
  /** Permissions explicitly denied for this principal */
  readonly directDenies: ReadonlyArray<AtcPermission>
  readonly metadata: Readonly<Record<string, string>> | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

/** A persistent role assignment linking a principal to a role */
export interface RoleAssignment {
  readonly id: string
  readonly principalId: string
  readonly roleId: string
  readonly assignedBy: string
  readonly assignedAt: Date
  readonly expiresAt: Date | null
}

/** A persistent capability grant linking a principal to a capability */
export interface CapabilityAssignment {
  readonly id: string
  readonly principalId: string
  readonly capability: string
  readonly grantedBy: string
  readonly grantedAt: Date
  readonly expiresAt: Date | null
}

/** A durable security event record written to the database */
export interface SecurityEventRecord {
  readonly id: string
  readonly actorId: string
  readonly actorType: AtcPrincipalType
  readonly action: string
  readonly target: string | null
  readonly result: 'granted' | 'denied' | 'error'
  readonly sourceInstanceId: string | null
  readonly metadata: Readonly<Record<string, unknown>> | null
  readonly createdAt: Date
}

/** Capabilities that are considered read-only (fail-open on cache miss) */
export const IAM_READ_ONLY_CAPABILITIES: ReadonlyArray<AtcPluginCapability> = [
  'inventory.read',
  'vitals.read',
  'status.read',
  'wallet.read',
  'events.subscribe',
  'admin.read',
  'ops.read',
  'cluster.read',
]

/** Trust level → maximum allowed capability categories */
export const IAM_TRUST_CAPABILITY_LIMITS: Readonly<Record<AtcPluginTrustLevel, ReadonlyArray<AtcPluginCapability>>> = {
  internal: [
    'inventory.read', 'inventory.write',
    'vitals.read', 'vitals.write',
    'status.read', 'status.write',
    'wallet.read', 'wallet.write',
    'events.publish', 'events.subscribe',
    'telemetry.write',
    'admin.read', 'admin.write',
    'tasks.enqueue', 'tasks.schedule',
    'ops.read', 'ops.write',
    'cluster.read', 'cluster.write',
    'plugin.reload',
    'economy.read', 'economy.write',
    'organization.manage',
    'invoice.issue', 'invoice.pay',
    'commerce.read', 'commerce.write',
    'jobs.read', 'jobs.write', 'jobs.assign', 'jobs.manage',
    'payroll.run',
  ],
  trusted: [
    'inventory.read', 'inventory.write',
    'vitals.read', 'vitals.write',
    'status.read', 'status.write',
    'wallet.read', 'wallet.write',
    'events.publish', 'events.subscribe',
    'telemetry.write',
    'tasks.enqueue', 'tasks.schedule',
    'ops.read',
    'cluster.read',
    'jobs.read',
    'commerce.read',
  ],
  untrusted: [
    'inventory.read',
    'vitals.read',
    'status.read',
    'events.subscribe',
    'telemetry.write',
  ],
  restricted: [
    'telemetry.write',
  ],
}
