import type { AtcEventBus } from '@atc/events'
import type { EnvironmentalHazardRepository, AtcEnvironmentalHazard } from './environmental-hazard.repository.js'
import type { EnvironmentalExposureRepository, AtcEnvironmentalExposure } from './environmental-exposure.repository.js'

export class EnvironmentalHazardService {
  constructor(
    private readonly hazardRepo: EnvironmentalHazardRepository,
    private readonly exposureRepo: EnvironmentalExposureRepository,
    private readonly eventBus: AtcEventBus | undefined,
  ) {}

  async createHazard(
    hazardId: string,
    hazardType: string,
    zoneId: string,
    severity: number,
    ownerServerId?: string | undefined,
  ): Promise<AtcEnvironmentalHazard> {
    const hazard = await this.hazardRepo.create(hazardId, hazardType, zoneId, severity, ownerServerId)

    this.eventBus?.emit('atc:survival:environmental_hazard_triggered', {
      hazardId: hazard.hazardId,
      hazardType: hazard.hazardType,
      zoneId: hazard.zoneId,
      severity: hazard.severity,
    }).catch(() => undefined)

    return hazard
  }

  async deactivateHazard(hazardId: string): Promise<AtcEnvironmentalHazard> {
    const hazard = await this.hazardRepo.deactivate(hazardId)

    this.eventBus?.emit('atc:survival:hazard_deactivated', {
      hazardId: hazard.hazardId,
      zoneId: hazard.zoneId,
    }).catch(() => undefined)

    return hazard
  }

  async recordExposure(
    playerId: string,
    hazardId: string,
    exposureType: string,
    severity: number,
  ): Promise<AtcEnvironmentalExposure> {
    const exposure = await this.exposureRepo.recordExposure(
      playerId,
      hazardId,
      exposureType,
      severity,
    )

    this.eventBus?.emit('atc:survival:exposure_recorded', {
      playerId,
      hazardId,
      exposureType,
      severity,
    }).catch(() => undefined)

    return exposure
  }

  async getActiveHazards(): Promise<AtcEnvironmentalHazard[]> {
    return this.hazardRepo.listActive()
  }

  async getHazardsByZone(zoneId: string): Promise<AtcEnvironmentalHazard[]> {
    return this.hazardRepo.listByZone(zoneId)
  }
}
