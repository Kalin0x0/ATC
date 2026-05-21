import type { AtcEventBus } from '@atc/events'
import type { MissionRepository, AtcMission, CreateMissionParams } from './mission.repository.js'
import type { MissionAuditRepository } from './mission-audit.repository.js'

export class MissionRuntimeService {
  constructor(
    private readonly missionRepo: MissionRepository,
    private readonly auditRepo: MissionAuditRepository,
    private readonly eventBus?: AtcEventBus,
  ) {}

  async createMission(params: CreateMissionParams): Promise<AtcMission> {
    const mission = await this.missionRepo.create(params)
    await this.auditRepo.record(mission.missionId, 'mission', 'created')
    this.eventBus
      ?.emit('atc:mission:created', { missionId: mission.missionId, missionType: mission.missionType })
      .catch(() => undefined)
    return mission
  }

  async startMission(missionId: string): Promise<AtcMission> {
    const mission = await this.missionRepo.transition(missionId, 'active')
    await this.auditRepo.record(missionId, 'mission', 'started')
    this.eventBus
      ?.emit('atc:mission:started', { missionId })
      .catch(() => undefined)
    return mission
  }

  async completeMission(missionId: string): Promise<AtcMission> {
    const mission = await this.missionRepo.transition(missionId, 'completed')
    await this.auditRepo.record(missionId, 'mission', 'completed')
    this.eventBus
      ?.emit('atc:mission:completed', { missionId })
      .catch(() => undefined)
    return mission
  }

  async failMission(missionId: string): Promise<AtcMission> {
    const mission = await this.missionRepo.transition(missionId, 'failed')
    await this.auditRepo.record(missionId, 'mission', 'failed')
    this.eventBus
      ?.emit('atc:mission:failed', { missionId })
      .catch(() => undefined)
    return mission
  }

  async abandonMission(missionId: string): Promise<AtcMission> {
    const mission = await this.missionRepo.transition(missionId, 'abandoned')
    await this.auditRepo.record(missionId, 'mission', 'abandoned')
    return mission
  }

  async listActiveMissions(): Promise<AtcMission[]> {
    return this.missionRepo.listActive()
  }
}
