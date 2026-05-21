import type { SecurityEscalationRepository, AtcSecurityEscalation, CreateEscalationParams } from './security-escalation.repository.js'
import type { SecurityAuditRepository } from './security-audit.repository.js'
import type { SecurityRuntimeEventBus } from './runtime-security-recovery.service.js'

export class SecurityEscalationService {
  constructor(
    private escalationRepo: SecurityEscalationRepository,
    private auditRepo: SecurityAuditRepository,
    private eventBus: SecurityRuntimeEventBus,
  ) {}

  async escalate(params: CreateEscalationParams): Promise<AtcSecurityEscalation> {
    const escalation = await this.escalationRepo.create(params)
    await this.auditRepo.append({
      eventType: 'escalation_created',
      entityId: escalation.entityId ?? undefined,
      ownerServerId: escalation.ownerServerId,
      auditData: { escalationId: escalation.id, escalationType: escalation.escalationType },
    })
    this.eventBus.emit('atc:security:escalation:created', escalation).catch(() => undefined)
    return escalation
  }

  async resolveEscalation(id: string): Promise<AtcSecurityEscalation> {
    const escalation = await this.escalationRepo.updateStatus(id, 'resolved', new Date())
    await this.auditRepo.append({
      eventType: 'escalation_resolved',
      entityId: escalation.entityId ?? undefined,
      ownerServerId: escalation.ownerServerId,
      auditData: { escalationId: escalation.id },
    })
    this.eventBus.emit('atc:security:escalation:resolved', escalation).catch(() => undefined)
    return escalation
  }

  async getEscalation(id: string): Promise<AtcSecurityEscalation | null> {
    return this.escalationRepo.findById(id)
  }
}
