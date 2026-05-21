import type {
  WildlifeRuntimeRepository,
  AtcWildlifeRuntime,
  AtcWildlifeType,
} from './wildlife-runtime.repository.js'
import type { EcologyAuditRepository } from './ecology-audit.repository.js'
import type { EcologyRuntimeEventBus } from './ecology-recovery.service.js'

export interface UpsertWildlifeServiceParams {
  zoneId: string
  wildlifeType: AtcWildlifeType
  ownerServerId: string
  population: number
  wildlifeData?: Record<string, unknown> | undefined
}

export class WildlifeSimulationService {
  constructor(
    private readonly wildlifeRepo: WildlifeRuntimeRepository,
    private readonly auditRepo: EcologyAuditRepository,
    private readonly eventBus: EcologyRuntimeEventBus,
  ) {}

  async upsertWildlife(params: UpsertWildlifeServiceParams): Promise<AtcWildlifeRuntime> {
    const wildlife = await this.wildlifeRepo.upsert({
      status: 'stable',
      zoneId: params.zoneId,
      wildlifeType: params.wildlifeType,
      ownerServerId: params.ownerServerId,
      population: params.population,
      ...(params.wildlifeData !== undefined ? { wildlifeData: params.wildlifeData } : {}),
    })

    this.eventBus.emit('atc:ecology:wildlife:updated', {
      id: wildlife.id,
      zoneId: wildlife.zoneId,
      wildlifeType: wildlife.wildlifeType,
      status: wildlife.status,
      population: wildlife.population,
      ownerServerId: wildlife.ownerServerId,
    }).catch(() => undefined)

    return wildlife
  }

  async getWildlife(zoneId: string): Promise<AtcWildlifeRuntime | null> {
    return this.wildlifeRepo.findByZone(zoneId)
  }
}
