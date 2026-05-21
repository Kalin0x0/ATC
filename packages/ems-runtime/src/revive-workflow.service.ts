import type { AtcTraumaRecord, AtcReviveAudit } from '@atc/shared-types'
import { ATC_EMS_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { ReviveAuditRepository } from './revive-audit.repository.js'
import { ReviveCooldownError } from './errors.js'

// Duck-typed interface for the medical service's revive capability
export interface RevivableService {
  revive(req: {
    characterId: string
    revivedByPrincipalId: string
    incidentId: string | null
    notes: string | null
  }): Promise<AtcTraumaRecord>
}

export interface ReviveWorkflowParams {
  characterId: string
  revivedByPrincipalId: string
  emergencyId?: string | null | undefined
  incidentId?: string | null | undefined
  notes?: string | null | undefined
}

export interface ReviveWorkflowResult {
  trauma: AtcTraumaRecord
  audit: AtcReviveAudit
}

// Default cooldown: 5 minutes between revives for the same character
export const DEFAULT_REVIVE_COOLDOWN_SECONDS = 300

export class ReviveWorkflowService {
  private readonly cooldownSeconds: number

  constructor(
    private readonly reviveAuditRepo: ReviveAuditRepository,
    private readonly medicalService: RevivableService,
    private readonly eventBus: AtcEventBus | undefined,
    cooldownSeconds = DEFAULT_REVIVE_COOLDOWN_SECONDS,
  ) {
    this.cooldownSeconds = cooldownSeconds
  }

  async revive(params: ReviveWorkflowParams): Promise<ReviveWorkflowResult> {
    // 1. Enforce cooldown window
    const recent = await this.reviveAuditRepo.findRecentRevive(params.characterId, this.cooldownSeconds)
    if (recent) {
      throw new ReviveCooldownError(params.characterId, this.cooldownSeconds)
    }

    // 2. Execute medical revive (trauma state: deceased → stable)
    const trauma = await this.medicalService.revive({
      characterId: params.characterId,
      revivedByPrincipalId: params.revivedByPrincipalId,
      incidentId: params.incidentId ?? null,
      notes: params.notes ?? null,
    })

    // 3. Record audit trail
    const audit = await this.reviveAuditRepo.record({
      characterId: params.characterId,
      emergencyId: params.emergencyId,
      revivedByPrincipalId: params.revivedByPrincipalId,
      previousState: 'deceased',
      resultingState: trauma.state,
      notes: params.notes,
    })

    // 4. Emit event (fire-and-forget)
    this.eventBus
      ?.emit(ATC_EMS_EVENTS.REVIVE_COMPLETED, {
        characterId: params.characterId,
        revivedByPrincipalId: params.revivedByPrincipalId,
        emergencyId: params.emergencyId ?? null,
        resultingState: trauma.state,
      })
      .catch(() => undefined)

    return { trauma, audit }
  }

  async listReviveHistory(characterId: string, limit?: number): Promise<AtcReviveAudit[]> {
    return this.reviveAuditRepo.listForCharacter(characterId, limit)
  }
}
