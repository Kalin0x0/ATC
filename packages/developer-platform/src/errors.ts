type ErrorConstructorWithCapture = ErrorConstructor & {
  captureStackTrace?: (target: object, constructor: Function) => void
}

export class DeveloperPlatformError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    ;(Error as ErrorConstructorWithCapture).captureStackTrace?.(this, this.constructor)
  }
}

export class DeveloperPlatformNotFoundError extends DeveloperPlatformError {
  constructor(id: string) { super(`Developer platform not found: ${id}`, 404) }
}
export class DuplicateDeveloperPlatformError extends DeveloperPlatformError {
  constructor(nonce: string) { super(`Duplicate developer platform nonce: ${nonce}`, 409) }
}
export class SdkRegistryNotFoundError extends DeveloperPlatformError {
  constructor(id: string) { super(`SDK registry not found: ${id}`, 404) }
}
export class PluginCompatibilityNotFoundError extends DeveloperPlatformError {
  constructor(id: string) { super(`Plugin compatibility not found: ${id}`, 404) }
}
export class DuplicatePluginCompatibilityError extends DeveloperPlatformError {
  constructor(nonce: string) { super(`Duplicate plugin compatibility nonce: ${nonce}`, 409) }
}
export class ExtensionRuntimeNotFoundError extends DeveloperPlatformError {
  constructor(id: string) { super(`Extension runtime not found: ${id}`, 404) }
}
export class DuplicateExtensionRuntimeError extends DeveloperPlatformError {
  constructor(nonce: string) { super(`Duplicate extension runtime nonce: ${nonce}`, 409) }
}
export class ContractValidationNotFoundError extends DeveloperPlatformError {
  constructor(id: string) { super(`Contract validation not found: ${id}`, 404) }
}
export class DuplicateContractValidationError extends DeveloperPlatformError {
  constructor(nonce: string) { super(`Duplicate contract validation nonce: ${nonce}`, 409) }
}
