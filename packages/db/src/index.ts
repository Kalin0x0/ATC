export { createPool, testConnection } from './client.js'
export type { DbPool, DbConfig } from './client.js'

export { generateId } from './id.js'

export { runMigrations, getMigrationStatus } from './migrate.js'

export { AccountRepository } from './repositories/account.repository.js'
export type { AccountRecord } from './repositories/account.repository.js'

export { SessionRepository } from './repositories/session.repository.js'
export type { SessionRecord } from './repositories/session.repository.js'

export { BanRepository } from './repositories/ban.repository.js'
export type { BanRecord } from './repositories/ban.repository.js'

export { CharacterRepository, CharacterLimitError, CharacterSlotTakenError } from './repositories/character.repository.js'
export type { CharacterRecord } from './repositories/character.repository.js'

export {
  WalletRepository,
  WalletFrozenError,
  WalletClosedError,
  InsufficientFundsError,
  DuplicateIdempotencyError,
  IdempotencyPayloadMismatchError,
} from './repositories/wallet.repository.js'
export type {
  WalletRecord,
  TransactionRecord,
  MutationResult,
  CreditParams,
  DebitParams,
  TransferParams,
} from './repositories/wallet.repository.js'

export {
  ItemDefinitionRepository,
  ItemDefinitionDuplicateError,
  ItemDefinitionNotFoundError,
} from './repositories/item-definition.repository.js'
export type {
  UpsertItemDefinitionParams,
  CreateItemDefinitionParams,
  UpdateItemDefinitionParams,
} from './repositories/item-definition.repository.js'

export {
  VitalsRepository,
} from './repositories/vitals.repository.js'
export type { VitalsRecord } from './repositories/vitals.repository.js'

export { validateMetadataSchema } from './repositories/inventory.repository.js'

export {
  InventoryRepository,
  InventoryItemNotFoundError,
  InventorySlotOccupiedError,
  InventoryInsufficientQuantityError,
  InventoryFullError,
  InventoryStackLimitError,
  InventoryIdempotencyPayloadMismatchError,
  InventoryOverweightError,
  InventoryCapacityError,
  InventoryMetadataValidationError,
  InventorySettingsConflictError,
  InventoryItemBrokenError,
} from './repositories/inventory.repository.js'
export type {
  AddItemParams,
  RemoveItemParams,
  MoveItemParams,
  UpdateSettingsParams,
  UseItemParams,
  UseItemResult,
} from './repositories/inventory.repository.js'
