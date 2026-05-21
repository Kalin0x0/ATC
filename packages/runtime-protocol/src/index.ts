// Pool
export type { PoolConnection, RuntimeProtocolPool } from './pool.js'

// ID generator
export { generateId } from './id.js'

// Errors
export {
  RuntimeProtocolError,
  ProtocolNotFoundError,
  DuplicateProtocolError,
  FederationContractNotFoundError,
  DuplicateFederationContractError,
  RegistryEntryNotFoundError,
  HandshakeNotFoundError,
  DuplicateHandshakeError,
  BridgeNotFoundError,
} from './errors.js'

// Runtime Protocol Repository
export type {
  AtcProtocolType,
  AtcProtocolStatus,
  AtcRuntimeProtocol,
  CreateProtocolParams,
} from './runtime-protocol.repository.js'
export { RuntimeProtocolRepository } from './runtime-protocol.repository.js'

// Federation Contract Repository
export type {
  AtcFederationContractType,
  AtcFederationContractStatus,
  AtcFederationContract,
  CreateContractParams,
} from './federation-contract.repository.js'
export { FederationContractRepository } from './federation-contract.repository.js'

// Protocol Registry Repository
export type {
  AtcRegistryEntryType,
  AtcRegistryStatus,
  AtcProtocolRegistryEntry,
  UpsertRegistryParams,
} from './protocol-registry.repository.js'
export { ProtocolRegistryRepository } from './protocol-registry.repository.js'

// Runtime Handshake Repository
export type {
  AtcHandshakeType,
  AtcHandshakeStatus,
  AtcRuntimeHandshake,
  CreateHandshakeParams,
} from './runtime-handshake.repository.js'
export { RuntimeHandshakeRepository } from './runtime-handshake.repository.js'

// Protocol Bridge Repository
export type {
  AtcBridgeType,
  AtcBridgeStatus,
  AtcProtocolBridge,
  UpsertBridgeParams,
} from './protocol-bridge.repository.js'
export { ProtocolBridgeRepository } from './protocol-bridge.repository.js'

// Protocol Audit Repository
export type {
  AtcProtocolAuditEntry,
  AppendProtocolAuditParams,
} from './protocol-audit.repository.js'
export { ProtocolAuditRepository } from './protocol-audit.repository.js'

// Recovery Service (defines EventBus interface)
export type {
  RuntimeProtocolEventBus,
  ProtocolCleanupResult,
} from './protocol-recovery.service.js'
export { ProtocolRecoveryService } from './protocol-recovery.service.js'

// Runtime Protocol Service
export type { RegisterProtocolServiceParams } from './runtime-protocol.service.js'
export { RuntimeProtocolService } from './runtime-protocol.service.js'

// Federation Contract Service
export type { RegisterContractServiceParams } from './federation-contract.service.js'
export { FederationContractService } from './federation-contract.service.js'

// Distributed Contract Registry
export type { UpsertRegistryServiceParams } from './protocol-registry.service.js'
export { DistributedContractRegistry } from './protocol-registry.service.js'

// Runtime Handshake Service
export type { InitiateHandshakeServiceParams } from './runtime-handshake.service.js'
export { RuntimeHandshakeService } from './runtime-handshake.service.js'

// Inter-System Bridge Service
export type { UpsertBridgeServiceParams } from './protocol-bridge.service.js'
export { InterSystemBridgeService } from './protocol-bridge.service.js'
