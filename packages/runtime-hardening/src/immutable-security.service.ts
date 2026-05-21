import type { ImmutableSecurityRepository, AtcImmutableSecurity, CreateImmutableSecurityParams } from './immutable-security.repository.js'
import type { HardeningAuditRepository } from './hardening-audit.repository.js'
import type { RuntimeHardeningEventBus } from './runtime-hardening.service.js'

export class ImmutableSecurityCoordinator {
  constructor(
    private readonly repo: ImmutableSecurityRepository,
    private readonly audit: HardeningAuditRepository,
    private readonly bus: RuntimeHardeningEventBus
  ) {}

  async createSecurity(params: CreateImmutableSecurityParams): Promise<AtcImmutableSecurity> {
    const record = await this.repo.create({
      securityType: params.securityType,
      ownerServerId: params.ownerServerId,
      securityNonce: params.securityNonce,
      securityData: params.securityData,
    })
    await this.audit.append(record.securityId, 'immutable_security.created', {
      securityType: record.securityType,
      ownerServerId: record.ownerServerId,
    })
    this.bus.emit('immutable_security.created', { securityId: record.securityId }).catch(() => undefined)
    return record
  }

  async enforcePolicy(id: string): Promise<AtcImmutableSecurity> {
    const record = await this.repo.updateStatus(id, 'active', new Date())
    await this.audit.append(record.securityId, 'immutable_hardening_verified', {
      securityId: record.securityId,
    })
    this.bus.emit('immutable_hardening_verified', { securityId: record.securityId }).catch(() => undefined)
    return record
  }

  async violateSecurity(id: string): Promise<AtcImmutableSecurity> {
    const record = await this.repo.updateStatus(id, 'violated')
    await this.audit.append(record.securityId, 'immutable_security.violated', {
      securityId: record.securityId,
    })
    this.bus.emit('immutable_security.violated', { securityId: record.securityId }).catch(() => undefined)
    return record
  }

  async expireSecurity(id: string): Promise<AtcImmutableSecurity> {
    const record = await this.repo.updateStatus(id, 'expired')
    await this.audit.append(record.securityId, 'immutable_security.expired', {
      securityId: record.securityId,
    })
    this.bus.emit('immutable_security.expired', { securityId: record.securityId }).catch(() => undefined)
    return record
  }

  async getSecurity(id: string): Promise<AtcImmutableSecurity | null> {
    return this.repo.findById(id)
  }
}
