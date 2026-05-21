import type { RuntimeMigrationRepository } from './runtime-migration.repository.js'
import type { CreateMigrationParams, AtcRuntimeMigration } from './runtime-migration.repository.js'
import type { RuntimeConsistencyAuditRepository } from './runtime-consistency-audit.repository.js'

export interface ReconciliationEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export class RuntimeMigrationService {
  constructor(
    private readonly migrationRepo: RuntimeMigrationRepository,
    private readonly auditRepo: RuntimeConsistencyAuditRepository,
    private readonly eventBus?: ReconciliationEventBus | undefined
  ) {}

  async startMigration(params: CreateMigrationParams): Promise<AtcRuntimeMigration> {
    const migration = await this.migrationRepo.create(params)
    await this.auditRepo.record(
      migration.migrationId,
      'migration:started',
      migration.fromServerId,
      { entityId: migration.entityId, toServerId: migration.toServerId }
    )
    this.eventBus
      ?.emit('atc:reconciliation:migration:started', {
        migrationId: migration.migrationId,
        entityId: migration.entityId,
        fromServerId: migration.fromServerId,
        toServerId: migration.toServerId,
      })
      .catch(() => undefined)
    return migration
  }

  async completeMigration(migrationId: string): Promise<AtcRuntimeMigration> {
    const migration = await this.migrationRepo.transition(migrationId, 'completed')
    this.eventBus
      ?.emit('atc:reconciliation:migration:completed', {
        migrationId: migration.migrationId,
        entityId: migration.entityId,
        fromServerId: migration.fromServerId,
        toServerId: migration.toServerId,
      })
      .catch(() => undefined)
    return migration
  }

  async failMigration(
    migrationId: string,
    reason?: string | undefined
  ): Promise<AtcRuntimeMigration> {
    return this.migrationRepo.transition(migrationId, 'failed', reason)
  }

  async getMigration(migrationId: string): Promise<AtcRuntimeMigration | null> {
    return this.migrationRepo.findById(migrationId)
  }
}
