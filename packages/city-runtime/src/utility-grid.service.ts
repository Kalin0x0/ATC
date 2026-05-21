import type { AtcEventBus } from '@atc/events'
import type {
  UtilityGridRepository,
  AtcUtilityGrid,
  AtcUtilityType,
} from './utility-grid.repository.js'
import type { CityRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { UtilityGridAlreadyRestoredError } from './errors.js'

export class UtilityGridService {
  constructor(
    private readonly gridRepo: UtilityGridRepository,
    private readonly pool: CityRuntimePool,
    private readonly eventBus: AtcEventBus | undefined,
  ) {}

  async reportOutage(
    gridId: string,
    gridName: string,
    utilityType: AtcUtilityType,
    outageNonce: string,
    reason: string,
    affectedZones?: string[] | undefined,
  ): Promise<AtcUtilityGrid> {
    // Idempotency: check nonce
    const existing = await this.gridRepo.findByOutageNonce(outageNonce)
    if (existing !== null) {
      return existing
    }

    // Ensure the grid row exists with correct name and type
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_utility_grids
           (id, grid_id, grid_name, utility_type, status, affected_zones,
            outage_nonce, outage_reason, outage_started_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'online', '[]', NULL, NULL, NULL, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           grid_name    = VALUES(grid_name),
           utility_type = VALUES(utility_type),
           updated_at   = NOW(3)`,
        [id, gridId, gridName, utilityType],
      )
    } finally {
      conn.release()
    }

    const grid = await this.gridRepo.transition(gridId, 'offline', {
      outageNonce,
      outageReason: reason,
      ...(affectedZones !== undefined ? { affectedZones } : {}),
    })

    this.eventBus?.emit('atc:city:utility_outage_started', {
      gridId: grid.gridId,
      gridName: grid.gridName,
      utilityType: grid.utilityType,
      affectedZones: grid.affectedZones,
      outageNonce,
    }).catch(() => undefined)

    return grid
  }

  async restoreGrid(gridId: string, restoredByPrincipalId: string): Promise<AtcUtilityGrid> {
    const current = await this.gridRepo.findByGridId(gridId)
    if (current !== null && current.status === 'online') {
      throw new UtilityGridAlreadyRestoredError(gridId)
    }

    const grid = await this.gridRepo.transition(gridId, 'online', {
      restoredByPrincipalId,
    })

    this.eventBus?.emit('atc:city:utility_restored', {
      gridId: grid.gridId,
      gridName: grid.gridName,
      utilityType: grid.utilityType,
      restoredByPrincipalId,
    }).catch(() => undefined)

    return grid
  }

  async getGrid(gridId: string): Promise<AtcUtilityGrid | null> {
    return this.gridRepo.findByGridId(gridId)
  }

  async listAll(): Promise<AtcUtilityGrid[]> {
    return this.gridRepo.listAll()
  }
}
