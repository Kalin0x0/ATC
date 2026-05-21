export class PersistenceRuntimeError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class SnapshotNotFoundError extends PersistenceRuntimeError {
  constructor(id: string) {
    super(`Snapshot not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class DuplicateSnapshotError extends PersistenceRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate snapshot nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class ArchiveNotFoundError extends PersistenceRuntimeError {
  constructor(id: string) {
    super(`Snapshot archive not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class DuplicateArchiveError extends PersistenceRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate archive nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class CompressionNotFoundError extends PersistenceRuntimeError {
  constructor(id: string) {
    super(`Compression record not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class DuplicateCompressionError extends PersistenceRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate compression nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class RecoveryNotFoundError extends PersistenceRuntimeError {
  constructor(id: string) {
    super(`Long-term recovery not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class DuplicateRecoveryError extends PersistenceRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate recovery nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}
