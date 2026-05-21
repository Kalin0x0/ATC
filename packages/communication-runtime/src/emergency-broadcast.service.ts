import type { AtcEventBus } from '@atc/events'
import type { EmergencyBroadcastRepository } from './emergency-broadcast.repository.js'
import type { CommunicationAuditRepository } from './communication-audit.repository.js'
import type {
  AtcEmergencyBroadcast,
  AtcBroadcastSeverity,
  AtcBroadcastStatus,
} from './emergency-broadcast.repository.js'

export class EmergencyBroadcastService {
  constructor(
    private readonly broadcastRepo: EmergencyBroadcastRepository,
    private readonly auditRepo: CommunicationAuditRepository,
    private readonly eventBus: AtcEventBus,
  ) {}

  async broadcast(params: {
    broadcastNonce: string
    initiatedByPrincipalId: string
    message: string
    severity: AtcBroadcastSeverity
    targetZoneId?: string
    expiresAt?: Date
  }): Promise<AtcEmergencyBroadcast> {
    const emergencyBroadcast = await this.broadcastRepo.create(params)

    await this.auditRepo.record(
      emergencyBroadcast.broadcastId,
      'emergency_broadcast',
      'created',
      params.initiatedByPrincipalId,
      JSON.stringify({
        severity: emergencyBroadcast.severity,
        ...(emergencyBroadcast.targetZoneId !== null
          ? { targetZoneId: emergencyBroadcast.targetZoneId }
          : {}),
      }),
    )

    this.eventBus
      .emit('atc:comms:emergency:broadcast', {
        broadcastId: emergencyBroadcast.broadcastId,
        severity: emergencyBroadcast.severity,
        ...(emergencyBroadcast.targetZoneId !== null
          ? { targetZoneId: emergencyBroadcast.targetZoneId }
          : {}),
      })
      .catch(() => undefined)

    return emergencyBroadcast
  }

  async cancelBroadcast(broadcastId: string): Promise<AtcEmergencyBroadcast> {
    const status: AtcBroadcastStatus = 'cancelled'
    const emergencyBroadcast = await this.broadcastRepo.updateStatus(broadcastId, status)

    await this.auditRepo.record(
      broadcastId,
      'emergency_broadcast',
      'cancelled',
    )

    this.eventBus
      .emit('atc:comms:emergency:cancelled', { broadcastId })
      .catch(() => undefined)

    return emergencyBroadcast
  }

  async expireStale(): Promise<number> {
    return this.broadcastRepo.expireStale()
  }
}
