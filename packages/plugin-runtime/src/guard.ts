import type { AtcPluginCapability } from '@atc/shared-types'
import { AtcPermissionDeniedError } from './types.js'

export const ATC_CAPABILITIES = [
  'inventory.read',
  'inventory.write',
  'vitals.read',
  'vitals.write',
  'status.read',
  'status.write',
  'wallet.read',
  'wallet.write',
  'events.publish',
  'events.subscribe',
  'telemetry.write',
  'admin.read',
  'admin.write',
  'tasks.enqueue',
  'tasks.schedule',
  'ops.read',
  'ops.write',
  'cluster.read',
  'cluster.write',
  'plugin.reload',
  'economy.read',
  'economy.write',
  'organization.manage',
  'invoice.issue',
  'invoice.pay',
  'commerce.read',
  'commerce.write',
  'jobs.read',
  'jobs.write',
  'jobs.assign',
  'jobs.manage',
  'payroll.run',
] as const satisfies readonly AtcPluginCapability[]

export function isValidCapability(value: string): value is AtcPluginCapability {
  return (ATC_CAPABILITIES as readonly string[]).includes(value)
}

export class AtcPluginPermissionGuard {
  private readonly _capabilities: ReadonlySet<AtcPluginCapability>

  constructor(capabilities: ReadonlyArray<string>) {
    const validated = new Set<AtcPluginCapability>()
    for (const cap of capabilities) {
      if (cap === '*') {
        throw new Error("Wildcard '*' is not allowed as a plugin capability")
      }
      if (!isValidCapability(cap)) {
        throw new Error(`Unknown plugin capability: '${cap}'`)
      }
      validated.add(cap)
    }
    this._capabilities = validated
  }

  hasPermission(capability: AtcPluginCapability): boolean {
    return this._capabilities.has(capability)
  }

  assertPermission(pluginId: string, capability: AtcPluginCapability): void {
    if (!this.hasPermission(capability)) {
      throw new AtcPermissionDeniedError(pluginId, capability)
    }
  }

  assertAnyPermission(pluginId: string, capabilities: AtcPluginCapability[]): void {
    const hasAny = capabilities.some((cap) => this.hasPermission(cap))
    if (!hasAny) {
      throw new AtcPermissionDeniedError(pluginId, capabilities[0] ?? 'unknown')
    }
  }

  list(): AtcPluginCapability[] {
    return Array.from(this._capabilities)
  }
}
