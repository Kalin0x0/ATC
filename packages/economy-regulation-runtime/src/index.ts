// Pool
export type { PoolConnection, EconomyRegulationPool } from './pool.js'

// ID generation
export { generateId } from './id.js'

// Errors
export {
  EconomyRegulationError,
  RegulationNotFoundError,
  DuplicateRegulationError,
  BalancingNotFoundError,
  DuplicateBalancingError,
  StabilizationNotFoundError,
  DuplicateStabilizationError,
} from './errors.js'

// Economy Regulation Repository
export type {
  AtcRegulationType,
  AtcRegulationStatus,
  AtcEconomyRegulation,
  CreateRegulationParams,
} from './economy-regulation.repository.js'
export { EconomyRegulationRepository } from './economy-regulation.repository.js'

// Resource Balancing Repository
export type {
  AtcResourceType,
  AtcBalancingStatus,
  AtcResourceBalancing,
  CreateBalancingParams,
} from './resource-balancing.repository.js'
export { ResourceBalancingRepository } from './resource-balancing.repository.js'

// Market Stabilization Repository
export type {
  AtcMarketType,
  AtcStabilizationStatus,
  AtcMarketStabilization,
  CreateStabilizationParams,
} from './market-stabilization.repository.js'
export { MarketStabilizationRepository } from './market-stabilization.repository.js'

// Tax Runtime Repository
export type {
  AtcTaxType,
  AtcTaxStatus,
  AtcTaxRuntime,
  UpsertTaxParams,
} from './tax-runtime.repository.js'
export { TaxRuntimeRepository } from './tax-runtime.repository.js'

// Inflation Runtime Repository
export type {
  AtcInflationStatus,
  AtcInflationRuntime,
  UpsertInflationParams,
} from './inflation-runtime.repository.js'
export { InflationRuntimeRepository } from './inflation-runtime.repository.js'

// Economy Audit Repository
export type {
  AtcEconomyAuditEntry,
  AppendEconomyAuditParams,
} from './economy-audit.repository.js'
export { EconomyAuditRepository } from './economy-audit.repository.js'

// Event Bus interface (canonical definition)
export type { EconomyRegulationEventBus } from './economic-recovery.service.js'

// Services
export { EconomyRegulationService } from './economy-regulation.service.js'
export { ResourceBalancingService } from './resource-balancing.service.js'
export { InflationControlService } from './inflation-control.service.js'
export { AutonomousTaxAdjustmentService } from './autonomous-tax-adjustment.service.js'
export { MarketStabilizationService } from './market-stabilization.service.js'
export { EconomicRecoveryService } from './economic-recovery.service.js'
