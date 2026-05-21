import type { AtcEventBus } from '@atc/events'
import type { DisasterEventRepository } from './disaster-event.repository.js'
import type { HazardZoneRepository } from './hazard-zone.repository.js'
import type { DisasterAuditRepository } from './disaster-audit.repository.js'
import type { AtcDisasterEvent, AtcDisasterType } from './disaster-event.repository.js'
import type { AtcHazardZone, AtcHazardType } from './hazard-zone.repository.js'

export interface DeclareDisasterParams {
  disasterNonce: string
  disasterType: AtcDisasterType
  disasterName: string
  severity: number
  affectedZoneIds?: string[] | undefined
  initiatedByPrincipalId?: string | undefined
  ownerServerId?: string | undefined
}

export interface PropagateHazardParams {
  zoneId: string
  disasterId?: string | undefined
  hazardType: AtcHazardType
  severity: number
  propagationRadius?: number | undefined
}

export class DisasterRuntimeService {
  private readonly disasterRepo: DisasterEventRepository
  private readonly hazardZoneRepo: HazardZoneRepository
  private readonly auditRepo: DisasterAuditRepository
  private readonly eventBus: AtcEventBus | undefined

  constructor(
    disasterRepo: DisasterEventRepository,
    hazardZoneRepo: HazardZoneRepository,
    auditRepo: DisasterAuditRepository,
    eventBus: AtcEventBus | undefined,
  ) {
    this.disasterRepo = disasterRepo
    this.hazardZoneRepo = hazardZoneRepo
    this.auditRepo = auditRepo
    this.eventBus = eventBus
  }

  async declareDisaster(params: DeclareDisasterParams): Promise<AtcDisasterEvent> {
    const disaster = await this.disasterRepo.create({
      disasterNonce: params.disasterNonce,
      disasterType: params.disasterType,
      disasterName: params.disasterName,
      severity: params.severity,
      ...(params.affectedZoneIds !== undefined ? { affectedZoneIds: params.affectedZoneIds } : {}),
      ...(params.initiatedByPrincipalId !== undefined ? { initiatedByPrincipalId: params.initiatedByPrincipalId } : {}),
      ...(params.ownerServerId !== undefined ? { ownerServerId: params.ownerServerId } : {}),
    })
    await this.auditRepo.record(
      disaster.disasterId,
      'disaster_event',
      'declared',
      params.initiatedByPrincipalId,
      `type=${params.disasterType} severity=${params.severity}`,
    )
    this.eventBus?.emit('atc:disaster:event:declared', {
      disasterId: disaster.disasterId,
      disasterType: disaster.disasterType,
      severity: disaster.severity,
    }).catch(() => undefined)
    return disaster
  }

  async escalateDisaster(disasterId: string): Promise<AtcDisasterEvent> {
    const disaster = await this.disasterRepo.transition(disasterId, 'escalated')
    await this.auditRepo.record(disaster.disasterId, 'disaster_event', 'escalated')
    this.eventBus?.emit('atc:disaster:event:escalated', {
      disasterId: disaster.disasterId,
    }).catch(() => undefined)
    return disaster
  }

  async containDisaster(disasterId: string): Promise<AtcDisasterEvent> {
    const disaster = await this.disasterRepo.transition(disasterId, 'contained')
    await this.auditRepo.record(disaster.disasterId, 'disaster_event', 'contained')
    this.eventBus?.emit('atc:disaster:event:contained', {
      disasterId: disaster.disasterId,
    }).catch(() => undefined)
    return disaster
  }

  async resolveDisaster(disasterId: string): Promise<AtcDisasterEvent> {
    const disaster = await this.disasterRepo.transition(disasterId, 'resolved')
    await this.auditRepo.record(disaster.disasterId, 'disaster_event', 'resolved')
    this.eventBus?.emit('atc:disaster:event:resolved', {
      disasterId: disaster.disasterId,
    }).catch(() => undefined)
    return disaster
  }

  async propagateHazard(params: PropagateHazardParams): Promise<AtcHazardZone> {
    const zone = await this.hazardZoneRepo.upsert({
      zoneId: params.zoneId,
      ...(params.disasterId !== undefined ? { disasterId: params.disasterId } : {}),
      hazardType: params.hazardType,
      severity: params.severity,
      ...(params.propagationRadius !== undefined ? { propagationRadius: params.propagationRadius } : {}),
    })
    this.eventBus?.emit('atc:disaster:hazard:propagated', {
      zoneId: zone.zoneId,
      hazardType: zone.hazardType,
      severity: zone.severity,
    }).catch(() => undefined)
    return zone
  }

  async clearHazardZone(zoneId: string): Promise<AtcHazardZone> {
    const zone = await this.hazardZoneRepo.updateStatus(zoneId, 'cleared')
    this.eventBus?.emit('atc:disaster:hazard:cleared', {
      zoneId: zone.zoneId,
    }).catch(() => undefined)
    return zone
  }
}
