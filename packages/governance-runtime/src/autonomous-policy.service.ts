import type { GovernanceRuntimeEventBus } from './governance-recovery.service.js'
import type { GovernanceAuditRepository } from './governance-audit.repository.js'
import type {
  AtcPolicyRuntime,
  AtcPolicyType,
} from './policy.repository.js'
import { PolicyRepository } from './policy.repository.js'
import { PolicyNotFoundError } from './errors.js'

export interface ApplyPolicyParams {
  policyId: string
  policyType: AtcPolicyType
  ownerServerId: string
  regionId?: string | null | undefined
  policyNonce: string
  policyData?: Record<string, unknown> | undefined
  appliedAt?: Date | undefined
  expiresAt?: Date | null | undefined
}

export class AutonomousPolicyService {
  constructor(
    private readonly policyRepo: PolicyRepository,
    private readonly auditRepo: GovernanceAuditRepository,
    private readonly eventBus: GovernanceRuntimeEventBus,
  ) {}

  async applyPolicy(params: ApplyPolicyParams): Promise<AtcPolicyRuntime> {
    const policy = await this.policyRepo.create({
      policyId: params.policyId,
      policyType: params.policyType,
      ownerServerId: params.ownerServerId,
      regionId: params.regionId,
      policyNonce: params.policyNonce,
      policyData: params.policyData,
      appliedAt: params.appliedAt,
      expiresAt: params.expiresAt,
    })

    await this.auditRepo.append({
      eventType: 'governance:policy:applied',
      entityId: policy.policyId,
      ownerServerId: policy.ownerServerId,
      regionId: policy.regionId ?? undefined,
      auditData: {
        policyType: policy.policyType,
        nonce: policy.policyNonce,
        expiresAt: policy.expiresAt,
      },
    })

    this.eventBus.emit('atc:governance:policy:applied', {
      id: policy.id,
      policyId: policy.policyId,
      policyType: policy.policyType,
      ownerServerId: policy.ownerServerId,
      regionId: policy.regionId,
    }).catch(() => undefined)

    return policy
  }

  async revokePolicy(id: string): Promise<AtcPolicyRuntime> {
    const policy = await this.policyRepo.findById(id)
    if (!policy) throw new PolicyNotFoundError(id)

    const updated = await this.policyRepo.updateStatus(id, 'revoked')

    await this.auditRepo.append({
      eventType: 'governance:policy:revoked',
      entityId: updated.policyId,
      ownerServerId: updated.ownerServerId,
      regionId: updated.regionId ?? undefined,
      auditData: { previousStatus: policy.status },
    })

    this.eventBus.emit('atc:governance:policy:revoked', {
      id: updated.id,
      policyId: updated.policyId,
      ownerServerId: updated.ownerServerId,
      regionId: updated.regionId,
    }).catch(() => undefined)

    return updated
  }

  async getPolicy(id: string): Promise<AtcPolicyRuntime | null> {
    return this.policyRepo.findById(id)
  }

  async listActivePolicies(ownerServerId?: string): Promise<AtcPolicyRuntime[]> {
    return this.policyRepo.listActive(ownerServerId)
  }
}
