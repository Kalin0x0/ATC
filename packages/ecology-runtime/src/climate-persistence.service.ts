import type {
  ClimateRuntimeRepository,
  AtcClimateRuntime,
  AtcClimateType,
} from './climate-runtime.repository.js'
import type { EcologyAuditRepository } from './ecology-audit.repository.js'
import type { EcologyRuntimeEventBus } from './ecology-recovery.service.js'

export interface UpsertClimateServiceParams {
  regionId: string
  climateType: AtcClimateType
  ownerServerId: string
  temperature: number
  humidity: number
  climateData?: Record<string, unknown> | undefined
}

export class ClimatePersistenceService {
  constructor(
    private readonly climateRepo: ClimateRuntimeRepository,
    private readonly auditRepo: EcologyAuditRepository,
    private readonly eventBus: EcologyRuntimeEventBus,
  ) {}

  async upsertClimate(params: UpsertClimateServiceParams): Promise<AtcClimateRuntime> {
    const climate = await this.climateRepo.upsert({
      status: 'stable',
      regionId: params.regionId,
      climateType: params.climateType,
      ownerServerId: params.ownerServerId,
      temperature: params.temperature,
      humidity: params.humidity,
      ...(params.climateData !== undefined ? { climateData: params.climateData } : {}),
    })

    this.eventBus.emit('atc:ecology:climate:updated', {
      id: climate.id,
      regionId: climate.regionId,
      climateType: climate.climateType,
      status: climate.status,
      temperature: climate.temperature,
      humidity: climate.humidity,
      ownerServerId: climate.ownerServerId,
    }).catch(() => undefined)

    return climate
  }

  async getClimate(regionId: string): Promise<AtcClimateRuntime | null> {
    return this.climateRepo.findByRegion(regionId)
  }
}
