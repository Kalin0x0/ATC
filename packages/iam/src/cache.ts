import type { AtcPrincipal, AtcPermission } from '@atc/shared-types'
import type { AtcTelemetryService } from '@atc/telemetry'

// Duck-typed Redis interface — no ioredis import
export interface IamCacheRedis {
  set(key: string, value: string, exMode: 'EX', ttl: number): Promise<unknown>
  get(key: string): Promise<string | null>
  del(key: string): Promise<unknown>
}

export interface ResolvedPermissions {
  permissions: ReadonlyArray<AtcPermission>
  roles: ReadonlyArray<string>
}

const DEFAULT_TTL = 300 // 5 minutes

/**
 * Redis-backed IAM cache.
 *
 * Fail-open policy:
 *   - Read-only permission checks: fail-open (cache miss is treated as unknown, caller decides)
 *   - The cache only stores/retrieves data — the fail-open/fail-closed policy is
 *     enforced by the engine caller, not the cache itself.
 *
 * Keys:
 *   atc:iam:principal:{id}  — serialized AtcPrincipal
 *   atc:iam:resolved:{id}   — resolved permissions + role IDs
 */
export class AtcIamCache {
  private readonly _redis: IamCacheRedis
  private readonly _ttlSeconds: number
  private readonly _telemetry: AtcTelemetryService | undefined

  constructor(
    redis: IamCacheRedis,
    options: { ttlSeconds?: number; telemetry?: AtcTelemetryService } = {},
  ) {
    this._redis = redis
    this._ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL
    this._telemetry = options.telemetry
  }

  async getPrincipal(id: string): Promise<AtcPrincipal | null> {
    try {
      const raw = await this._redis.get(`atc:iam:principal:${id}`)
      if (!raw) {
        this._telemetry?.increment('security.cache_misses_total')
        return null
      }
      const parsed: unknown = JSON.parse(raw)
      // Structural guard — corrupt or poisoned cache entries are treated as misses
      if (!_isValidPrincipalShape(parsed)) {
        this._telemetry?.increment('security.cache_misses_total')
        return null
      }
      this._telemetry?.increment('security.cache_hits_total')
      return parsed as AtcPrincipal
    } catch {
      this._telemetry?.increment('security.cache_misses_total')
      return null
    }
  }

  async setPrincipal(id: string, principal: AtcPrincipal, ttlSeconds?: number): Promise<void> {
    try {
      await this._redis.set(
        `atc:iam:principal:${id}`,
        JSON.stringify(principal),
        'EX',
        ttlSeconds ?? this._ttlSeconds,
      )
    } catch { /* fail-open */ }
  }

  async invalidatePrincipal(id: string): Promise<void> {
    try {
      await this._redis.del(`atc:iam:principal:${id}`)
      await this._redis.del(`atc:iam:resolved:${id}`)
    } catch { /* fail-open */ }
  }

  async getResolved(id: string): Promise<ResolvedPermissions | null> {
    try {
      const raw = await this._redis.get(`atc:iam:resolved:${id}`)
      if (!raw) {
        this._telemetry?.increment('security.cache_misses_total')
        return null
      }
      const parsed: unknown = JSON.parse(raw)
      if (!_isValidResolvedShape(parsed)) {
        this._telemetry?.increment('security.cache_misses_total')
        return null
      }
      this._telemetry?.increment('security.cache_hits_total')
      return parsed as ResolvedPermissions
    } catch {
      this._telemetry?.increment('security.cache_misses_total')
      return null
    }
  }

  async setResolved(
    id: string,
    data: ResolvedPermissions,
    ttlSeconds?: number,
  ): Promise<void> {
    try {
      await this._redis.set(
        `atc:iam:resolved:${id}`,
        JSON.stringify(data),
        'EX',
        ttlSeconds ?? this._ttlSeconds,
      )
    } catch { /* fail-open */ }
  }

  async invalidateResolved(id: string): Promise<void> {
    try {
      await this._redis.del(`atc:iam:resolved:${id}`)
    } catch { /* fail-open */ }
  }
}

// ── Private structural guards ─────────────────────────────────────────────────

function _isValidPrincipalShape(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Record<string, unknown>
  return (
    typeof p['id'] === 'string' && p['id'].length > 0 &&
    typeof p['type'] === 'string' &&
    Array.isArray(p['roles']) &&
    Array.isArray(p['permissions']) &&
    Array.isArray(p['capabilities']) &&
    Array.isArray(p['denies'])
  )
}

function _isValidResolvedShape(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return Array.isArray(r['permissions']) && Array.isArray(r['roles'])
}
