import type { AtcEventBus } from '@atc/events'
import type { LogisticsFleetRepository } from './logistics-fleet.repository.js'
import type { AtcFleetStatus, AtcLogisticsFleet } from './logistics-fleet.repository.js'
import { LogisticsFleetNotFoundError, FleetAlreadyDeployedError } from './errors.js'

export class LogisticsFleetService {
  constructor(
    private readonly fleetRepo: LogisticsFleetRepository,
    private readonly eventBus: AtcEventBus,
  ) {}

  async registerFleet(params: {
    fleetId: string
    fleetName: string
    ownerPrincipalId: string
    vehicleIds?: string[]
  }): Promise<AtcLogisticsFleet> {
    const fleet = await this.fleetRepo.create(params)
    this.eventBus.emit('atc:logistics:fleet:registered', { fleetId: fleet.fleetId }).catch(() => undefined)
    return fleet
  }

  async assignFleet(fleetId: string, routeId: string): Promise<AtcLogisticsFleet> {
    const fleet = await this.fleetRepo.findByFleetId(fleetId)
    if (!fleet) throw new LogisticsFleetNotFoundError(fleetId)
    if (fleet.status === 'deployed') throw new FleetAlreadyDeployedError(fleetId)
    const updated = await this.fleetRepo.updateStatus(fleetId, 'deployed', routeId)
    this.eventBus.emit('atc:logistics:fleet:assigned', { fleetId, routeId }).catch(() => undefined)
    return updated
  }

  async updateFleetStatus(fleetId: string, status: AtcFleetStatus): Promise<AtcLogisticsFleet> {
    const fleet = await this.fleetRepo.findByFleetId(fleetId)
    if (!fleet) throw new LogisticsFleetNotFoundError(fleetId)
    const updated = await this.fleetRepo.updateStatus(fleetId, status)
    this.eventBus.emit('atc:logistics:fleet:status_changed', { fleetId, status }).catch(() => undefined)
    return updated
  }

  async getFleet(fleetId: string): Promise<AtcLogisticsFleet | null> {
    return this.fleetRepo.findByFleetId(fleetId)
  }
}
