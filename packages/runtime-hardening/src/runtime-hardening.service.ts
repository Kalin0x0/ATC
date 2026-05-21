import type { RuntimeHardeningRepository, AtcRuntimeHardening, AtcHardeningType } from './runtime-hardening.repository.js'
import type { HardeningAuditRepository } from './hardening-audit.repository.js'

export interface RuntimeHardeningEventBus {
  emit(event: string, data: Record<string, unknown>): Promise<void>
}

export interface InitiateHardeningParams {
  hardeningType: AtcHardeningType
  ownerServerId: string
  hardeningNonce: string
  hardeningData?: Record<string, unknown> | undefined
}

export class RuntimeHardeningService {
  constructor(
    private readonly repo: RuntimeHardeningRepository,
    private readonly audit: HardeningAuditRepository,
    private readonly bus: RuntimeHardeningEventBus
  ) {}

  async initiateHardening(params: InitiateHardeningParams): Promise<AtcRuntimeHardening> {
    const record = await this.repo.create({
      hardeningType: params.hardeningType,
      ownerServerId: params.ownerServerId,
      hardeningNonce: params.hardeningNonce,
      hardeningData: params.hardeningData,
    })
    await this.audit.append(record.hardeningId, 'hardening.initiated', {
      hardeningType: record.hardeningType,
      ownerServerId: record.ownerServerId,
    })
    this.bus.emit('hardening.initiated', { hardeningId: record.hardeningId }).catch(() => undefined)
    return record
  }

  async hardenRuntime(id: string): Promise<AtcRuntimeHardening> {
    const record = await this.repo.updateStatus(id, 'hardened', new Date())
    await this.audit.append(record.hardeningId, 'immutable_hardening_verified', {
      hardeningId: record.hardeningId,
    })
    this.bus.emit('immutable_hardening_verified', { hardeningId: record.hardeningId }).catch(() => undefined)
    return record
  }

  async beginHardening(id: string): Promise<AtcRuntimeHardening> {
    const record = await this.repo.updateStatus(id, 'hardening')
    await this.audit.append(record.hardeningId, 'hardening.begun', {
      hardeningId: record.hardeningId,
    })
    this.bus.emit('hardening.begun', { hardeningId: record.hardeningId }).catch(() => undefined)
    return record
  }

  async violateHardening(id: string): Promise<AtcRuntimeHardening> {
    const record = await this.repo.updateStatus(id, 'violated')
    await this.audit.append(record.hardeningId, 'hardening.violated', {
      hardeningId: record.hardeningId,
    })
    this.bus.emit('hardening.violated', { hardeningId: record.hardeningId }).catch(() => undefined)
    return record
  }

  async failHardening(id: string): Promise<AtcRuntimeHardening> {
    const record = await this.repo.updateStatus(id, 'failed')
    await this.audit.append(record.hardeningId, 'hardening.failed', {
      hardeningId: record.hardeningId,
    })
    this.bus.emit('hardening.failed', { hardeningId: record.hardeningId }).catch(() => undefined)
    return record
  }

  async getHardening(id: string): Promise<AtcRuntimeHardening | null> {
    return this.repo.findById(id)
  }
}
