import type { CampaignRuntimeRepository } from './campaign-runtime.repository.js'
import type { NarrativeSessionRepository } from './narrative-session.repository.js'
import type { WorldEventRepository } from './world-event.repository.js'
import type { NarrativeAuditRepository } from './narrative-audit.repository.js'
import type { NarrativeEventBus } from './narrative-runtime.service.js'

export class NarrativeRecoveryService {
  constructor(
    private campaignRepo: CampaignRuntimeRepository,
    private sessionRepo: NarrativeSessionRepository,
    private eventRepo: WorldEventRepository,
    private auditRepo: NarrativeAuditRepository,
    private eventBus: NarrativeEventBus,
  ) {}

  async recoverEntity(entityId: string): Promise<{ recovered: number }> {
    const sessions = await this.sessionRepo.listActive()
    const entitySessions = sessions.filter(s => s.entityId === entityId)
    let recovered = 0
    for (const session of entitySessions) {
      await this.sessionRepo.updateStatus(session.id, 'skipped')
      recovered++
    }
    this.eventBus.emit('atc:narrative:entity:recovered', { entityId, recovered }).catch(() => undefined)
    return { recovered }
  }

  async cleanupStale(thresholdMs: number): Promise<{ campaigns: number; sessions: number; events: number }> {
    const campaigns = await this.campaignRepo.cleanupStale(thresholdMs)
    const sessions = await this.sessionRepo.cleanupStale(thresholdMs)
    const events = await this.eventRepo.cleanupExpired()
    return { campaigns, sessions, events }
  }
}
