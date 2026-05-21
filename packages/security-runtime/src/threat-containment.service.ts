import type { ThreatContainmentRepository, AtcThreatContainment, CreateContainmentParams } from './threat-containment.repository.js'
import type { SecurityAuditRepository } from './security-audit.repository.js'
import type { SecurityRuntimeEventBus } from './runtime-security-recovery.service.js'

export class ThreatContainmentService {
  constructor(
    private containmentRepo: ThreatContainmentRepository,
    private auditRepo: SecurityAuditRepository,
    private eventBus: SecurityRuntimeEventBus,
  ) {}

  async contain(params: CreateContainmentParams): Promise<AtcThreatContainment> {
    const containment = await this.containmentRepo.create(params)
    await this.auditRepo.append({
      eventType: 'containment_started',
      entityId: containment.entityId,
      ownerServerId: containment.ownerServerId,
      auditData: { containmentId: containment.id, containmentType: containment.containmentType },
    })
    this.eventBus.emit('atc:security:containment:started', containment).catch(() => undefined)
    return containment
  }

  async completeContainment(id: string): Promise<AtcThreatContainment> {
    const containment = await this.containmentRepo.updateStatus(id, 'completed', new Date())
    await this.auditRepo.append({
      eventType: 'containment_completed',
      entityId: containment.entityId,
      ownerServerId: containment.ownerServerId,
      auditData: { containmentId: containment.id },
    })
    this.eventBus.emit('atc:security:containment:completed', containment).catch(() => undefined)
    return containment
  }

  async failContainment(id: string): Promise<AtcThreatContainment> {
    const containment = await this.containmentRepo.updateStatus(id, 'failed')
    this.eventBus.emit('atc:security:containment:failed', containment).catch(() => undefined)
    return containment
  }

  async getContainment(id: string): Promise<AtcThreatContainment | null> {
    return this.containmentRepo.findById(id)
  }
}
