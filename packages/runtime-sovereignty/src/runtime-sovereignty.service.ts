import type {
  RuntimeSovereigntyRepository,
  AtcRuntimeSovereignty,
  AtcSovereigntyType,
} from './runtime-sovereignty.repository.js'
import type { SovereigntyAuditRepository } from './sovereignty-audit.repository.js'
import type { SovereigntyRuntimeEventBus } from './sovereignty-recovery.service.js'

export interface EstablishSovereigntyParams {
  sovereigntyType: AtcSovereigntyType
  ownerServerId: string
  sovereigntyNonce: string
  sovereigntyData?: Record<string, unknown> | undefined
}

export class RuntimeSovereigntyService {
  constructor(
    private repo: RuntimeSovereigntyRepository,
    private auditRepo: SovereigntyAuditRepository,
    private eventBus: SovereigntyRuntimeEventBus,
  ) {}

  async establishSovereignty(params: EstablishSovereigntyParams): Promise<AtcRuntimeSovereignty> {
    const record = await this.repo.create({
      sovereigntyType: params.sovereigntyType,
      ownerServerId: params.ownerServerId,
      sovereigntyNonce: params.sovereigntyNonce,
      sovereigntyData: params.sovereigntyData,
    })
    await this.auditRepo.append({
      eventType: 'sovereignty_establishing',
      sovereigntyId: record.sovereigntyId,
      ownerServerId: record.ownerServerId,
      auditData: { sovereigntyType: record.sovereigntyType },
    })
    this.eventBus.emit('atc:runtime-sovereignty:sovereignty:establishing', { sovereigntyId: record.sovereigntyId }).catch(() => undefined)
    return record
  }

  async confirmSovereignty(id: string): Promise<AtcRuntimeSovereignty> {
    const record = await this.repo.updateStatus(id, 'established', new Date())
    await this.auditRepo.append({
      eventType: 'sovereignty_established',
      sovereigntyId: record.sovereigntyId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:runtime-sovereignty:sovereignty:established', { sovereigntyId: record.sovereigntyId }).catch(() => undefined)
    return record
  }

  async challengeSovereignty(id: string): Promise<AtcRuntimeSovereignty> {
    const record = await this.repo.updateStatus(id, 'challenged')
    await this.auditRepo.append({
      eventType: 'sovereignty_challenged',
      sovereigntyId: record.sovereigntyId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:runtime-sovereignty:sovereignty:challenged', { sovereigntyId: record.sovereigntyId }).catch(() => undefined)
    return record
  }

  async revokeSovereignty(id: string): Promise<AtcRuntimeSovereignty> {
    const record = await this.repo.updateStatus(id, 'revoked')
    await this.auditRepo.append({
      eventType: 'sovereignty_revoked',
      sovereigntyId: record.sovereigntyId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:runtime-sovereignty:sovereignty:revoked', { sovereigntyId: record.sovereigntyId }).catch(() => undefined)
    return record
  }

  async expireSovereignty(id: string): Promise<AtcRuntimeSovereignty> {
    const record = await this.repo.updateStatus(id, 'expired')
    await this.auditRepo.append({
      eventType: 'sovereignty_expired',
      sovereigntyId: record.sovereigntyId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:runtime-sovereignty:sovereignty:expired', { sovereigntyId: record.sovereigntyId }).catch(() => undefined)
    return record
  }

  async getSovereignty(id: string): Promise<AtcRuntimeSovereignty | null> {
    return this.repo.findById(id)
  }
}
