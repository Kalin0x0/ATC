import type { AtcPropertyGarage } from '@atc/shared-types'
import { ATC_PROPERTY_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { VehicleRuntimeService, RetrieveVehicleParams } from '@atc/vehicle-runtime'
import type { AtcVehicleWithRuntime } from '@atc/shared-types'
import type { PropertyGarageRepository } from './property-garage.repository.js'
import { PropertyGarageNotFoundError } from './errors.js'

export interface PropertyGarageServiceDeps {
  garageRepo: PropertyGarageRepository
  vehicleRuntimeService?: VehicleRuntimeService | undefined
  eventBus: AtcEventBus | undefined
}

export interface LinkGarageParams {
  garageId: string
  linkedByPrincipalId: string
  label?: string | undefined
  capacity?: number | undefined
}

export interface RetrieveFromPropertyParams {
  vehicleId: string
  garageId: string
  retrievedByPrincipalId: string
  x: number
  y: number
  z: number
  heading?: number | undefined
}

export class PropertyGarageService {
  private readonly garageRepo: PropertyGarageRepository
  private readonly vehicleRuntimeService: VehicleRuntimeService | undefined
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: PropertyGarageServiceDeps) {
    this.garageRepo            = deps.garageRepo
    this.vehicleRuntimeService = deps.vehicleRuntimeService
    this.eventBus              = deps.eventBus
  }

  async linkGarage(propertyId: string, params: LinkGarageParams): Promise<AtcPropertyGarage> {
    const garage = await this.garageRepo.link(
      propertyId,
      params.garageId,
      params.linkedByPrincipalId,
      params.label,
      params.capacity,
    )

    this.eventBus?.emit(ATC_PROPERTY_EVENTS.GARAGE_LINKED, {
      propertyId,
      garageId: params.garageId,
      linkedByPrincipalId: params.linkedByPrincipalId,
    }).catch(() => undefined)

    return garage
  }

  async unlinkGarage(
    propertyId: string,
    garageId: string,
    unlinkedByPrincipalId: string,
  ): Promise<AtcPropertyGarage> {
    const garage = await this.garageRepo.unlink(propertyId, garageId, unlinkedByPrincipalId)

    this.eventBus?.emit(ATC_PROPERTY_EVENTS.GARAGE_UNLINKED, {
      propertyId,
      garageId,
      unlinkedByPrincipalId,
    }).catch(() => undefined)

    return garage
  }

  async listLinkedGarages(propertyId: string): Promise<AtcPropertyGarage[]> {
    return this.garageRepo.listActiveForProperty(propertyId)
  }

  async retrieveVehicle(
    propertyId: string,
    params: RetrieveFromPropertyParams,
  ): Promise<AtcVehicleWithRuntime> {
    // Validate garage is linked to this property
    const linked = await this.garageRepo.findActive(propertyId, params.garageId)
    if (!linked) {
      throw new PropertyGarageNotFoundError(propertyId, params.garageId)
    }

    if (!this.vehicleRuntimeService) {
      throw new Error('VehicleRuntimeService not available')
    }

    const retrieveParams: RetrieveVehicleParams = {
      garageId: params.garageId,
      retrievedByPrincipalId: params.retrievedByPrincipalId,
      x: params.x,
      y: params.y,
      z: params.z,
      heading: params.heading,
    }

    return this.vehicleRuntimeService.retrieve(params.vehicleId, retrieveParams)
  }
}
