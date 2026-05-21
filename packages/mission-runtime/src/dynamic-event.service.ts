import type { AtcEventBus } from '@atc/events'
import type {
  DynamicEventRepository,
  AtcDynamicEvent,
  CreateDynamicEventParams,
} from './dynamic-event.repository.js'
import type { MissionAuditRepository } from './mission-audit.repository.js'

export class DynamicEventService {
  constructor(
    private readonly eventRepo: DynamicEventRepository,
    private readonly auditRepo: MissionAuditRepository,
    private readonly eventBus?: AtcEventBus,
  ) {}

  async createEvent(params: CreateDynamicEventParams): Promise<AtcDynamicEvent> {
    const event = await this.eventRepo.create(params)
    await this.auditRepo.record(event.eventId, 'dynamic_event', 'created')
    return event
  }

  async resolveEvent(eventId: string): Promise<AtcDynamicEvent> {
    const event = await this.eventRepo.updateStatus(eventId, 'resolved')
    await this.auditRepo.record(eventId, 'dynamic_event', 'resolved')
    return event
  }

  async cancelEvent(eventId: string): Promise<AtcDynamicEvent> {
    const event = await this.eventRepo.updateStatus(eventId, 'cancelled')
    await this.auditRepo.record(eventId, 'dynamic_event', 'cancelled')
    return event
  }

  async expireStaleEvents(): Promise<number> {
    const count = await this.eventRepo.expireStale()
    return count
  }
}
