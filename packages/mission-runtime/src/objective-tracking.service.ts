import type { AtcEventBus } from '@atc/events'
import type {
  MissionObjectiveRepository,
  AtcMissionObjective,
  CreateObjectiveParams,
} from './mission-objective.repository.js'
import type { MissionAuditRepository } from './mission-audit.repository.js'

export class ObjectiveTrackingService {
  constructor(
    private readonly objectiveRepo: MissionObjectiveRepository,
    private readonly auditRepo: MissionAuditRepository,
    private readonly eventBus?: AtcEventBus,
  ) {}

  async createObjective(params: CreateObjectiveParams): Promise<AtcMissionObjective> {
    const objective = await this.objectiveRepo.create(params)
    await this.auditRepo.record(objective.objectiveId, 'objective', 'created')
    return objective
  }

  async activateObjective(objectiveId: string): Promise<AtcMissionObjective> {
    const objective = await this.objectiveRepo.transition(objectiveId, 'active')
    await this.auditRepo.record(objectiveId, 'objective', 'activated')
    return objective
  }

  async completeObjective(objectiveId: string): Promise<AtcMissionObjective> {
    const objective = await this.objectiveRepo.transition(objectiveId, 'completed')
    await this.auditRepo.record(objectiveId, 'objective', 'completed')
    this.eventBus
      ?.emit('atc:mission:objective:completed', { objectiveId })
      .catch(() => undefined)
    return objective
  }

  async failObjective(objectiveId: string): Promise<AtcMissionObjective> {
    const objective = await this.objectiveRepo.transition(objectiveId, 'failed')
    await this.auditRepo.record(objectiveId, 'objective', 'failed')
    return objective
  }

  async listByMission(missionId: string): Promise<AtcMissionObjective[]> {
    return this.objectiveRepo.listByMission(missionId)
  }
}
