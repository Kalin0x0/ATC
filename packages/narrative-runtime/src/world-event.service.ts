import type { WorldEventRepository, AtcWorldEvent, CreateWorldEventParams } from './world-event.repository.js'
import type { NarrativeAuditRepository } from './narrative-audit.repository.js'
import type { NarrativeEventBus } from './narrative-runtime.service.js'

export class WorldEventService {
  constructor(
    private eventRepo: WorldEventRepository,
    private auditRepo: NarrativeAuditRepository,
    private eventBus: NarrativeEventBus,
  ) {}

  async triggerEvent(params: CreateWorldEventParams): Promise<AtcWorldEvent> {
    const event = await this.eventRepo.create(params)
    await this.auditRepo.append({ eventType: 'world_event_triggered' })
    this.eventBus.emit('atc:narrative:world_event:triggered', { eventId: event.eventId }).catch(() => undefined)
    return event
  }

  async getEvent(id: string): Promise<AtcWorldEvent | null> {
    return this.eventRepo.findById(id)
  }

  async completeEvent(id: string): Promise<AtcWorldEvent> {
    const event = await this.eventRepo.updateStatus(id, 'completed')
    this.eventBus.emit('atc:narrative:world_event:completed', { eventId: event.eventId }).catch(() => undefined)
    return event
  }

  async listActiveEvents(ownerServerId?: string): Promise<AtcWorldEvent[]> {
    return this.eventRepo.listActive(ownerServerId)
  }

  async cleanupExpired(): Promise<number> {
    return this.eventRepo.cleanupExpired()
  }
}
