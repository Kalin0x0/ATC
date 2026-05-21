import type { MissionRepository } from './mission.repository.js'
import type { ScenarioRuntimeRepository } from './scenario-runtime.repository.js'
import type { MissionAuditRepository } from './mission-audit.repository.js'

export class MissionCleanupService {
  constructor(
    private readonly missionRepo: MissionRepository,
    private readonly scenarioRepo: ScenarioRuntimeRepository,
    private readonly auditRepo: MissionAuditRepository,
  ) {}

  async cleanupStaleMissions(thresholdMs: number): Promise<void> {
    const stale = await this.missionRepo.listStale(thresholdMs)
    for (const mission of stale) {
      await this.missionRepo.transition(mission.missionId, 'failed')
      await this.auditRepo.record(
        mission.missionId,
        'mission',
        'stale_failed',
        undefined,
        `stale_threshold_ms:${thresholdMs}`,
      )
    }
  }
}
