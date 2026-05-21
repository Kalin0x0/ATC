import type {
  AtcWeaponRegistration,
  AtcWeaponRuntime,
  AtcWeaponCategory,
} from '@atc/shared-types'
import { ATC_COMBAT_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { WeaponRepository } from './weapon.repository.js'
import type { WeaponRuntimeRepository } from './weapon-runtime.repository.js'
import type { CombatPool } from './pool.js'
import {
  WeaponNotFoundError,
  WeaponSeizedError,
  WeaponValidationError,
} from './errors.js'

export interface WeaponStateDeps {
  weaponRepo: WeaponRepository
  runtimeRepo: WeaponRuntimeRepository
  pool: CombatPool
  eventBus: AtcEventBus | undefined
}

export interface EquipWeaponParams {
  weaponId: string
  holderPrincipalId: string
  currentAmmo: number
  maxAmmo: number
  attachmentState?: Record<string, string> | undefined
}

export interface RegisterWeaponParams {
  ownerId?: string | null | undefined
  organizationId?: string | null | undefined
  model: string
  category: AtcWeaponCategory
  serial: string
  registeredByPrincipalId?: string | null | undefined
}

export class WeaponStateService {
  private readonly weaponRepo: WeaponRepository
  private readonly runtimeRepo: WeaponRuntimeRepository
  private readonly pool: CombatPool
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: WeaponStateDeps) {
    this.weaponRepo  = deps.weaponRepo
    this.runtimeRepo = deps.runtimeRepo
    this.pool        = deps.pool
    this.eventBus    = deps.eventBus
  }

  async registerWeapon(params: RegisterWeaponParams): Promise<AtcWeaponRegistration> {
    const weapon = await this.weaponRepo.create({
      ownerId:                 params.ownerId,
      organizationId:          params.organizationId,
      model:                   params.model,
      category:                params.category,
      serial:                  params.serial,
      registeredByPrincipalId: params.registeredByPrincipalId,
    })

    this.eventBus?.emit(ATC_COMBAT_EVENTS.WEAPON_REGISTERED, {
      weaponId:               weapon.id,
      model:                  weapon.model,
      category:               weapon.category,
      ownerId:                weapon.ownerId,
      registeredByPrincipalId: weapon.registeredByPrincipalId,
    }).catch(() => undefined)

    return weapon
  }

  async equip(params: EquipWeaponParams): Promise<AtcWeaponRuntime> {
    // Validate weapon exists and is usable
    const weapon = await this.weaponRepo.findById(params.weaponId)
    if (!weapon) throw new WeaponNotFoundError(params.weaponId)
    if (weapon.status === 'seized') throw new WeaponSeizedError(params.weaponId)
    if (weapon.status === 'destroyed') throw new WeaponValidationError(`Weapon ${params.weaponId} is destroyed and cannot be equipped`)

    // Ensure runtime row exists before equipping
    await this.runtimeRepo.upsertRuntime({
      weaponId:         params.weaponId,
      holderPrincipalId: params.holderPrincipalId,
      isEquipped:       false,
      currentAmmo:      params.currentAmmo,
      maxAmmo:          params.maxAmmo,
      attachmentState:  params.attachmentState,
    })

    const runtime = await this.runtimeRepo.equip(params.weaponId, params.holderPrincipalId)

    this.eventBus?.emit(ATC_COMBAT_EVENTS.WEAPON_EQUIPPED, {
      weaponId:          params.weaponId,
      holderPrincipalId: params.holderPrincipalId,
      model:             weapon.model,
    }).catch(() => undefined)

    return runtime
  }

  async unequip(weaponId: string, holderPrincipalId: string): Promise<AtcWeaponRuntime> {
    const runtime = await this.runtimeRepo.unequip(weaponId, holderPrincipalId)

    this.eventBus?.emit(ATC_COMBAT_EVENTS.WEAPON_UNEQUIPPED, {
      weaponId,
      holderPrincipalId,
    }).catch(() => undefined)

    return runtime
  }

  async syncAmmo(
    weaponId: string,
    holderPrincipalId: string,
    currentAmmo: number,
  ): Promise<void> {
    const runtime = await this.runtimeRepo.findByWeaponAndHolder(weaponId, holderPrincipalId)
    if (!runtime) throw new WeaponNotFoundError(weaponId)

    // Clamp ammo to max
    const safeAmmo = Math.min(currentAmmo, runtime.maxAmmo)
    await this.runtimeRepo.updateAmmo(weaponId, holderPrincipalId, safeAmmo)
  }

  async syncRuntime(
    weaponId: string,
    holderPrincipalId: string,
    params: {
      currentAmmo?: number | undefined
      durability?: number | undefined
      attachmentState?: Record<string, string> | undefined
    },
  ): Promise<void> {
    const runtime = await this.runtimeRepo.findByWeaponAndHolder(weaponId, holderPrincipalId)
    if (!runtime) throw new WeaponNotFoundError(weaponId)

    if (params.currentAmmo !== undefined) {
      const safeAmmo = Math.min(params.currentAmmo, runtime.maxAmmo)
      await this.runtimeRepo.updateAmmo(weaponId, holderPrincipalId, safeAmmo)
    }

    if (params.durability !== undefined) {
      await this.weaponRepo.updateDurability(weaponId, params.durability)
    }

    if (params.attachmentState !== undefined) {
      await this.runtimeRepo.upsertRuntime({
        weaponId,
        holderPrincipalId,
        isEquipped:      runtime.isEquipped,
        currentAmmo:     params.currentAmmo ?? runtime.currentAmmo,
        maxAmmo:         runtime.maxAmmo,
        attachmentState: params.attachmentState,
      })
    } else {
      await this.runtimeRepo.updateLastSync(weaponId, holderPrincipalId)
    }
  }

  async seizeWeapon(weaponId: string, seizedByPrincipalId: string): Promise<AtcWeaponRegistration> {
    const weapon = await this.weaponRepo.updateStatus(
      weaponId,
      'seized',
      { seizedByPrincipalId },
    )

    this.eventBus?.emit(ATC_COMBAT_EVENTS.WEAPON_SEIZED, {
      weaponId,
      seizedByPrincipalId,
    }).catch(() => undefined)

    return weapon
  }

  async getWeapon(id: string): Promise<AtcWeaponRegistration | null> {
    return this.weaponRepo.findById(id)
  }

  async getRuntime(weaponId: string, holderPrincipalId: string): Promise<AtcWeaponRuntime | null> {
    return this.runtimeRepo.findByWeaponAndHolder(weaponId, holderPrincipalId)
  }

  async getEquippedByHolder(holderPrincipalId: string): Promise<AtcWeaponRuntime[]> {
    return this.runtimeRepo.findEquippedByHolder(holderPrincipalId)
  }
}
