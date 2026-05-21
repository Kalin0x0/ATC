import type { AtcVehicleFleetAssignment } from '@atc/shared-types'
import { ATC_VEHICLE_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { FleetRepository, CreateFleetAssignmentParams } from './fleet.repository.js'

export interface FleetServiceDeps {
  fleetRepo: FleetRepository
  eventBus: AtcEventBus | undefined
}

export class FleetService {
  private readonly fleetRepo: FleetRepository
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: FleetServiceDeps) {
    this.fleetRepo = deps.fleetRepo
    this.eventBus  = deps.eventBus
  }

  async assign(params: CreateFleetAssignmentParams): Promise<AtcVehicleFleetAssignment> {
    const assignment = await this.fleetRepo.assign(params)
    this.eventBus?.emit(ATC_VEHICLE_EVENTS.FLEET_ASSIGNED, {
      assignmentId: assignment.id,
      vehicleId: params.vehicleId,
      organizationId: params.organizationId,
      principalId: params.principalId,
      assignedByPrincipalId: params.assignedByPrincipalId,
    }).catch(() => undefined)
    return assignment
  }

  async unassign(
    assignmentId: string,
    unassignedByPrincipalId: string,
  ): Promise<AtcVehicleFleetAssignment> {
    const assignment = await this.fleetRepo.unassign(assignmentId, unassignedByPrincipalId)
    this.eventBus?.emit(ATC_VEHICLE_EVENTS.FLEET_UNASSIGNED, {
      assignmentId,
      vehicleId: assignment.vehicleId,
      unassignedByPrincipalId,
    }).catch(() => undefined)
    return assignment
  }

  async getActiveForVehicle(vehicleId: string): Promise<AtcVehicleFleetAssignment | null> {
    return this.fleetRepo.findActiveForVehicle(vehicleId)
  }

  async listActiveForPrincipal(principalId: string): Promise<AtcVehicleFleetAssignment[]> {
    return this.fleetRepo.findActiveForPrincipal(principalId)
  }

  async listActiveForOrganization(organizationId: string): Promise<AtcVehicleFleetAssignment[]> {
    return this.fleetRepo.listActiveForOrganization(organizationId)
  }
}
