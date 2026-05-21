export class CoreClosureError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CoreClosureError'
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}
export class CoreClosureNotFoundError extends CoreClosureError {
  constructor(id: string) { super(`Core closure not found: ${id}`) }
}
export class DuplicateCoreClosureError extends CoreClosureError {
  constructor(nonce: string) { super(`Duplicate core closure nonce: ${nonce}`) }
}
export class RuntimeImmutabilityNotFoundError extends CoreClosureError {
  constructor(id: string) { super(`Runtime immutability not found: ${id}`) }
}
export class DuplicateRuntimeImmutabilityError extends CoreClosureError {
  constructor(nonce: string) { super(`Duplicate runtime immutability nonce: ${nonce}`) }
}
export class ProductionFreezeNotFoundError extends CoreClosureError {
  constructor(id: string) { super(`Production freeze not found: ${id}`) }
}
export class DistributedClosureNotFoundError extends CoreClosureError {
  constructor(id: string) { super(`Distributed closure node not found: ${id}`) }
}
export class FinalValidationNotFoundError extends CoreClosureError {
  constructor(id: string) { super(`Final validation not found: ${id}`) }
}
export class DuplicateFinalValidationError extends CoreClosureError {
  constructor(nonce: string) { super(`Duplicate final validation nonce: ${nonce}`) }
}
