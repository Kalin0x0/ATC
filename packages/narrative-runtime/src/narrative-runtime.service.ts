import type { NarrativeSessionRepository, AtcNarrativeSession, CreateNarrativeSessionParams, AtcNarrativeStatus } from './narrative-session.repository.js'
import type { NarrativeAuditRepository } from './narrative-audit.repository.js'

export interface NarrativeEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export class NarrativeRuntimeService {
  constructor(
    private sessionRepo: NarrativeSessionRepository,
    private auditRepo: NarrativeAuditRepository,
    private eventBus: NarrativeEventBus,
  ) {}

  async startSession(params: CreateNarrativeSessionParams): Promise<AtcNarrativeSession> {
    const session = await this.sessionRepo.create(params)
    await this.auditRepo.append({ sessionId: session.sessionId, eventType: 'narrative_started', entityId: session.entityId })
    this.eventBus.emit('atc:narrative:session:started', { sessionId: session.sessionId }).catch(() => undefined)
    return session
  }

  async endSession(id: string, status: AtcNarrativeStatus): Promise<AtcNarrativeSession> {
    const session = await this.sessionRepo.updateStatus(id, status)
    await this.auditRepo.append({ sessionId: session.sessionId, eventType: 'narrative_ended', entityId: session.entityId })
    this.eventBus.emit('atc:narrative:session:ended', { sessionId: session.sessionId }).catch(() => undefined)
    return session
  }

  async getSession(id: string): Promise<AtcNarrativeSession | null> {
    return this.sessionRepo.findById(id)
  }

  async listActiveSessions(ownerServerId?: string): Promise<AtcNarrativeSession[]> {
    return this.sessionRepo.listActive(ownerServerId)
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    return this.sessionRepo.cleanupStale(thresholdMs)
  }
}
