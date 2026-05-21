import type { DynamicStoryStateRepository, AtcDynamicStoryState, UpsertStoryStateParams } from './dynamic-story-state.repository.js'
import type { NarrativeEventBus } from './narrative-runtime.service.js'

export class DynamicNarrativeService {
  constructor(
    private storyStateRepo: DynamicStoryStateRepository,
    private eventBus: NarrativeEventBus,
  ) {}

  async setStoryState(params: UpsertStoryStateParams): Promise<AtcDynamicStoryState> {
    return this.storyStateRepo.upsert(params)
  }

  async getStoryState(entityId: string, branchKey: string): Promise<AtcDynamicStoryState | null> {
    return this.storyStateRepo.findByEntityAndBranch(entityId, branchKey)
  }

  async listEntityStates(entityId: string): Promise<AtcDynamicStoryState[]> {
    return this.storyStateRepo.listByEntity(entityId)
  }

  async deactivateState(id: string): Promise<void> {
    await this.storyStateRepo.deactivate(id)
  }
}
