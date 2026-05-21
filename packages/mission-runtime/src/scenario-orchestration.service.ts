import type { AtcEventBus } from '@atc/events'
import type {
  ScenarioRuntimeRepository,
  AtcScenarioRuntime,
  UpsertScenarioParams,
} from './scenario-runtime.repository.js'
import type { MissionAuditRepository } from './mission-audit.repository.js'
import { ScenarioNotFoundError } from './errors.js'

export class ScenarioOrchestrationService {
  constructor(
    private readonly scenarioRepo: ScenarioRuntimeRepository,
    private readonly auditRepo: MissionAuditRepository,
    private readonly eventBus?: AtcEventBus,
  ) {}

  async registerScenario(params: UpsertScenarioParams): Promise<AtcScenarioRuntime> {
    const scenario = await this.scenarioRepo.upsert(params)
    await this.auditRepo.record(scenario.scenarioId, 'scenario', 'registered')
    this.eventBus
      ?.emit('atc:mission:scenario:spawned', { scenarioId: scenario.scenarioId })
      .catch(() => undefined)
    return scenario
  }

  async tickScenario(scenarioId: string): Promise<AtcScenarioRuntime> {
    const existing = await this.scenarioRepo.findById(scenarioId)
    if (!existing) {
      throw new ScenarioNotFoundError(scenarioId)
    }
    const scenario = await this.scenarioRepo.upsert({
      scenarioId: existing.scenarioId,
      scenarioType: existing.scenarioType,
      status: existing.status,
      ...(existing.missionId !== null ? { missionId: existing.missionId } : {}),
      configData: existing.configData,
      ...(existing.ownerServerId !== null ? { ownerServerId: existing.ownerServerId } : {}),
    })
    return scenario
  }

  async completeScenario(scenarioId: string): Promise<AtcScenarioRuntime> {
    const scenario = await this.scenarioRepo.transition(scenarioId, 'completed')
    await this.auditRepo.record(scenarioId, 'scenario', 'completed')
    return scenario
  }

  async cleanupStaleScenarios(thresholdMs: number): Promise<void> {
    const stale = await this.scenarioRepo.listStale(thresholdMs)
    for (const scenario of stale) {
      await this.scenarioRepo.deleteById(scenario.scenarioId)
      await this.auditRepo.record(scenario.scenarioId, 'scenario', 'stale_cleaned')
    }
  }
}
