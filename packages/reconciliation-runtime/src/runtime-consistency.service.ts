import type { RuntimeMigrationRepository } from './runtime-migration.repository.js'
import type { NodeTransferRepository } from './node-transfer.repository.js'
import type { RuntimeConsistencyAuditRepository } from './runtime-consistency-audit.repository.js'

const STALE_THRESHOLD_MS = 300_000

export class RuntimeConsistencyService {
  constructor(
    private readonly migrationRepo: RuntimeMigrationRepository,
    private readonly transferRepo: NodeTransferRepository,
    private readonly auditRepo: RuntimeConsistencyAuditRepository
  ) {}

  async validateConsistency(
    serverId?: string | undefined,
    regionId?: string | undefined
  ): Promise<{ consistent: boolean; issues: number }> {
    const [staleMigrations, activeTransfers] = await Promise.all([
      this.migrationRepo.listStale(STALE_THRESHOLD_MS),
      this.transferRepo.listActive(),
    ])

    const issues = staleMigrations.length + activeTransfers.length

    await this.auditRepo.record(
      'system',
      'consistency:validated',
      serverId,
      {
        regionId: regionId ?? null,
        staleMigrations: staleMigrations.length,
        activeTransfers: activeTransfers.length,
        issues,
        consistent: issues === 0,
      }
    )

    return { consistent: issues === 0, issues }
  }
}
