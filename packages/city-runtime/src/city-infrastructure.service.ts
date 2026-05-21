import type { AtcEventBus } from '@atc/events'
import type { CityInfrastructureRepository, AtcCityInfrastructure, AtcInfrastructureType, AtcInfrastructureStatus } from './city-infrastructure.repository.js'
import type { InfrastructureFailureRepository, AtcInfrastructureFailure, ReportFailureParams } from './infrastructure-failure.repository.js'
import type { CityRuntimePool } from './pool.js'

export class CityInfrastructureService {
  constructor(
    private readonly infraRepo: CityInfrastructureRepository,
    private readonly failureRepo: InfrastructureFailureRepository,
    private readonly pool: CityRuntimePool,
    private readonly eventBus: AtcEventBus | undefined,
  ) {}

  async reportFailure(params: ReportFailureParams): Promise<AtcInfrastructureFailure> {
    // Idempotency: check if nonce already exists
    const existing = await this.failureRepo.findByNonce(params.failureNonce)
    if (existing !== null) {
      return existing
    }

    const failure = await this.failureRepo.create(params)

    // Drive infrastructure status to offline
    await this.infraRepo.updateStatus(params.nodeId, 'offline')

    this.eventBus?.emit('atc:city:infrastructure_failure', {
      failureId: failure.id,
      nodeId: failure.nodeId,
      failureType: failure.failureType,
      severity: failure.severity,
    }).catch(() => undefined)

    return failure
  }

  async getInfrastructure(nodeId: string): Promise<AtcCityInfrastructure | null> {
    return this.infraRepo.findByNodeId(nodeId)
  }

  async updateInfrastructureStatus(
    nodeId: string,
    nodeName: string,
    type: AtcInfrastructureType,
    status: AtcInfrastructureStatus,
    health: number,
  ): Promise<AtcCityInfrastructure> {
    return this.infraRepo.upsert(nodeId, nodeName, type, status, health)
  }

  async listDegraded(): Promise<AtcCityInfrastructure[]> {
    return this.infraRepo.listDegraded()
  }
}
