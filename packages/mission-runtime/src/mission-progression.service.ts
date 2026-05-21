import type { AtcEventBus } from '@atc/events'
import type { MissionRepository } from './mission.repository.js'
import type { MissionObjectiveRepository } from './mission-objective.repository.js'
import type { MissionAuditRepository } from './mission-audit.repository.js'

export class MissionProgressionService {
  constructor(
    private readonly missionRepo: MissionRepository,
    private readonly objectiveRepo: MissionObjectiveRepository,
    private readonly auditRepo: MissionAuditRepository,
    private readonly eventBus?: AtcEventBus,
  ) {}

  async progressMission(missionId: string, objectiveId: string): Promise<void> {
    // Complete the objective
    await this.objectiveRepo.transition(objectiveId, 'completed')
    await this.auditRepo.record(objectiveId, 'objective', 'completed', undefined, `mission:${missionId}`)
    this.eventBus
      ?.emit('atc:mission:objective:completed', { objectiveId })
      .catch(() => undefined)

    // Check if all objectives for the mission are complete
    const objectives = await this.objectiveRepo.listByMission(missionId)
    const allComplete = objectives.length > 0 && objectives.every(
      (o) => o.status === 'completed' || o.status === 'skipped',
    )

    if (allComplete) {
      await this.missionRepo.transition(missionId, 'completed')
      await this.auditRepo.record(missionId, 'mission', 'auto_completed', undefined, 'all_objectives_complete')
      this.eventBus
        ?.emit('atc:mission:completed', { missionId })
        .catch(() => undefined)
    }
  }
}
