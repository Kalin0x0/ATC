import type { ProductionIntegrityRepository, AtcProductionIntegrity, AtcProductionIntegrityType } from './production-integrity.repository.js'
import type { LockdownAuditRepository } from './lockdown-audit.repository.js'
import type { RuntimeLockdownEventBus } from './lockdown-recovery.service.js'

export interface CreateIntegrityCheckParams {
  integrityType: AtcProductionIntegrityType
  ownerServerId: string
  integrityNonce: string
  integrityData?: Record<string, unknown> | undefined
}

export class ProductionIntegrityService {
  constructor(
    private repo: ProductionIntegrityRepository,
    private auditRepo: LockdownAuditRepository,
    private eventBus: RuntimeLockdownEventBus,
  ) {}

  async createIntegrityCheck(params: CreateIntegrityCheckParams): Promise<AtcProductionIntegrity> {
    const record = await this.repo.create({
      integrityType: params.integrityType,
      ownerServerId: params.ownerServerId,
      integrityNonce: params.integrityNonce,
      integrityData: params.integrityData,
    })
    await this.auditRepo.append({
      eventType: 'integrity_check_created',
      ownerServerId: record.ownerServerId,
      auditData: { integrityId: record.integrityId, integrityType: record.integrityType },
    })
    this.eventBus.emit('atc:lockdown:integrity:created', { integrityId: record.integrityId }).catch(() => undefined)
    return record
  }

  async beginRunning(id: string): Promise<AtcProductionIntegrity> {
    const record = await this.repo.updateStatus(id, 'running')
    await this.auditRepo.append({
      eventType: 'integrity_check_running',
      ownerServerId: record.ownerServerId,
      auditData: { integrityId: record.integrityId },
    })
    this.eventBus.emit('atc:lockdown:integrity:running', { integrityId: record.integrityId }).catch(() => undefined)
    return record
  }

  async passIntegrityCheck(id: string): Promise<AtcProductionIntegrity> {
    const record = await this.repo.updateStatus(id, 'passed', new Date())
    await this.auditRepo.append({
      eventType: 'integrity_check_passed',
      ownerServerId: record.ownerServerId,
      auditData: { integrityId: record.integrityId },
    })
    this.eventBus.emit('atc:lockdown:integrity:passed', { integrityId: record.integrityId }).catch(() => undefined)
    return record
  }

  async failIntegrityCheck(id: string): Promise<AtcProductionIntegrity> {
    const record = await this.repo.updateStatus(id, 'failed')
    await this.auditRepo.append({
      eventType: 'integrity_check_failed',
      ownerServerId: record.ownerServerId,
      auditData: { integrityId: record.integrityId },
    })
    this.eventBus.emit('atc:lockdown:integrity:failed', { integrityId: record.integrityId }).catch(() => undefined)
    return record
  }

  async getIntegrityCheck(id: string): Promise<AtcProductionIntegrity | null> {
    return this.repo.findById(id)
  }
}
