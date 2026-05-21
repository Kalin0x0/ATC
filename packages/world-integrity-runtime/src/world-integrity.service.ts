import type { WorldIntegrityRepository, AtcWorldIntegrity, AtcIntegrityType } from './world-integrity.repository.js'
import type { IntegrityAuditRepository } from './integrity-audit.repository.js'
import type { WorldIntegrityEventBus } from './integrity-recovery.service.js'

export interface CreateIntegrityServiceParams {
  integrityType: AtcIntegrityType
  ownerServerId: string
  integrityNonce: string
  integrityData?: Record<string, unknown> | undefined
}

export class WorldIntegrityService {
  constructor(
    private integrityRepo: WorldIntegrityRepository,
    private auditRepo: IntegrityAuditRepository,
    private eventBus: WorldIntegrityEventBus,
  ) {}

  async createIntegrity(params: CreateIntegrityServiceParams): Promise<AtcWorldIntegrity> {
    const record = await this.integrityRepo.create({
      integrityType: params.integrityType,
      ownerServerId: params.ownerServerId,
      integrityNonce: params.integrityNonce,
      integrityData: params.integrityData,
    })
    await this.auditRepo.append({
      eventType: 'integrity_created',
      integrityId: record.integrityId,
      ownerServerId: record.ownerServerId,
      auditData: { integrityType: record.integrityType },
    })
    this.eventBus.emit('atc:world-integrity:integrity:created', { integrityId: record.integrityId }).catch(() => undefined)
    return record
  }

  async verifyIntegrity(id: string, worldHash?: string | undefined): Promise<AtcWorldIntegrity> {
    const record = await this.integrityRepo.updateStatus(id, 'verified', new Date(), worldHash)
    await this.auditRepo.append({
      eventType: 'integrity_verified',
      integrityId: record.integrityId,
      ownerServerId: record.ownerServerId,
      auditData: { worldHash: worldHash ?? null },
    })
    this.eventBus.emit('atc:world-integrity:integrity:verified', { integrityId: record.integrityId }).catch(() => undefined)
    return record
  }

  async failIntegrity(id: string): Promise<AtcWorldIntegrity> {
    const record = await this.integrityRepo.updateStatus(id, 'failed')
    await this.auditRepo.append({
      eventType: 'integrity_failed',
      integrityId: record.integrityId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:world-integrity:integrity:failed', { integrityId: record.integrityId }).catch(() => undefined)
    return record
  }

  async markCorrupted(id: string): Promise<AtcWorldIntegrity> {
    const record = await this.integrityRepo.updateStatus(id, 'corrupted')
    await this.auditRepo.append({
      eventType: 'integrity_corrupted',
      integrityId: record.integrityId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:world-integrity:integrity:corrupted', { integrityId: record.integrityId }).catch(() => undefined)
    return record
  }

  async getIntegrity(id: string): Promise<AtcWorldIntegrity | null> {
    return this.integrityRepo.findById(id)
  }
}
