import type { AtcEventBus } from '@atc/events'
import type { VesselRepository } from './vessel.repository.js'
import type { AtcVessel } from './vessel.repository.js'
import type { DockingRuntimeRepository } from './docking-runtime.repository.js'
import type { AtcDockingRuntime } from './docking-runtime.repository.js'
import type { TransportAuditRepository } from './transport-audit.repository.js'

export class MaritimeRuntimeService {
  constructor(
    private readonly vesselRepo: VesselRepository,
    private readonly dockingRepo: DockingRuntimeRepository,
    private readonly auditRepo: TransportAuditRepository,
    private readonly eventBus: AtcEventBus,
  ) {}

  async registerVessel(params: {
    vesselId: string
    vesselName: string
    vesselType: string
    ownedByPrincipalId?: string
  }): Promise<AtcVessel> {
    const vessel = await this.vesselRepo.upsert(params)
    await this.auditRepo.record(vessel.vesselId, 'vessel', 'registered', undefined, undefined)
    this.eventBus.emit('atc:transport:vessel:registered', { vesselId: vessel.vesselId }).catch(() => undefined)
    return vessel
  }

  async updateVesselPosition(
    vesselId: string,
    params: {
      positionX: number
      positionY: number
      positionZ?: number
      heading?: number
      speedKnots?: number
      zoneId?: string
    },
  ): Promise<void> {
    await this.vesselRepo.updatePosition(vesselId, params)
    this.eventBus.emit('atc:transport:vessel:position_updated', { vesselId }).catch(() => undefined)
  }

  async dockVessel(params: {
    dockingNonce: string
    vesselId: string
    dockZoneId: string
    slotId?: string
  }): Promise<AtcDockingRuntime> {
    const docking = await this.dockingRepo.create(params)
    await this.vesselRepo.updateStatus(params.vesselId, 'docked')
    await this.auditRepo.record(
      params.vesselId,
      'vessel',
      'docked',
      undefined,
      JSON.stringify({ dockZoneId: params.dockZoneId, dockingId: docking.dockingId }),
    )
    this.eventBus
      .emit('atc:transport:vessel:docked', { vesselId: params.vesselId, dockZoneId: params.dockZoneId })
      .catch(() => undefined)
    return docking
  }

  async undockVessel(dockingId: string): Promise<AtcDockingRuntime> {
    const docking = await this.dockingRepo.updateStatus(dockingId, 'available')
    await this.vesselRepo.updateStatus(docking.vesselId, 'underway')
    await this.auditRepo.record(
      docking.vesselId,
      'vessel',
      'undocked',
      undefined,
      JSON.stringify({ dockingId }),
    )
    this.eventBus
      .emit('atc:transport:vessel:undocked', { vesselId: docking.vesselId })
      .catch(() => undefined)
    return docking
  }
}
