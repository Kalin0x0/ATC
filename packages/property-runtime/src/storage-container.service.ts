import type { AtcPropertyStash, AtcPropertyStashItem, AtcPropertyStashType } from '@atc/shared-types'
import { ATC_PROPERTY_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { PropertyStashRepository, CreateStashParams } from './property-stash.repository.js'
import { StashNotFoundError } from './errors.js'

export interface StorageContainerDeps {
  stashRepo: PropertyStashRepository
  eventBus: AtcEventBus | undefined
}

export interface DepositParams {
  itemName: string
  quantity: number
  metadata?: unknown
  addedByPrincipalId: string
}

export interface WithdrawParams {
  itemName: string
  quantity: number
  removedByPrincipalId: string
}

export class StorageContainerService {
  private readonly stashRepo: PropertyStashRepository
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: StorageContainerDeps) {
    this.stashRepo = deps.stashRepo
    this.eventBus  = deps.eventBus
  }

  async createStash(params: CreateStashParams): Promise<AtcPropertyStash> {
    return this.stashRepo.createStash(params)
  }

  async getStash(propertyId: string, stashId: string): Promise<AtcPropertyStash | null> {
    return this.stashRepo.findByStashId(propertyId, stashId)
  }

  async listStashes(propertyId: string): Promise<AtcPropertyStash[]> {
    return this.stashRepo.listByProperty(propertyId)
  }

  async deposit(
    propertyId: string,
    stashId: string,
    params: DepositParams,
  ): Promise<AtcPropertyStashItem> {
    const stash = await this.stashRepo.findByStashId(propertyId, stashId)
    if (!stash) throw new StashNotFoundError(stashId)

    const item = await this.stashRepo.deposit(
      stash.id,
      params.itemName,
      params.quantity,
      params.metadata ?? null,
      params.addedByPrincipalId,
    )

    this.eventBus?.emit(ATC_PROPERTY_EVENTS.STASH_DEPOSIT, {
      propertyId,
      stashId,
      itemName: params.itemName,
      quantity: params.quantity,
      principalId: params.addedByPrincipalId,
    }).catch(() => undefined)

    return item
  }

  async withdraw(
    propertyId: string,
    stashId: string,
    params: WithdrawParams,
  ): Promise<void> {
    const stash = await this.stashRepo.findByStashId(propertyId, stashId)
    if (!stash) throw new StashNotFoundError(stashId)

    await this.stashRepo.withdraw(
      stash.id,
      params.itemName,
      params.quantity,
      params.removedByPrincipalId,
    )

    this.eventBus?.emit(ATC_PROPERTY_EVENTS.STASH_WITHDRAW, {
      propertyId,
      stashId,
      itemName: params.itemName,
      quantity: params.quantity,
      principalId: params.removedByPrincipalId,
    }).catch(() => undefined)
  }

  async getContents(propertyId: string, stashId: string): Promise<AtcPropertyStashItem[]> {
    const stash = await this.stashRepo.findByStashId(propertyId, stashId)
    if (!stash) throw new StashNotFoundError(stashId)
    return this.stashRepo.getContents(stash.id)
  }

  async getCapacity(
    propertyId: string,
    stashId: string,
  ): Promise<{ capacity: number; used: number; available: number }> {
    const stash = await this.stashRepo.findByStashId(propertyId, stashId)
    if (!stash) throw new StashNotFoundError(stashId)
    const items = await this.stashRepo.getContents(stash.id)
    const used = items.length
    return { capacity: stash.capacity, used, available: stash.capacity - used }
  }
}
