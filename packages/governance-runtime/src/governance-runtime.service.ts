import type { GovernanceRuntimeEventBus } from './governance-recovery.service.js'
import type { GovernanceAuditRepository } from './governance-audit.repository.js'
import type {
  AtcGovernanceRuntime,
  AtcGovernanceType,
} from './governance-runtime.repository.js'
import { GovernanceRuntimeRepository } from './governance-runtime.repository.js'
import { GovernanceNotFoundError } from './errors.js'

export interface CreateGovernanceServiceParams {
  governanceId: string
  governanceType: AtcGovernanceType
  ownerServerId: string
  regionId?: string | null | undefined
  governanceNonce: string
  governanceData?: Record<string, unknown> | undefined
}

export class GovernanceRuntimeService {
  constructor(
    private readonly governanceRepo: GovernanceRuntimeRepository,
    private readonly auditRepo: GovernanceAuditRepository,
    private readonly eventBus: GovernanceRuntimeEventBus,
  ) {}

  async createGovernance(params: CreateGovernanceServiceParams): Promise<AtcGovernanceRuntime> {
    const governance = await this.governanceRepo.create({
      governanceId: params.governanceId,
      governanceType: params.governanceType,
      ownerServerId: params.ownerServerId,
      regionId: params.regionId,
      governanceNonce: params.governanceNonce,
      governanceData: params.governanceData,
    })

    await this.auditRepo.append({
      eventType: 'governance:created',
      governanceId: governance.governanceId,
      ownerServerId: governance.ownerServerId,
      regionId: governance.regionId ?? undefined,
      auditData: { governanceType: governance.governanceType, nonce: governance.governanceNonce },
    })

    this.eventBus.emit('atc:governance:created', {
      id: governance.id,
      governanceId: governance.governanceId,
      governanceType: governance.governanceType,
      ownerServerId: governance.ownerServerId,
      regionId: governance.regionId,
    }).catch(() => undefined)

    return governance
  }

  async suspendGovernance(id: string): Promise<AtcGovernanceRuntime> {
    const governance = await this.governanceRepo.findById(id)
    if (!governance) throw new GovernanceNotFoundError(id)

    const updated = await this.governanceRepo.updateStatus(id, 'suspended')

    await this.auditRepo.append({
      eventType: 'governance:suspended',
      governanceId: updated.governanceId,
      ownerServerId: updated.ownerServerId,
      regionId: updated.regionId ?? undefined,
      auditData: { previousStatus: governance.status },
    })

    this.eventBus.emit('atc:governance:suspended', {
      id: updated.id,
      governanceId: updated.governanceId,
      ownerServerId: updated.ownerServerId,
    }).catch(() => undefined)

    return updated
  }

  async getGovernance(id: string): Promise<AtcGovernanceRuntime | null> {
    return this.governanceRepo.findById(id)
  }

  async listActiveGovernances(ownerServerId?: string): Promise<AtcGovernanceRuntime[]> {
    return this.governanceRepo.listActive(ownerServerId)
  }
}
