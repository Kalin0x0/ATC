import type { RuntimeIntrusionRepository } from './runtime-intrusion.repository.js'
import type { RuntimeThreatRepository } from './runtime-threat.repository.js'
import type { ThreatContainmentRepository } from './threat-containment.repository.js'
import type { SecurityAuditRepository } from './security-audit.repository.js'

export interface SecurityRuntimeEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export class RuntimeSecurityRecoveryService {
  constructor(
    private intrusionRepo: RuntimeIntrusionRepository,
    private threatRepo: RuntimeThreatRepository,
    private containmentRepo: ThreatContainmentRepository,
    private auditRepo: SecurityAuditRepository,
    private eventBus: SecurityRuntimeEventBus,
  ) {}

  async cleanupStale(thresholdMs: number): Promise<{ intrusions: number; threats: number; containments: number }> {
    const [intrusions, threats, containments] = await Promise.all([
      this.intrusionRepo.cleanupStale(thresholdMs),
      this.threatRepo.cleanupStale(thresholdMs),
      this.containmentRepo.cleanupStale(thresholdMs),
    ])
    await this.auditRepo.append({ eventType: 'cleanup_completed', auditData: { intrusions, threats, containments } })
    this.eventBus.emit('atc:security:cleanup:completed', { intrusions, threats, containments }).catch(() => undefined)
    return { intrusions, threats, containments }
  }
}
