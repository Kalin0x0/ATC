import type { WorldRegionRepository, AtcWorldRegion, UpsertWorldRegionParams } from './world-region.repository.js'
import type { WorldOrchestrationAuditRepository } from './world-orchestration-audit.repository.js'

export interface WorldOrchestratorEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export class WorldOrchestratorService {
  constructor(
    private readonly worldRegionRepo: WorldRegionRepository,
    private readonly auditRepo: WorldOrchestrationAuditRepository,
    private readonly eventBus?: WorldOrchestratorEventBus | undefined,
  ) {}

  async registerRegion(params: UpsertWorldRegionParams): Promise<AtcWorldRegion> {
    const region = await this.worldRegionRepo.upsert(params)

    await this.auditRepo.record(region.regionId, 'region:registered', region.ownerServerId ?? undefined, {
      regionType: region.regionType,
    })

    this.eventBus
      ?.emit('atc:orchestrator:region:registered', {
        regionId: region.regionId,
        regionType: region.regionType,
        ownerServerId: region.ownerServerId,
      })
      .catch(() => undefined)

    return region
  }

  async listRegions(): Promise<AtcWorldRegion[]> {
    return this.worldRegionRepo.listActive()
  }

  async transferRegion(
    regionId: string,
    fromServerId: string,
    toServerId: string,
  ): Promise<AtcWorldRegion> {
    const region = await this.worldRegionRepo.transfer(regionId, fromServerId, toServerId)

    await this.auditRepo.record(regionId, 'region:transferred', toServerId, {
      fromServerId,
      toServerId,
    })

    this.eventBus
      ?.emit('atc:orchestrator:region:transferred', {
        regionId,
        fromServerId,
        toServerId,
      })
      .catch(() => undefined)

    return region
  }

  async deactivateRegion(regionId: string): Promise<void> {
    await this.worldRegionRepo.deactivate(regionId)

    await this.auditRepo.record(regionId, 'region:deactivated', undefined, { regionId })
  }

  async recover(regionId?: string | undefined): Promise<{ recovered: number }> {
    let recovered = 0

    if (regionId !== undefined) {
      const region = await this.worldRegionRepo.findByRegionId(regionId)
      if (region?.isActive) {
        await this.worldRegionRepo.deactivate(regionId)
        await this.auditRepo.record(regionId, 'region:recovered', undefined, { regionId })
        recovered++
      }
    }

    return { recovered }
  }
}
