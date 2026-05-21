import type { RuntimeSealRepository, AtcRuntimeSeal, AtcSealType } from './runtime-seal.repository.js'
import type { LockdownAuditRepository } from './lockdown-audit.repository.js'
import type { RuntimeLockdownEventBus } from './lockdown-recovery.service.js'

export interface ApplySealParams {
  sealType: AtcSealType
  ownerServerId: string
  resourceId: string
  sealNonce: string
  sealData?: Record<string, unknown> | undefined
}

export class RuntimeSealService {
  constructor(
    private repo: RuntimeSealRepository,
    private auditRepo: LockdownAuditRepository,
    private eventBus: RuntimeLockdownEventBus,
  ) {}

  async applySeal(params: ApplySealParams): Promise<AtcRuntimeSeal> {
    const record = await this.repo.create({
      sealType: params.sealType,
      ownerServerId: params.ownerServerId,
      resourceId: params.resourceId,
      sealNonce: params.sealNonce,
      sealData: params.sealData,
    })
    await this.auditRepo.append({
      eventType: 'seal_applied',
      ownerServerId: record.ownerServerId,
      auditData: { sealId: record.sealId, sealType: record.sealType, resourceId: record.resourceId },
    })
    this.eventBus.emit('atc:lockdown:seal:applied', { sealId: record.sealId }).catch(() => undefined)
    return record
  }

  async verifySeal(id: string): Promise<AtcRuntimeSeal> {
    const record = await this.repo.updateStatus(id, 'verified', new Date())
    await this.auditRepo.append({
      eventType: 'seal_verified',
      ownerServerId: record.ownerServerId,
      auditData: { sealId: record.sealId },
    })
    this.eventBus.emit('atc:lockdown:seal:verified', { sealId: record.sealId }).catch(() => undefined)
    return record
  }

  async breakSeal(id: string): Promise<AtcRuntimeSeal> {
    const record = await this.repo.updateStatus(id, 'broken')
    await this.auditRepo.append({
      eventType: 'seal_broken',
      ownerServerId: record.ownerServerId,
      auditData: { sealId: record.sealId },
    })
    this.eventBus.emit('atc:lockdown:seal:broken', { sealId: record.sealId }).catch(() => undefined)
    return record
  }

  async expireSeal(id: string): Promise<AtcRuntimeSeal> {
    const record = await this.repo.updateStatus(id, 'expired')
    await this.auditRepo.append({
      eventType: 'seal_expired',
      ownerServerId: record.ownerServerId,
      auditData: { sealId: record.sealId },
    })
    this.eventBus.emit('atc:lockdown:seal:expired', { sealId: record.sealId }).catch(() => undefined)
    return record
  }

  async getSeal(id: string): Promise<AtcRuntimeSeal | null> {
    return this.repo.findById(id)
  }
}
