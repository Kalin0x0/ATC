import type {
  EnvironmentalEvolutionRepository,
  AtcEnvironmentalEvolution,
  AtcEvolutionType,
} from './environmental-evolution.repository.js'
import type { EcologyAuditRepository } from './ecology-audit.repository.js'
import type { EcologyRuntimeEventBus } from './ecology-recovery.service.js'
import { generateId } from './id.js'

export interface CreateEvolutionServiceParams {
  evolutionType: AtcEvolutionType
  ownerServerId: string
  regionId?: string | null | undefined
  evolutionNonce: string
  evolutionData?: Record<string, unknown> | undefined
}

export class EnvironmentalEvolutionService {
  constructor(
    private readonly evolutionRepo: EnvironmentalEvolutionRepository,
    private readonly auditRepo: EcologyAuditRepository,
    private readonly eventBus: EcologyRuntimeEventBus,
  ) {}

  async startEvolution(params: CreateEvolutionServiceParams): Promise<AtcEnvironmentalEvolution> {
    const evolutionId = generateId()
    const evolution = await this.evolutionRepo.create({
      evolutionId,
      status: 'pending',
      evolutionType: params.evolutionType,
      ownerServerId: params.ownerServerId,
      evolutionNonce: params.evolutionNonce,
      ...(params.regionId !== undefined ? { regionId: params.regionId } : {}),
      ...(params.evolutionData !== undefined ? { evolutionData: params.evolutionData } : {}),
    })

    await this.auditRepo.append({
      eventType: 'evolution_started',
      ecologyId: evolutionId,
      regionId: evolution.regionId ?? undefined,
      ownerServerId: evolution.ownerServerId,
      auditData: { evolutionType: evolution.evolutionType, status: evolution.status },
    })

    this.eventBus.emit('atc:ecology:evolution:started', {
      id: evolution.id,
      evolutionId: evolution.evolutionId,
      evolutionType: evolution.evolutionType,
      status: evolution.status,
      ownerServerId: evolution.ownerServerId,
    }).catch(() => undefined)

    return evolution
  }

  async completeEvolution(id: string): Promise<AtcEnvironmentalEvolution> {
    return this.evolutionRepo.updateStatus(id, 'completed', new Date())
  }

  async failEvolution(id: string): Promise<AtcEnvironmentalEvolution> {
    return this.evolutionRepo.updateStatus(id, 'failed')
  }

  async getEvolution(id: string): Promise<AtcEnvironmentalEvolution | null> {
    return this.evolutionRepo.findById(id)
  }
}
