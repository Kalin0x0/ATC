import type { RuntimeConsensusRepository, AtcRuntimeConsensus, AtcConsensusType } from './runtime-consensus.repository.js'
import type { GovernanceContinuityAuditRepository } from './governance-continuity-audit.repository.js'
import type { GlobalGovernanceEventBus } from './governance-continuity.service.js'

export interface ProposeConsensusParams {
  consensusType: AtcConsensusType
  ownerServerId: string
  consensusNonce: string
  consensusData?: Record<string, unknown> | undefined
}

export class RuntimeConsensusService {
  constructor(
    private repo: RuntimeConsensusRepository,
    private audit: GovernanceContinuityAuditRepository,
    private eventBus: GlobalGovernanceEventBus,
  ) {}

  async proposeConsensus(params: ProposeConsensusParams): Promise<AtcRuntimeConsensus> {
    const record = await this.repo.create({
      consensusType: params.consensusType,
      ownerServerId: params.ownerServerId,
      consensusNonce: params.consensusNonce,
      consensusData: params.consensusData,
    })
    await this.audit.append({
      eventType: 'consensus_proposed',
      directiveId: record.consensusId,
      ownerServerId: record.ownerServerId,
      auditData: { consensusType: record.consensusType },
    })
    this.eventBus.emit('atc:global-governance:consensus:proposed', { consensusId: record.consensusId }).catch(() => undefined)
    return record
  }

  async beginVoting(id: string): Promise<AtcRuntimeConsensus> {
    const record = await this.repo.updateStatus(id, 'voting')
    await this.audit.append({
      eventType: 'consensus_voting',
      directiveId: record.consensusId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:global-governance:consensus:voting', { consensusId: record.consensusId }).catch(() => undefined)
    return record
  }

  async commitConsensus(id: string): Promise<AtcRuntimeConsensus> {
    const record = await this.repo.updateStatus(id, 'committed', new Date())
    await this.audit.append({
      eventType: 'consensus_committed',
      directiveId: record.consensusId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:global-governance:consensus:committed', { consensusId: record.consensusId }).catch(() => undefined)
    return record
  }

  async abortConsensus(id: string): Promise<AtcRuntimeConsensus> {
    const record = await this.repo.updateStatus(id, 'aborted')
    await this.audit.append({
      eventType: 'consensus_aborted',
      directiveId: record.consensusId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:global-governance:consensus:aborted', { consensusId: record.consensusId }).catch(() => undefined)
    return record
  }

  async getConsensus(id: string): Promise<AtcRuntimeConsensus | null> {
    return this.repo.findById(id)
  }
}
