import type {
  AtcPrincipal,
  AtcRole,
  AtcPermission,
  AtcPluginCapability,
  AtcAuthorizationResult,
  AtcPluginTrustLevel,
} from '@atc/shared-types'
import { IAM_TRUST_CAPABILITY_LIMITS } from '@atc/shared-types'
import type { AtcTelemetryService } from '@atc/telemetry'

export interface AtcAuthorizationEngineOptions {
  telemetry?: AtcTelemetryService
}

/**
 * Deterministic, deny-by-default authorization engine.
 *
 * Evaluation order:
 *   1. Explicit deny on principal → DENIED (highest priority)
 *   2. Explicit deny in any resolved role → DENIED
 *   3. super_admin role → GRANTED (wildcard)
 *   4. Principal direct permission → GRANTED
 *   5. Resolved role permission (BFS with loop prevention) → GRANTED
 *   6. Default → DENIED
 */
export class AtcAuthorizationEngine {
  private readonly _roles: ReadonlyMap<string, AtcRole>
  private readonly _telemetry: AtcTelemetryService | undefined

  constructor(roles: ReadonlyArray<AtcRole>, options: AtcAuthorizationEngineOptions = {}) {
    const map = new Map<string, AtcRole>()
    for (const role of roles) {
      map.set(role.id, role)
    }
    this._roles = map
    this._telemetry = options.telemetry
  }

  authorize(principal: AtcPrincipal, permission: AtcPermission): AtcAuthorizationResult {
    const result = this._evaluate(principal, permission)
    if (result.authorized) {
      this._telemetry?.increment('security.auth_granted_total')
    } else {
      this._telemetry?.increment('security.auth_denied_total')
    }
    return result
  }

  authorizeCapability(
    principal: AtcPrincipal,
    capability: AtcPluginCapability,
  ): AtcAuthorizationResult {
    this._telemetry?.increment('security.capability_checks_total')

    // Trust level enforcement for plugin principals
    if (principal.type === 'plugin' && principal.trustLevel !== undefined) {
      const allowed = IAM_TRUST_CAPABILITY_LIMITS[principal.trustLevel]
      if (!allowed.includes(capability)) {
        this._telemetry?.increment('security.auth_denied_total')
        return {
          authorized: false,
          reason: `Trust level '${principal.trustLevel}' does not permit capability '${capability}'`,
          principalId: principal.id,
          action: capability,
          denied: true,
        }
      }
    }

    // Direct grant on principal
    if (principal.capabilities.includes(capability)) {
      this._telemetry?.increment('security.auth_granted_total')
      return {
        authorized: true,
        reason: `Capability '${capability}' granted directly to principal`,
        principalId: principal.id,
        action: capability,
      }
    }

    // Check resolved roles
    const effectiveRoles = this._resolveRoles(principal)
    for (const role of effectiveRoles) {
      if (role.capabilities.includes(capability)) {
        this._telemetry?.increment('security.auth_granted_total')
        return {
          authorized: true,
          reason: `Capability '${capability}' granted via role '${role.id}'`,
          principalId: principal.id,
          action: capability,
          matchedRole: role.id,
        }
      }
    }

    this._telemetry?.increment('security.auth_denied_total')
    return {
      authorized: false,
      reason: `Capability '${capability}' not granted`,
      principalId: principal.id,
      action: capability,
    }
  }

  resolvePermissions(principal: AtcPrincipal): ReadonlySet<AtcPermission> {
    const granted = new Set<AtcPermission>()
    const denied = new Set<AtcPermission>()

    // Collect explicit denies from principal
    for (const d of principal.denies) {
      denied.add(d)
    }

    // Collect from roles (BFS)
    const effectiveRoles = this._resolveRoles(principal)
    for (const role of effectiveRoles) {
      for (const d of role.denies) {
        denied.add(d)
      }
    }

    // Collect granted permissions (principal direct + role)
    for (const p of principal.permissions) {
      if (!denied.has(p)) granted.add(p)
    }
    for (const role of effectiveRoles) {
      for (const p of role.permissions) {
        if (!denied.has(p)) granted.add(p)
      }
    }

    return granted
  }

  resolveEffectiveRoles(principal: AtcPrincipal): ReadonlyArray<AtcRole> {
    return this._resolveRoles(principal)
  }

  isSuperAdmin(principal: AtcPrincipal): boolean {
    const roles = this._resolveRoles(principal)
    return roles.some((r) => r.id === 'super_admin')
  }

  /**
   * Check whether a principal's trust level permits the given capability.
   * Used to block plugin capability spoofing.
   */
  isCapabilityAllowedForTrustLevel(
    capability: AtcPluginCapability,
    trustLevel: AtcPluginTrustLevel,
  ): boolean {
    return (IAM_TRUST_CAPABILITY_LIMITS[trustLevel] as readonly string[]).includes(capability)
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private _evaluate(principal: AtcPrincipal, permission: AtcPermission): AtcAuthorizationResult {
    // 1. Explicit deny on principal (highest priority)
    if (principal.denies.includes(permission)) {
      return {
        authorized: false,
        reason: `Permission '${permission}' is explicitly denied for principal`,
        principalId: principal.id,
        action: permission,
        denied: true,
      }
    }

    const effectiveRoles = this._resolveRoles(principal)

    // 2. Explicit deny in any resolved role
    for (const role of effectiveRoles) {
      if (role.denies.includes(permission)) {
        return {
          authorized: false,
          reason: `Permission '${permission}' is explicitly denied by role '${role.id}'`,
          principalId: principal.id,
          action: permission,
          denied: true,
          matchedRole: role.id,
        }
      }
    }

    // 3. super_admin wildcard
    if (effectiveRoles.some((r) => r.id === 'super_admin')) {
      return {
        authorized: true,
        reason: 'super_admin has unrestricted access',
        principalId: principal.id,
        action: permission,
        matchedRole: 'super_admin',
      }
    }

    // 4. Direct permission on principal
    if (principal.permissions.includes(permission)) {
      return {
        authorized: true,
        reason: `Permission '${permission}' granted directly to principal`,
        principalId: principal.id,
        action: permission,
      }
    }

    // 5. Role-based permission
    for (const role of effectiveRoles) {
      if (role.permissions.includes(permission)) {
        return {
          authorized: true,
          reason: `Permission '${permission}' granted via role '${role.id}'`,
          principalId: principal.id,
          action: permission,
          matchedRole: role.id,
        }
      }
    }

    // 6. Default deny
    return {
      authorized: false,
      reason: `Permission '${permission}' not granted`,
      principalId: principal.id,
      action: permission,
    }
  }

  /** BFS role resolution — visits each role ID at most once (loop prevention). */
  private _resolveRoles(principal: AtcPrincipal): AtcRole[] {
    const visited = new Set<string>()
    const result: AtcRole[] = []
    const queue: string[] = [...principal.roles]

    while (queue.length > 0) {
      const id = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)

      const role = this._roles.get(id)
      if (!role) continue

      result.push(role)

      for (const parentId of role.inherits) {
        if (!visited.has(parentId)) {
          queue.push(parentId)
        }
      }
    }

    return result
  }
}
