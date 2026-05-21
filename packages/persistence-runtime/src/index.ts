// Pool
export type { PoolConnection, PersistenceRuntimePool } from './pool.js'

// ID generator
export { generateId } from './id.js'

// Errors
export {
  PersistenceRuntimeError,
  SnapshotNotFoundError,
  DuplicateSnapshotError,
  ArchiveNotFoundError,
  DuplicateArchiveError,
  CompressionNotFoundError,
  DuplicateCompressionError,
  RecoveryNotFoundError,
  DuplicateRecoveryError,
} from './errors.js'

// Global Snapshot Repository
export type {
  AtcSnapshotType,
  AtcSnapshotStatus,
  AtcGlobalSnapshot,
  CreateSnapshotParams,
} from './global-snapshot.repository.js'
export { GlobalSnapshotRepository } from './global-snapshot.repository.js'

// Snapshot Archive Repository
export type {
  AtcArchiveType,
  AtcArchiveStatus,
  AtcSnapshotArchive,
  CreateArchiveParams,
} from './snapshot-archive.repository.js'
export { SnapshotArchiveRepository } from './snapshot-archive.repository.js'

// Persistence Runtime Repository
export type {
  AtcPersistenceType,
  AtcPersistenceStatus,
  AtcPersistenceRuntime,
  UpsertPersistenceParams,
} from './persistence-runtime.repository.js'
export { PersistenceRuntimeRepository } from './persistence-runtime.repository.js'

// Snapshot Compression Repository
export type {
  AtcCompressionType,
  AtcCompressionStatus,
  AtcSnapshotCompression,
  CreateCompressionParams,
} from './snapshot-compression.repository.js'
export { SnapshotCompressionRepository } from './snapshot-compression.repository.js'

// Longterm Recovery Repository
export type {
  AtcLongTermRecoveryType,
  AtcLongTermRecoveryStatus,
  AtcLongtermRecovery,
  CreateLongtermRecoveryParams,
} from './longterm-recovery.repository.js'
export { LongtermRecoveryRepository } from './longterm-recovery.repository.js'

// Persistence Audit Repository
export type { AtcPersistenceAuditEntry, AppendPersistenceAuditParams } from './persistence-audit.repository.js'
export { PersistenceAuditRepository } from './persistence-audit.repository.js'

// Services
export type { PersistenceRuntimeEventBus } from './persistence-consistency.service.js'
export { GlobalPersistenceService } from './global-persistence.service.js'
export { SnapshotCompressionService } from './snapshot-compression.service.js'
export { DistributedSnapshotService } from './distributed-snapshot.service.js'
export { LongTermRecoveryService } from './longterm-recovery.service.js'
export { RuntimeArchivalService } from './runtime-archival.service.js'
export { PersistenceConsistencyService } from './persistence-consistency.service.js'
