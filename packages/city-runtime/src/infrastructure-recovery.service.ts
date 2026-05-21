import type { AtcEventBus } from '@atc/events'
import type {
  InfrastructureFailureRepository,
  AtcInfrastructureFailure,
} from './infrastructure-failure.repository.js'
import type { CityInfrastructureRepository } from './city-infrastructure.repository.js'
import type { CityRuntimePool } from './pool.js'

export class InfrastructureRecoveryService {
  constructor(
    private readonly failureRepo: InfrastructureFailureRepository,
    private readonly infraRepo: CityInfrastructureRepository,
    private readonly pool: CityRuntimePool,
    private readonly eventBus: AtcEventBus | undefined,
  ) {}

  async recoverInfrastructure(
    failureId: string,
    recoveredByPrincipalId: string,
  ): Promise<AtcInfrastructureFailure> {
    // FOR UPDATE inside failureRepo.transition prevents double-recovery
    const failure = await this.failureRepo.transition(failureId, 'resolved', {
      recoveredByPrincipalId,
    })

    // Best-effort: update infra status to operational
    await this.infraRepo.updateStatus(failure.nodeId, 'operational')

    this.eventBus?.emit('atc:city:infrastructure_recovered', {
      failureId: failure.id,
      nodeId: failure.nodeId,
      recoveredByPrincipalId,
    }).catch(() => undefined)

    return failure
  }

  async listActiveFailures(): Promise<AtcInfrastructureFailure[]> {
    return this.failureRepo.listActive()
  }

  async cleanStaleFailures(olderThanHours: number): Promise<number> {
    return this.failureRepo.deleteStale(olderThanHours)
  }
}
