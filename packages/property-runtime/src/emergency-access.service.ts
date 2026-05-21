import type { AtcProperty, AtcPropertyAccessType } from '@atc/shared-types'
import { ATC_PROPERTY_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { PropertyRepository } from './property.repository.js'
import type { PropertyRuntimeRepository } from './property-runtime.repository.js'
import type { PropertyAccessRepository } from './property-access.repository.js'
import { PropertyNotFoundError, EmergencyAccessError } from './errors.js'

export interface EmergencyAccessDeps {
  propertyRepo: PropertyRepository
  runtimeRepo: PropertyRuntimeRepository
  accessRepo: PropertyAccessRepository
  eventBus: AtcEventBus | undefined
}

export interface BreachParams {
  breachingPrincipalId: string
  accessType: 'emergency_law' | 'emergency_ems'
  reason: string
  agencyId?: string | null | undefined
}

export interface EndBreachParams {
  principalId: string
  lockAfterBreach?: boolean | undefined
}

export class EmergencyAccessService {
  private readonly propertyRepo: PropertyRepository
  private readonly runtimeRepo: PropertyRuntimeRepository
  private readonly accessRepo: PropertyAccessRepository
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: EmergencyAccessDeps) {
    this.propertyRepo = deps.propertyRepo
    this.runtimeRepo  = deps.runtimeRepo
    this.accessRepo   = deps.accessRepo
    this.eventBus     = deps.eventBus
  }

  async breach(propertyId: string, params: BreachParams): Promise<AtcProperty> {
    const prop = await this.propertyRepo.findById(propertyId)
    if (!prop) throw new PropertyNotFoundError(propertyId)

    const branchable: string[] = ['owned', 'occupied', 'locked']
    if (!branchable.includes(prop.status)) {
      throw new EmergencyAccessError(
        `Property '${propertyId}' cannot be breached from status '${prop.status}'`,
      )
    }

    // Set breach state in runtime
    await this.runtimeRepo.upsertRuntime(propertyId).catch(() => undefined)
    await this.runtimeRepo.setBreach(
      propertyId,
      params.breachingPrincipalId,
      params.reason,
    )

    // Transition to breached
    const property = await this.propertyRepo.transition({
      id: propertyId,
      newStatus: 'breached',
    })

    // Grant temporary emergency access (5 minutes)
    await this.accessRepo.grant({
      propertyId,
      principalId: params.breachingPrincipalId,
      accessType: params.accessType,
      grantedByPrincipalId: params.breachingPrincipalId,
      expiresInSeconds: 300,
    }).catch(() => undefined) // idempotent — may already have access

    this.eventBus?.emit(ATC_PROPERTY_EVENTS.PROPERTY_BREACHED, {
      propertyId,
      breachedByPrincipalId: params.breachingPrincipalId,
      accessType: params.accessType,
      reason: params.reason,
      agencyId: params.agencyId,
    }).catch(() => undefined)

    return property
  }

  async endBreach(propertyId: string, params: EndBreachParams): Promise<AtcProperty> {
    const prop = await this.propertyRepo.findById(propertyId)
    if (!prop) throw new PropertyNotFoundError(propertyId)

    if (prop.status !== 'breached') {
      throw new EmergencyAccessError(
        `Property '${propertyId}' is not in breached state`,
      )
    }

    // Clear breach from runtime
    await this.runtimeRepo.setBreach(propertyId, null, null)

    // Determine next state
    const runtime = await this.runtimeRepo.findByProperty(propertyId)
    let newStatus: AtcProperty['status']
    if (params.lockAfterBreach) {
      newStatus = 'locked'
    } else if ((runtime?.occupantCount ?? 0) > 0) {
      newStatus = 'occupied'
    } else {
      newStatus = prop.isLocked ? 'locked' : 'owned'
    }

    const property = await this.propertyRepo.transition({ id: propertyId, newStatus })

    if (params.lockAfterBreach) {
      await this.propertyRepo.setLock(propertyId, true)
    }

    this.eventBus?.emit(ATC_PROPERTY_EVENTS.PROPERTY_BREACH_ENDED, {
      propertyId,
      endedByPrincipalId: params.principalId,
      newStatus,
    }).catch(() => undefined)

    return property
  }

  async grantEmergencyAccess(
    propertyId: string,
    accessType: 'emergency_ems' | 'emergency_law',
    grantedByPrincipalId: string,
    targetPrincipalId: string,
    expiresInSeconds?: number,
  ): Promise<void> {
    await this.accessRepo.grant({
      propertyId,
      principalId: targetPrincipalId,
      accessType,
      grantedByPrincipalId,
      expiresInSeconds: expiresInSeconds ?? 600,
    })

    this.eventBus?.emit(ATC_PROPERTY_EVENTS.ACCESS_GRANTED, {
      propertyId,
      principalId: targetPrincipalId,
      accessType,
      grantedByPrincipalId,
      emergency: true,
    }).catch(() => undefined)
  }
}
