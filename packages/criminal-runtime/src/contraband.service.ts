import type { AtcContraband } from '@atc/shared-types'
import { ATC_CRIMINAL_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { ContrabandRepository } from './contraband.repository.js'
export interface ContrabandDeps {
  contrabandRepo: ContrabandRepository
  eventBus: AtcEventBus | undefined
}

export interface RegisterContrabandServiceParams {
  propertyId?: string | null | undefined
  stashId?: string | null | undefined
  itemName: string
  quantity: number
  registeredByPrincipalId: string
}

export class ContrabandService {
  private readonly contrabandRepo: ContrabandRepository
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: ContrabandDeps) {
    this.contrabandRepo = deps.contrabandRepo
    this.eventBus       = deps.eventBus
  }

  async register(params: RegisterContrabandServiceParams): Promise<AtcContraband> {
    const item = await this.contrabandRepo.register({
      propertyId: params.propertyId,
      stashId: params.stashId,
      itemName: params.itemName,
      quantity: params.quantity,
      registeredByPrincipalId: params.registeredByPrincipalId,
    })

    this.eventBus?.emit(ATC_CRIMINAL_EVENTS.CONTRABAND_REGISTERED, {
      contrabandId: item.id,
      itemName: item.itemName,
      quantity: item.quantity,
      propertyId: item.propertyId,
      registeredByPrincipalId: item.registeredByPrincipalId,
    }).catch(() => undefined)

    return item
  }

  async seize(id: string, seizedByPrincipalId: string): Promise<AtcContraband> {
    const item = await this.contrabandRepo.seize(id, seizedByPrincipalId)

    this.eventBus?.emit(ATC_CRIMINAL_EVENTS.CONTRABAND_SEIZED, {
      contrabandId: item.id,
      itemName: item.itemName,
      quantity: item.quantity,
      seizedByPrincipalId,
    }).catch(() => undefined)

    return item
  }

  async destroy(id: string): Promise<AtcContraband> {
    return this.contrabandRepo.destroy(id)
  }

  async findById(id: string): Promise<AtcContraband | null> {
    return this.contrabandRepo.findById(id)
  }

  async listByProperty(propertyId: string): Promise<AtcContraband[]> {
    return this.contrabandRepo.listByProperty(propertyId)
  }
}
