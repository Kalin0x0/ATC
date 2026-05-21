export { EmergencyRuntimeService } from './emergency-runtime.service.js'
export type { EmergencyRuntimeDeps, CreateEmergencyInput, TriageInput as EmergencyTriageInput, AssignInput, StabilizeInput, TransportInput, CloseInput } from './emergency-runtime.service.js'

export { TriageService } from './triage.service.js'
export type { TriageInput } from './triage.service.js'

export { AmbulanceDispatchService } from './ambulance-dispatch.service.js'

export { HospitalCapacityService } from './hospital-capacity.service.js'

export { MedicalEscalationService } from './medical-escalation.service.js'
export type { EscalationResult } from './medical-escalation.service.js'

export { ReviveWorkflowService, DEFAULT_REVIVE_COOLDOWN_SECONDS } from './revive-workflow.service.js'
export type { ReviveWorkflowParams, ReviveWorkflowResult, RevivableService } from './revive-workflow.service.js'

export { EmergencyRepository } from './emergency.repository.js'
export type { CreateEmergencyParams, TransitionEmergencyParams, AssignResponderParams, TriageEmergencyParams } from './emergency.repository.js'

export { AmbulanceRepository } from './ambulance.repository.js'

export { HospitalCapacityRepository } from './hospital-capacity.repository.js'
export type { UpsertCapacityParams } from './hospital-capacity.repository.js'

export { ReviveAuditRepository } from './revive-audit.repository.js'
export type { RecordReviveParams } from './revive-audit.repository.js'

export type { EmsPool } from './pool.js'

export {
  EmsError,
  EmsValidationError,
  EmergencyNotFoundError,
  EmergencyClosedError,
  EmergencyImmutableError,
  AmbulanceNotFoundError,
  AmbulanceUnavailableError,
  HospitalCapacityNotFoundError,
  HospitalAtCapacityError,
  ReviveCooldownError,
  TriageValidationError,
} from './errors.js'
