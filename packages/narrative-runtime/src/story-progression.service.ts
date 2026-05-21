import type { StoryProgressionRepository, AtcStoryProgression, CreateProgressionParams } from './story-progression.repository.js'
import type { NarrativeAuditRepository } from './narrative-audit.repository.js'
import type { NarrativeEventBus } from './narrative-runtime.service.js'

export class StoryProgressionService {
  constructor(
    private progressionRepo: StoryProgressionRepository,
    private auditRepo: NarrativeAuditRepository,
    private eventBus: NarrativeEventBus,
  ) {}

  async startProgression(params: CreateProgressionParams): Promise<AtcStoryProgression> {
    const progression = await this.progressionRepo.create(params)
    this.eventBus.emit('atc:narrative:progression:started', { id: progression.id, entityId: progression.entityId }).catch(() => undefined)
    return progression
  }

  async advanceProgression(
    id: string,
    newStageKey: string,
    progressionData?: Record<string, unknown>,
  ): Promise<AtcStoryProgression> {
    const progression = await this.progressionRepo.advanceStage(id, newStageKey, progressionData)
    await this.auditRepo.append({ eventType: 'narrative_progressed', entityId: progression.entityId })
    this.eventBus.emit('atc:narrative:progression:advanced', { id: progression.id, stageKey: newStageKey }).catch(() => undefined)
    return progression
  }

  async getProgressions(entityId: string, campaignId: string): Promise<AtcStoryProgression[]> {
    return this.progressionRepo.findByEntityAndCampaign(entityId, campaignId)
  }
}
