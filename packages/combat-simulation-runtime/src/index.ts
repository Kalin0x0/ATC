// Pool
export type { PoolConnection, CombatSimulationPool } from './pool.js'

// ID
export { generateId } from './id.js'

// Errors
export {
  CombatSimulationError,
  CombatSessionNotFoundError,
  DuplicateCombatSessionError,
  BallisticsNotFoundError,
  TacticalDamageNotFoundError,
  SuppressionNotFoundError,
  ArmorRuntimeNotFoundError,
  CombatSessionAlreadyActiveError,
} from './errors.js'

// Combat Runtime Repository
export type {
  AtcCombatSession,
  AtcCombatType,
  AtcCombatStatus,
  CreateCombatSessionParams,
} from './combat-runtime.repository.js'
export { CombatRuntimeRepository } from './combat-runtime.repository.js'

// Ballistics Runtime Repository
export type {
  AtcBallisticRecord,
  AtcBallisticType,
  CreateBallisticParams,
} from './ballistics-runtime.repository.js'
export { BallisticsRuntimeRepository } from './ballistics-runtime.repository.js'

// Tactical Damage Repository
export type {
  AtcTacticalDamage,
  AtcDamageType,
  CreateDamageParams,
} from './tactical-damage.repository.js'
export { TacticalDamageRepository } from './tactical-damage.repository.js'

// Suppression Runtime Repository
export type {
  AtcSuppressionRuntime,
  AtcSuppressionType,
  UpsertSuppressionParams,
} from './suppression-runtime.repository.js'
export { SuppressionRuntimeRepository } from './suppression-runtime.repository.js'

// Armor Runtime Repository
export type {
  AtcArmorRuntime,
  AtcArmorType,
  UpsertArmorParams,
} from './armor-runtime.repository.js'
export { ArmorRuntimeRepository } from './armor-runtime.repository.js'

// Combat Audit Repository
export type {
  AtcCombatAuditRecord,
  AppendAuditParams,
} from './combat-audit.repository.js'
export { CombatAuditRepository } from './combat-audit.repository.js'

// Services
export type { CombatSimulationEventBus } from './combat-simulation.service.js'
export { CombatSimulationService } from './combat-simulation.service.js'
export { BallisticsRuntimeService } from './ballistics-runtime.service.js'
export { TacticalDamageService } from './tactical-damage.service.js'
export { ArmorPenetrationService } from './armor-penetration.service.js'
export { SuppressionRuntimeService } from './suppression-runtime.service.js'
export { CombatRecoveryService } from './combat-recovery.service.js'
