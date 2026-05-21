import type { ReconciliationRuntimeRepository } from './reconciliation-runtime.repository.js'
import type {
  AtcReconciliationType,
  AtcReconciliationRuntime,
} from './reconciliation-runtime.repository.js'
import type { RuntimeMigrationRepository } from './runtime-migration.repository.js'
import type { NodeTransferRepository } from './node-transfer.repository.js'
import type { RuntimeConsistencyAuditRepository } from './runtime-consistency-audit.repository.js'
import type { ReconciliationEventBus } from './runtime-migration.service.js'

export class CrossNodeReconciliationService {
  constructor(
    private readonly reconciliationRepo: ReconciliationRuntimeRepository,
    private readonly migrationRepo: RuntimeMigrationRepository,
    private readonly transferRepo: NodeTransferRepository,
    private readonly auditRepo: RuntimeConsistencyAuditRepository,
    private readonly eventBus?: ReconciliationEventBus | undefined
  ) {}

  async reconcile(
    reconciliationId: string,
    reconciliationType: AtcReconciliationType,
    regionId?: string | undefined,
    serverId?: string | undefined
  ): Promise<{ reconciled: number }> {
    await this.reconciliationRepo.upsert({
      reconciliationId,
      reconciliationType,
      regionId,
      serverId,
    })

    const [activeMigrations, activeTransfers] = await Promise.all([
      this.migrationRepo.listActive(),
      this.transferRepo.listActive(),
    ])

    const issuesFound = activeMigrations.length + activeTransfers.length
    const issuesResolved = 0

    await this.reconciliationRepo.complete(reconciliationId, issuesFound, issuesResolved)

    await this.auditRepo.record(
      reconciliationId,
      'reconciliation:completed',
      serverId,
      {
        reconciliationType,
        regionId: regionId ?? null,
        issuesFound,
        issuesResolved,
      }
    )

    this.eventBus
      ?.emit('atc:reconciliation:reconcile:completed', {
        reconciliationId,
        reconciliationType,
        regionId: regionId ?? null,
        serverId: serverId ?? null,
        issuesFound,
        issuesResolved,
        reconciled: issuesFound,
      })
      .catch(() => undefined)

    return { reconciled: issuesFound }
  }

  async listActiveReconciliations(): Promise<AtcReconciliationRuntime[]> {
    return this.reconciliationRepo.listActive()
  }
}
