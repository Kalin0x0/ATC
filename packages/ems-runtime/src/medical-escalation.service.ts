import type { AtcEmsEmergency, AtcTraumaState } from '@atc/shared-types'
import { ATC_EMS_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'

// Trauma states that warrant immediate escalation
const ESCALATION_STATES: AtcTraumaState[] = ['cardiac_arrest', 'unconscious', 'deceased']

// Emergency statuses that allow escalation
const ESCALATABLE_STATUSES = ['reported', 'triaged', 'responders_assigned', 'en_route', 'on_scene'] as const

export interface EscalationResult {
  shouldEscalate: boolean
  reason: string | null
}

export class MedicalEscalationService {
  constructor(private readonly eventBus: AtcEventBus | undefined) {}

  // Determine whether a trauma state warrants escalating the emergency priority
  checkEscalation(emergency: AtcEmsEmergency, traumaState?: AtcTraumaState): EscalationResult {
    if (!ESCALATABLE_STATUSES.includes(emergency.status as typeof ESCALATABLE_STATUSES[number])) {
      return { shouldEscalate: false, reason: null }
    }
    if (traumaState && ESCALATION_STATES.includes(traumaState)) {
      return {
        shouldEscalate: true,
        reason: `Trauma state escalated to: ${traumaState}`,
      }
    }
    if (emergency.triageCategory === 'red') {
      return { shouldEscalate: true, reason: 'Red triage — immediate response required' }
    }
    return { shouldEscalate: false, reason: null }
  }

  // Emit escalation event (fire-and-forget)
  escalate(emergencyId: string, characterId: string, reason: string, principalId: string): void {
    this.eventBus
      ?.emit(ATC_EMS_EVENTS.EMERGENCY_ESCALATED, { emergencyId, characterId, reason, principalId })
      .catch(() => undefined)
  }

  // Evaluate + escalate if warranted; returns whether escalation was triggered
  evaluateAndEscalate(emergency: AtcEmsEmergency, principalId: string, traumaState?: AtcTraumaState): boolean {
    const result = this.checkEscalation(emergency, traumaState)
    if (result.shouldEscalate && result.reason) {
      this.escalate(emergency.id, emergency.characterId, result.reason, principalId)
      return true
    }
    return false
  }
}
