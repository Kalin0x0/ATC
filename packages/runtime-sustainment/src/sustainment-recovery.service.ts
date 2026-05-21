import type { RuntimeSustainmentRepository } from './runtime-sustainment.repository.js'
import type { InfiniteRecoveryRepository } from './infinite-recovery.repository.js'
import type { AutonomousMaintenanceRepository } from './autonomous-maintenance.repository.js'
import type { DistributedSustainmentRepository } from './distributed-sustainment.repository.js'
import type { RuntimeLongevityRepository } from './runtime-longevity.repository.js'
import type { SustainmentAuditRepository } from './sustainment-audit.repository.js'
import type { RuntimeSustainmentEventBus } from './runtime-sustainment.service.js'

export interface SustainmentCleanupResult {
  sustainments: number
  recoveries: number
  maintenances: number
  sustainmentNodes: number
  longevities: number
}

export class SustainmentRecoveryService {
  constructor(
    private readonly sustainmentRepo: RuntimeSustainmentRepository,
    private readonly recoveryRepo: InfiniteRecoveryRepository,
    private readonly maintenanceRepo: AutonomousMaintenanceRepository,
    private readonly sustainmentNodeRepo: DistributedSustainmentRepository,
    private readonly longevityRepo: RuntimeLongevityRepository,
    private readonly audit: SustainmentAuditRepository,
    private readonly bus: RuntimeSustainmentEventBus
  ) {}

  async cleanupStale(thresholdMs: number): Promise<SustainmentCleanupResult> {
    const [sustainments, recoveries, maintenances, sustainmentNodes, longevities] = await Promise.all([
      this.sustainmentRepo.cleanupStale(thresholdMs),
      this.recoveryRepo.cleanupStale(thresholdMs),
      this.maintenanceRepo.cleanupStale(thresholdMs),
      this.sustainmentNodeRepo.cleanupStale(thresholdMs),
      this.longevityRepo.cleanupStale(thresholdMs),
    ])
    this.bus.emit('sustainment.stale_cleaned', { sustainments, recoveries, maintenances, sustainmentNodes, longevities }).catch(() => undefined)
    return { sustainments, recoveries, maintenances, sustainmentNodes, longevities }
  }
}
