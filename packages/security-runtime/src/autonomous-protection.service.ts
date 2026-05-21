import type { RuntimeThreatRepository, AtcRuntimeThreat, CreateThreatParams } from './runtime-threat.repository.js'
import type { SecurityAuditRepository } from './security-audit.repository.js'
import type { SecurityRuntimeEventBus } from './runtime-security-recovery.service.js'

export class AutonomousProtectionService {
  constructor(
    private threatRepo: RuntimeThreatRepository,
    private auditRepo: SecurityAuditRepository,
    private eventBus: SecurityRuntimeEventBus,
  ) {}

  async detectThreat(params: CreateThreatParams): Promise<AtcRuntimeThreat> {
    const threat = await this.threatRepo.create(params)
    await this.auditRepo.append({
      eventType: 'threat_detected',
      entityId: threat.entityId ?? undefined,
      ownerServerId: threat.ownerServerId,
      auditData: { threatId: threat.id, threatType: threat.threatType, severity: threat.severity },
    })
    this.eventBus.emit('atc:security:threat:detected', threat).catch(() => undefined)
    return threat
  }

  async mitigateThreat(id: string): Promise<AtcRuntimeThreat> {
    const threat = await this.threatRepo.updateStatus(id, 'mitigated', new Date())
    await this.auditRepo.append({
      eventType: 'threat_mitigated',
      entityId: threat.entityId ?? undefined,
      ownerServerId: threat.ownerServerId,
      auditData: { threatId: threat.id },
    })
    this.eventBus.emit('atc:security:threat:mitigated', threat).catch(() => undefined)
    return threat
  }

  async getThreat(id: string): Promise<AtcRuntimeThreat | null> {
    return this.threatRepo.findById(id)
  }

  async listActiveThreats(ownerServerId?: string): Promise<AtcRuntimeThreat[]> {
    return this.threatRepo.listActive(ownerServerId)
  }
}
