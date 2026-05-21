import type { InfluenceHistoryRepository } from './influence-history.repository.js'
import type { RelationshipAuditRepository } from './relationship-audit.repository.js'
import type { AtcReputationDecay, ReputationDecayRepository } from './reputation-decay.repository.js'
import type { ReputationRuntimeRepository } from './reputation-runtime.repository.js'
import type { EventBus } from './reputation-runtime.service.js'

export class ReputationDecayService {
  constructor(
    private readonly decayRepo: ReputationDecayRepository,
    private readonly reputationRepo: ReputationRuntimeRepository,
    private readonly influenceRepo: InfluenceHistoryRepository,
    private readonly auditRepo: RelationshipAuditRepository,
    private readonly eventBus?: EventBus,
  ) {}

  async scheduleDecay(
    principalId: string,
    factionId: string | null,
    decayRate: number,
    nextDecayAt: Date,
  ): Promise<AtcReputationDecay> {
    const record = await this.decayRepo.upsert(principalId, factionId, decayRate, nextDecayAt)

    await this.auditRepo
      .record(
        principalId,
        'reputation_decay',
        'schedule',
        undefined,
        JSON.stringify({
          decayRate,
          nextDecayAt: nextDecayAt.toISOString(),
          ...(factionId !== null ? { factionId } : {}),
        }),
      )
      .catch(() => undefined)

    return record
  }

  async applyDueDecay(): Promise<number> {
    const dueRecords = await this.decayRepo.listDue()
    let count = 0

    for (const decay of dueRecords) {
      try {
        if (decay.factionId !== null) {
          await this.reputationRepo.adjustScore(
            decay.principalId,
            decay.factionId,
            -decay.decayRate,
          )

          await this.influenceRepo
            .record(
              decay.principalId,
              -decay.decayRate,
              'decay',
              'scheduled_decay',
              decay.factionId,
            )
            .catch(() => undefined)
        }

        const nextDecayAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
        await this.decayRepo.markDecayed(decay.principalId, decay.factionId, nextDecayAt)

        await this.auditRepo
          .record(
            decay.principalId,
            'reputation_decay',
            'applied',
            undefined,
            JSON.stringify({
              decayRate: decay.decayRate,
              ...(decay.factionId !== null ? { factionId: decay.factionId } : {}),
            }),
          )
          .catch(() => undefined)

        count++
      } catch {
        // Continue processing remaining records even if one fails
      }
    }

    return count
  }

  async pauseDecay(principalId: string, factionId: string | null): Promise<void> {
    await this.decayRepo.setActive(principalId, factionId, false)

    await this.auditRepo
      .record(
        principalId,
        'reputation_decay',
        'pause',
        undefined,
        factionId !== null ? JSON.stringify({ factionId }) : undefined,
      )
      .catch(() => undefined)
  }

  async resumeDecay(principalId: string, factionId: string | null): Promise<void> {
    await this.decayRepo.setActive(principalId, factionId, true)

    await this.auditRepo
      .record(
        principalId,
        'reputation_decay',
        'resume',
        undefined,
        factionId !== null ? JSON.stringify({ factionId }) : undefined,
      )
      .catch(() => undefined)
  }
}
