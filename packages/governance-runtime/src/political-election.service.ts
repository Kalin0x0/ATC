import type { GovernanceRuntimeEventBus } from './governance-recovery.service.js'
import type { GovernanceAuditRepository } from './governance-audit.repository.js'
import type {
  AtcPoliticalElection,
  AtcElectionType,
} from './election.repository.js'
import { ElectionRepository } from './election.repository.js'
import { ElectionNotFoundError } from './errors.js'

export interface StartElectionParams {
  electionId: string
  electionType: AtcElectionType
  ownerServerId: string
  regionId: string
  electionNonce: string
  candidateData?: Record<string, unknown> | undefined
}

export class PoliticalElectionService {
  constructor(
    private readonly electionRepo: ElectionRepository,
    private readonly auditRepo: GovernanceAuditRepository,
    private readonly eventBus: GovernanceRuntimeEventBus,
  ) {}

  async startElection(params: StartElectionParams): Promise<AtcPoliticalElection> {
    const election = await this.electionRepo.create({
      electionId: params.electionId,
      electionType: params.electionType,
      ownerServerId: params.ownerServerId,
      regionId: params.regionId,
      electionNonce: params.electionNonce,
      candidateData: params.candidateData,
    })

    await this.auditRepo.append({
      eventType: 'governance:election:started',
      entityId: election.electionId,
      ownerServerId: election.ownerServerId,
      regionId: election.regionId,
      auditData: { electionType: election.electionType, nonce: election.electionNonce },
    })

    this.eventBus.emit('atc:governance:election:started', {
      id: election.id,
      electionId: election.electionId,
      electionType: election.electionType,
      ownerServerId: election.ownerServerId,
      regionId: election.regionId,
    }).catch(() => undefined)

    return election
  }

  async closeElection(id: string, resultData?: Record<string, unknown>): Promise<AtcPoliticalElection> {
    const election = await this.electionRepo.findById(id)
    if (!election) throw new ElectionNotFoundError(id)

    const updated = await this.electionRepo.updateStatus(id, 'closed', new Date(), resultData)

    await this.auditRepo.append({
      eventType: 'governance:election:closed',
      entityId: updated.electionId,
      ownerServerId: updated.ownerServerId,
      regionId: updated.regionId,
      auditData: { hasResultData: resultData !== undefined },
    })

    this.eventBus.emit('atc:governance:election:closed', {
      id: updated.id,
      electionId: updated.electionId,
      ownerServerId: updated.ownerServerId,
      regionId: updated.regionId,
      closedAt: updated.closedAt,
    }).catch(() => undefined)

    return updated
  }

  async cancelElection(id: string): Promise<AtcPoliticalElection> {
    const election = await this.electionRepo.findById(id)
    if (!election) throw new ElectionNotFoundError(id)

    const updated = await this.electionRepo.updateStatus(id, 'cancelled', new Date())

    await this.auditRepo.append({
      eventType: 'governance:election:cancelled',
      entityId: updated.electionId,
      ownerServerId: updated.ownerServerId,
      regionId: updated.regionId,
      auditData: { previousStatus: election.status },
    })

    this.eventBus.emit('atc:governance:election:cancelled', {
      id: updated.id,
      electionId: updated.electionId,
      ownerServerId: updated.ownerServerId,
      regionId: updated.regionId,
    }).catch(() => undefined)

    return updated
  }

  async getElection(id: string): Promise<AtcPoliticalElection | null> {
    return this.electionRepo.findById(id)
  }

  async listActiveElections(regionId?: string): Promise<AtcPoliticalElection[]> {
    return this.electionRepo.listActive(regionId)
  }
}
