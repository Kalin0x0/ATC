import type { AtcProperty, AtcPropertyAlarmState, AtcPropertyOccupant } from '@atc/shared-types'
import { ATC_PROPERTY_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { PropertyRepository } from './property.repository.js'
import type { PropertyRuntimeRepository } from './property-runtime.repository.js'
import { PropertyNotFoundError } from './errors.js'

export interface InteriorStateDeps {
  propertyRepo: PropertyRepository
  runtimeRepo: PropertyRuntimeRepository
  eventBus: AtcEventBus | undefined
}

export class InteriorStateService {
  private readonly propertyRepo: PropertyRepository
  private readonly runtimeRepo: PropertyRuntimeRepository
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: InteriorStateDeps) {
    this.propertyRepo = deps.propertyRepo
    this.runtimeRepo  = deps.runtimeRepo
    this.eventBus     = deps.eventBus
  }

  async lock(propertyId: string, principalId: string): Promise<AtcProperty> {
    const prop = await this.propertyRepo.findById(propertyId)
    if (!prop) throw new PropertyNotFoundError(propertyId)

    await this.propertyRepo.setLock(propertyId, true)
    // Transition to locked if currently owned/occupied
    if (prop.status === 'owned' || prop.status === 'occupied') {
      await this.propertyRepo.transition({ id: propertyId, newStatus: 'locked' }).catch(() => undefined)
    }

    const updated = await this.propertyRepo.findById(propertyId)
    if (!updated) throw new PropertyNotFoundError(propertyId)

    this.eventBus?.emit(ATC_PROPERTY_EVENTS.PROPERTY_LOCKED, {
      propertyId, lockedByPrincipalId: principalId,
    }).catch(() => undefined)

    return updated
  }

  async unlock(propertyId: string, principalId: string): Promise<AtcProperty> {
    const prop = await this.propertyRepo.findById(propertyId)
    if (!prop) throw new PropertyNotFoundError(propertyId)

    await this.propertyRepo.setLock(propertyId, false)

    // Transition back to owned if no occupants
    if (prop.status === 'locked') {
      const runtime = await this.runtimeRepo.findByProperty(propertyId)
      const newStatus = (runtime?.occupantCount ?? 0) > 0 ? 'occupied' : 'owned'
      await this.propertyRepo.transition({ id: propertyId, newStatus }).catch(() => undefined)
    }

    const updated = await this.propertyRepo.findById(propertyId)
    if (!updated) throw new PropertyNotFoundError(propertyId)

    this.eventBus?.emit(ATC_PROPERTY_EVENTS.PROPERTY_UNLOCKED, {
      propertyId, unlockedByPrincipalId: principalId,
    }).catch(() => undefined)

    return updated
  }

  async enter(propertyId: string, principalId: string): Promise<AtcPropertyOccupant> {
    const prop = await this.propertyRepo.findById(propertyId)
    if (!prop) throw new PropertyNotFoundError(propertyId)

    // Ensure runtime record exists
    await this.runtimeRepo.upsertRuntime(propertyId).catch(() => undefined)

    const occupant = await this.runtimeRepo.enter(propertyId, principalId)

    // Transition to occupied if in owned/locked state
    if (prop.status === 'owned' || prop.status === 'locked' || prop.status === 'breached') {
      await this.propertyRepo.transition({
        id: propertyId,
        newStatus: 'occupied',
      }).catch(() => undefined)
    }

    this.eventBus?.emit(ATC_PROPERTY_EVENTS.PROPERTY_ENTERED, {
      propertyId, principalId,
    }).catch(() => undefined)

    return occupant
  }

  async exit(propertyId: string, principalId: string): Promise<void> {
    const prop = await this.propertyRepo.findById(propertyId)
    if (!prop) throw new PropertyNotFoundError(propertyId)

    await this.runtimeRepo.exit(propertyId, principalId)

    // Check remaining occupants — if empty, transition back to owned/locked
    const runtime = await this.runtimeRepo.findByProperty(propertyId)
    if ((runtime?.occupantCount ?? 0) === 0 && prop.status === 'occupied') {
      const newStatus = prop.isLocked ? 'locked' : 'owned'
      await this.propertyRepo.transition({ id: propertyId, newStatus }).catch(() => undefined)
    }

    this.eventBus?.emit(ATC_PROPERTY_EVENTS.PROPERTY_EXITED, {
      propertyId, principalId,
    }).catch(() => undefined)
  }

  async setAlarm(
    propertyId: string,
    alarmState: AtcPropertyAlarmState,
    principalId: string,
  ): Promise<AtcProperty> {
    const prop = await this.propertyRepo.findById(propertyId)
    if (!prop) throw new PropertyNotFoundError(propertyId)

    await this.propertyRepo.setAlarm(propertyId, alarmState)

    const updated = await this.propertyRepo.findById(propertyId)
    if (!updated) throw new PropertyNotFoundError(propertyId)
    return updated
  }

  async getOccupants(propertyId: string): Promise<AtcPropertyOccupant[]> {
    return this.runtimeRepo.listActiveOccupants(propertyId)
  }

  async evictAll(propertyId: string, principalId: string): Promise<void> {
    await this.runtimeRepo.evictAllOccupants(propertyId)
    const prop = await this.propertyRepo.findById(propertyId)
    if (prop?.status === 'occupied') {
      const newStatus = prop.isLocked ? 'locked' : 'owned'
      await this.propertyRepo.transition({ id: propertyId, newStatus }).catch(() => undefined)
    }
  }

  async cleanStaleOccupants(olderThanMinutes: number): Promise<number> {
    return this.runtimeRepo.cleanStaleOccupants(olderThanMinutes)
  }
}
