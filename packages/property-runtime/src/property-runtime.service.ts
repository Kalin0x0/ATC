import type { AtcProperty, AtcPropertyStatus } from '@atc/shared-types'
import { ATC_PROPERTY_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { PropertyRepository, CreatePropertyParams } from './property.repository.js'
import type { PropertyRuntimeRepository } from './property-runtime.repository.js'
import { PropertyNotFoundError, PropertyImmutableError } from './errors.js'

export interface PropertyRuntimeDeps {
  propertyRepo: PropertyRepository
  runtimeRepo: PropertyRuntimeRepository
  eventBus: AtcEventBus | undefined
}

export interface PurchasePropertyParams {
  buyerPrincipalId: string
  organizationId?: string | null | undefined
}

export interface SeizePropertyParams {
  seizedByPrincipalId: string
  reason?: string | null | undefined
}

export class PropertyRuntimeService {
  private readonly propertyRepo: PropertyRepository
  private readonly runtimeRepo: PropertyRuntimeRepository
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: PropertyRuntimeDeps) {
    this.propertyRepo = deps.propertyRepo
    this.runtimeRepo  = deps.runtimeRepo
    this.eventBus     = deps.eventBus
  }

  async register(params: CreatePropertyParams): Promise<AtcProperty> {
    const property = await this.propertyRepo.create(params)
    return property
  }

  async purchase(propertyId: string, params: PurchasePropertyParams): Promise<AtcProperty> {
    const property = await this.propertyRepo.transition({
      id: propertyId,
      newStatus: 'owned',
      ownerId: params.buyerPrincipalId,
      organizationId: params.organizationId,
    })

    // Create runtime record for owned property
    await this.runtimeRepo.upsertRuntime(propertyId).catch(() => undefined)

    this.eventBus?.emit(ATC_PROPERTY_EVENTS.PROPERTY_PURCHASED, {
      propertyId,
      ownerId: params.buyerPrincipalId,
      organizationId: params.organizationId,
    }).catch(() => undefined)

    return property
  }

  async sell(propertyId: string, principalId: string): Promise<AtcProperty> {
    const property = await this.propertyRepo.transition({
      id: propertyId,
      newStatus: 'available',
      ownerId: null,
      organizationId: null,
    })

    this.eventBus?.emit(ATC_PROPERTY_EVENTS.PROPERTY_SOLD, {
      propertyId, soldByPrincipalId: principalId,
    }).catch(() => undefined)

    return property
  }

  async seize(propertyId: string, params: SeizePropertyParams): Promise<AtcProperty> {
    const property = await this.propertyRepo.transition({
      id: propertyId,
      newStatus: 'seized',
      seizedByPrincipalId: params.seizedByPrincipalId,
      seizedAt: new Date(),
    })

    this.eventBus?.emit(ATC_PROPERTY_EVENTS.PROPERTY_SEIZED, {
      propertyId,
      seizedByPrincipalId: params.seizedByPrincipalId,
      reason: params.reason,
    }).catch(() => undefined)

    return property
  }

  async releaseSeizure(propertyId: string, releasedByPrincipalId: string): Promise<AtcProperty> {
    const prop = await this.propertyRepo.findById(propertyId)
    if (!prop) throw new PropertyNotFoundError(propertyId)

    const newStatus: AtcPropertyStatus = prop.ownerId ? 'owned' : 'available'
    const property = await this.propertyRepo.transition({
      id: propertyId,
      newStatus,
      seizedByPrincipalId: null,
      seizedAt: null,
    })

    this.eventBus?.emit(ATC_PROPERTY_EVENTS.PROPERTY_SEIZURE_RELEASED, {
      propertyId, releasedByPrincipalId,
    }).catch(() => undefined)

    return property
  }

  async abandon(propertyId: string, principalId: string): Promise<AtcProperty> {
    return this.propertyRepo.transition({ id: propertyId, newStatus: 'abandoned' })
  }

  async findById(propertyId: string): Promise<AtcProperty | null> {
    return this.propertyRepo.findById(propertyId)
  }

  async listByOwner(ownerId: string): Promise<AtcProperty[]> {
    return this.propertyRepo.listByOwner(ownerId)
  }

  async listByOrganization(organizationId: string): Promise<AtcProperty[]> {
    return this.propertyRepo.listByOrganization(organizationId)
  }

  async listByStatus(status: AtcPropertyStatus): Promise<AtcProperty[]> {
    return this.propertyRepo.findByStatus(status)
  }
}
