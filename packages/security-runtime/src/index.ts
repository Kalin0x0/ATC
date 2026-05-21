// Pool types
export type { PoolConnection, SecurityRuntimePool } from './pool.js'

// ID generation
export { generateId } from './id.js'

// Errors
export {
  SecurityRuntimeError,
  IntrusionNotFoundError,
  DuplicateIntrusionError,
  ThreatNotFoundError,
  DuplicateThreatError,
  EscalationNotFoundError,
  DuplicateEscalationError,
  ContainmentNotFoundError,
  DuplicateContainmentError,
} from './errors.js'

// Runtime Intrusion Repository
export type {
  AtcIntrusionType,
  AtcIntrusionStatus,
  AtcRuntimeIntrusion,
  CreateIntrusionParams,
} from './runtime-intrusion.repository.js'
export { RuntimeIntrusionRepository } from './runtime-intrusion.repository.js'

// Runtime Threat Repository
export type {
  AtcThreatType,
  AtcThreatSeverity,
  AtcThreatStatus,
  AtcRuntimeThreat,
  CreateThreatParams,
} from './runtime-threat.repository.js'
export { RuntimeThreatRepository } from './runtime-threat.repository.js'

// Runtime Isolation Repository
export type {
  AtcIsolationType,
  AtcIsolationStatus,
  AtcRuntimeIsolation,
  IsolateEntityParams,
} from './runtime-isolation.repository.js'
export { RuntimeIsolationRepository } from './runtime-isolation.repository.js'

// Security Escalation Repository
export type {
  AtcEscalationType,
  AtcEscalationStatus,
  AtcSecurityEscalation,
  CreateEscalationParams,
} from './security-escalation.repository.js'
export { SecurityEscalationRepository } from './security-escalation.repository.js'

// Threat Containment Repository
export type {
  AtcContainmentType,
  AtcContainmentStatus,
  AtcThreatContainment,
  CreateContainmentParams,
} from './threat-containment.repository.js'
export { ThreatContainmentRepository } from './threat-containment.repository.js'

// Security Audit Repository
export type {
  AtcSecurityAuditEntry,
  AppendSecurityAuditParams,
} from './security-audit.repository.js'
export { SecurityAuditRepository } from './security-audit.repository.js'

// Event Bus interface (canonical definition)
export type { SecurityRuntimeEventBus } from './runtime-security-recovery.service.js'

// Services
export { RuntimeIntrusionDetectionService } from './runtime-intrusion-detection.service.js'
export { AutonomousProtectionService } from './autonomous-protection.service.js'
export { RuntimeIsolationService } from './runtime-isolation.service.js'
export { SecurityEscalationService } from './security-escalation.service.js'
export { ThreatContainmentService } from './threat-containment.service.js'
export { RuntimeSecurityRecoveryService } from './runtime-security-recovery.service.js'
