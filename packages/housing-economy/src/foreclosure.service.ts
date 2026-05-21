import type { AtcEventBus } from '@atc/events'
import type {
  ForeclosureRepository,
  AtcForeclosure,
  StartForeclosureParams,
} from './foreclosure.repository.js'
import {
  ForeclosureNotFoundError,
  ForeclosureAlreadyActiveError,
  ForeclosureCompletedError,
} from './errors.js'

export class ForeclosureService {
  constructor(
    private readonly foreclosureRepo: ForeclosureRepository,
    private readonly eventBus: AtcEventBus,
  ) {}

  async startForeclosure(params: StartForeclosureParams): Promise<AtcForeclosure> {
    const existing = await this.foreclosureRepo.findByNonce(params.foreclosureNonce)
    if (existing) return existing

    const active = await this.foreclosureRepo.findActiveByProperty(params.propertyId)
    if (active) {
      throw new ForeclosureAlreadyActiveError(params.propertyId)
    }

    const foreclosure = await this.foreclosureRepo.create(params)

    this.eventBus
      .emit('atc:housing:foreclosure:started', {
        foreclosureId: foreclosure.id,
        propertyId: foreclosure.propertyId,
        contractId: foreclosure.contractId,
        initiatedByPrincipalId: foreclosure.initiatedByPrincipalId,
        reason: foreclosure.reason,
      })
      .catch(() => undefined)

    return foreclosure
  }

  async completeForeclosure(foreclosureId: string): Promise<AtcForeclosure> {
    const foreclosure = await this.foreclosureRepo.findById(foreclosureId)
    if (!foreclosure) throw new ForeclosureNotFoundError(foreclosureId)
    if (foreclosure.status === 'completed') {
      throw new ForeclosureCompletedError(foreclosureId)
    }

    const updated = await this.foreclosureRepo.transition(foreclosureId, 'completed')

    this.eventBus
      .emit('atc:housing:foreclosure:completed', {
        foreclosureId: updated.id,
        propertyId: updated.propertyId,
        contractId: updated.contractId,
        completedAt: updated.completedAt?.toISOString() ?? null,
      })
      .catch(() => undefined)

    return updated
  }

  async cancelForeclosure(foreclosureId: string, reason: string): Promise<AtcForeclosure> {
    const foreclosure = await this.foreclosureRepo.findById(foreclosureId)
    if (!foreclosure) throw new ForeclosureNotFoundError(foreclosureId)
    if (foreclosure.status === 'completed') {
      throw new ForeclosureCompletedError(foreclosureId)
    }

    const updated = await this.foreclosureRepo.transition(foreclosureId, 'cancelled', {
      notes: reason,
    })

    this.eventBus
      .emit('atc:housing:foreclosure:cancelled', {
        foreclosureId: updated.id,
        propertyId: updated.propertyId,
        reason,
      })
      .catch(() => undefined)

    return updated
  }

  async cleanStale(olderThanHours: number): Promise<number> {
    return this.foreclosureRepo.cleanStale(olderThanHours)
  }
}
