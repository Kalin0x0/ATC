import type { ThreatMitigationRepository, AtcThreatMitigation, AtcMitigationType } from './threat-mitigation.repository.js'
import type { HardeningAuditRepository } from './hardening-audit.repository.js'
import type { RuntimeHardeningEventBus } from './runtime-hardening.service.js'

export interface CreateThreatMitigationServiceParams {
  mitigationType: AtcMitigationType
  ownerServerId: string
  mitigationNonce: string
  mitigationData?: Record<string, unknown> | undefined
}

export class AutonomousThreatMitigationService {
  constructor(
    private readonly repo: ThreatMitigationRepository,
    private readonly audit: HardeningAuditRepository,
    private readonly bus: RuntimeHardeningEventBus
  ) {}

  async createMitigation(params: CreateThreatMitigationServiceParams): Promise<AtcThreatMitigation> {
    const record = await this.repo.create({
      mitigationType: params.mitigationType,
      ownerServerId: params.ownerServerId,
      mitigationNonce: params.mitigationNonce,
      mitigationData: params.mitigationData,
    })
    await this.audit.append(record.mitigationId, 'threat_mitigation.created', {
      mitigationType: record.mitigationType,
      ownerServerId: record.ownerServerId,
    })
    this.bus.emit('threat_mitigation.created', { mitigationId: record.mitigationId }).catch(() => undefined)
    return record
  }

  async beginMitigation(id: string): Promise<AtcThreatMitigation> {
    const record = await this.repo.updateStatus(id, 'mitigating')
    await this.audit.append(record.mitigationId, 'threat_mitigation.mitigating', {
      mitigationId: record.mitigationId,
    })
    this.bus.emit('threat_mitigation.mitigating', { mitigationId: record.mitigationId }).catch(() => undefined)
    return record
  }

  async completeMitigation(id: string): Promise<AtcThreatMitigation> {
    const record = await this.repo.updateStatus(id, 'mitigated', new Date())
    await this.audit.append(record.mitigationId, 'autonomous_threat_mitigated', {
      mitigationId: record.mitigationId,
    })
    this.bus.emit('autonomous_threat_mitigated', { mitigationId: record.mitigationId }).catch(() => undefined)
    return record
  }

  async failMitigation(id: string): Promise<AtcThreatMitigation> {
    const record = await this.repo.updateStatus(id, 'failed')
    await this.audit.append(record.mitigationId, 'threat_mitigation.failed', {
      mitigationId: record.mitigationId,
    })
    this.bus.emit('threat_mitigation.failed', { mitigationId: record.mitigationId }).catch(() => undefined)
    return record
  }

  async getMitigation(id: string): Promise<AtcThreatMitigation | null> {
    return this.repo.findById(id)
  }
}
