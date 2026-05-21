import type { AtcEventBus } from '@atc/events'
import type {
  PursuitRepository,
  AtcVehiclePursuit,
  CreatePursuitParams,
  TransitionPursuitOptions,
  AtcPursuitStatus,
} from './pursuit.repository.js'
import type { VehicleSimPool } from './pool.js'

export interface PursuitRuntimeDeps {
  pursuitRepo: PursuitRepository
  pool: VehicleSimPool
  eventBus: AtcEventBus | undefined
}

export class PursuitRuntimeService {
  private readonly pursuitRepo: PursuitRepository
  private readonly pool: VehicleSimPool
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: PursuitRuntimeDeps) {
    this.pursuitRepo = deps.pursuitRepo
    this.pool        = deps.pool
    this.eventBus    = deps.eventBus
  }

  async startPursuit(params: CreatePursuitParams): Promise<AtcVehiclePursuit> {
    const pursuit = await this.pursuitRepo.create(params)

    this.eventBus?.emit('atc:vehicle:pursuit:started', {
      pursuitId: pursuit.id,
      vehicleRuntimeId: pursuit.vehicleRuntimeId,
      suspectPrincipalId: pursuit.suspectPrincipalId,
    }).catch(() => undefined)

    return pursuit
  }

  async endPursuit(
    pursuitId: string,
    status: AtcPursuitStatus,
    opts: TransitionPursuitOptions = {},
  ): Promise<AtcVehiclePursuit> {
    const pursuit = await this.pursuitRepo.transition(pursuitId, status, opts)

    this.eventBus?.emit('atc:vehicle:pursuit:ended', {
      pursuitId: pursuit.id,
      status: pursuit.status,
      vehicleRuntimeId: pursuit.vehicleRuntimeId,
    }).catch(() => undefined)

    return pursuit
  }

  async findActivePursuit(vehicleRuntimeId: string): Promise<AtcVehiclePursuit | null> {
    return this.pursuitRepo.findActiveByVehicle(vehicleRuntimeId)
  }

  async cleanStalePursuits(olderThanMinutes: number): Promise<number> {
    return this.pursuitRepo.cleanStale(olderThanMinutes)
  }
}
