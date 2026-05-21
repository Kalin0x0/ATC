import type {
  RegionalSimulationRepository,
  AtcRegionalSimulation,
  UpsertSimulationParams,
} from './regional-simulation.repository.js'
import type { WorldOrchestrationAuditRepository } from './world-orchestration-audit.repository.js'
import type { WorldOrchestratorEventBus } from './world-orchestrator.service.js'

export class RegionalSimulationService {
  constructor(
    private readonly simulationRepo: RegionalSimulationRepository,
    private readonly auditRepo: WorldOrchestrationAuditRepository,
    private readonly eventBus?: WorldOrchestratorEventBus | undefined,
  ) {}

  async startSimulation(params: UpsertSimulationParams): Promise<AtcRegionalSimulation> {
    const simulation = await this.simulationRepo.upsert(params)

    await this.auditRepo.record(
      simulation.regionId,
      'simulation:started',
      simulation.ownerServerId ?? undefined,
      { simulationType: simulation.simulationType },
    )

    this.eventBus
      ?.emit('atc:orchestrator:simulation:started', {
        regionId: simulation.regionId,
        simulationType: simulation.simulationType,
        ownerServerId: simulation.ownerServerId,
      })
      .catch(() => undefined)

    return simulation
  }

  async getSimulation(regionId: string): Promise<AtcRegionalSimulation | null> {
    return this.simulationRepo.findByRegionId(regionId)
  }

  async listActiveSimulations(): Promise<AtcRegionalSimulation[]> {
    return this.simulationRepo.listActive()
  }

  async stopSimulation(regionId: string): Promise<void> {
    await this.simulationRepo.deactivate(regionId)

    await this.auditRepo.record(regionId, 'simulation:stopped', undefined, { regionId })
  }
}
