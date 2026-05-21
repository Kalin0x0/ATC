export class ReconciliationRuntimeError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class RuntimeMigrationNotFoundError extends ReconciliationRuntimeError {
  constructor(migrationId: string) {
    super(`Runtime migration not found: ${migrationId}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateMigrationNonceError extends ReconciliationRuntimeError {
  constructor(nonce: string) {
    super(`Migration nonce already exists: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class MigrationAlreadyCompletedError extends ReconciliationRuntimeError {
  constructor(migrationId: string) {
    super(`Migration already completed: ${migrationId}`, 422)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class NodeTransferNotFoundError extends ReconciliationRuntimeError {
  constructor(transferId: string) {
    super(`Node transfer not found: ${transferId}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class ReconciliationNotFoundError extends ReconciliationRuntimeError {
  constructor(reconciliationId: string) {
    super(`Reconciliation not found: ${reconciliationId}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class SnapshotReplayNotFoundError extends ReconciliationRuntimeError {
  constructor(replayId: string) {
    super(`Snapshot replay not found: ${replayId}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class RuntimeRecoveryNotFoundError extends ReconciliationRuntimeError {
  constructor(recoveryId: string) {
    super(`Runtime recovery not found: ${recoveryId}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}
