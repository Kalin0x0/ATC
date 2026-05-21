import type { PersistenceRuntimeRepository, AtcPersistenceRuntime, UpsertPersistenceParams } from './persistence-runtime.repository.js'
import type { PersistenceRuntimeEventBus } from './persistence-consistency.service.js'

export class DistributedSnapshotService {
  constructor(
    private persistenceRepo: PersistenceRuntimeRepository,
    private eventBus: PersistenceRuntimeEventBus,
  ) {}

  async upsertState(params: UpsertPersistenceParams): Promise<AtcPersistenceRuntime> {
    const state = await this.persistenceRepo.upsert(params)
    this.eventBus.emit('atc:persistence:state:updated', { entityId: state.entityId, status: state.status }).catch(() => undefined)
    return state
  }

  async getState(entityId: string): Promise<AtcPersistenceRuntime | null> {
    return this.persistenceRepo.findByEntity(entityId)
  }

  async deactivateState(entityId: string): Promise<void> {
    await this.persistenceRepo.deactivate(entityId)
    this.eventBus.emit('atc:persistence:state:deactivated', { entityId }).catch(() => undefined)
  }
}
