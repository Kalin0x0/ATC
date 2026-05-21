import type { RuntimeIntrusionRepository, AtcRuntimeIntrusion, CreateIntrusionParams } from './runtime-intrusion.repository.js'
import type { SecurityAuditRepository } from './security-audit.repository.js'
import type { SecurityRuntimeEventBus } from './runtime-security-recovery.service.js'

export class RuntimeIntrusionDetectionService {
  constructor(
    private intrusionRepo: RuntimeIntrusionRepository,
    private auditRepo: SecurityAuditRepository,
    private eventBus: SecurityRuntimeEventBus,
  ) {}

  async detectIntrusion(params: CreateIntrusionParams): Promise<AtcRuntimeIntrusion> {
    const intrusion = await this.intrusionRepo.create(params)
    await this.auditRepo.append({
      eventType: 'intrusion_detected',
      entityId: intrusion.entityId ?? undefined,
      ownerServerId: intrusion.ownerServerId,
      auditData: { intrusionId: intrusion.id, intrusionType: intrusion.intrusionType },
    })
    this.eventBus.emit('atc:security:intrusion:detected', intrusion).catch(() => undefined)
    return intrusion
  }

  async resolveIntrusion(
    id: string,
    status: 'resolved' | 'false_positive' = 'resolved',
  ): Promise<AtcRuntimeIntrusion> {
    const intrusion = await this.intrusionRepo.updateStatus(id, status, new Date())
    await this.auditRepo.append({
      eventType: 'intrusion_resolved',
      entityId: intrusion.entityId ?? undefined,
      ownerServerId: intrusion.ownerServerId,
      auditData: { intrusionId: intrusion.id, status },
    })
    this.eventBus.emit('atc:security:intrusion:resolved', intrusion).catch(() => undefined)
    return intrusion
  }

  async getIntrusion(id: string): Promise<AtcRuntimeIntrusion | null> {
    return this.intrusionRepo.findById(id)
  }

  async listActiveIntrusions(ownerServerId?: string): Promise<AtcRuntimeIntrusion[]> {
    return this.intrusionRepo.listActive(ownerServerId)
  }
}
