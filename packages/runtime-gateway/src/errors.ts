type ErrorConstructorWithCapture = ErrorConstructor & {
  captureStackTrace?: (target: object, constructor: Function) => void
}

export class RuntimeGatewayError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    ;(Error as ErrorConstructorWithCapture).captureStackTrace?.(this, this.constructor)
  }
}

export class GatewayNotFoundError extends RuntimeGatewayError {
  constructor(id: string) { super(`Runtime gateway not found: ${id}`, 404) }
}
export class DuplicateGatewayError extends RuntimeGatewayError {
  constructor(nonce: string) { super(`Duplicate gateway nonce: ${nonce}`, 409) }
}
export class AccessMeshNotFoundError extends RuntimeGatewayError {
  constructor(id: string) { super(`Access mesh not found: ${id}`, 404) }
}
export class GatewayRoutingNotFoundError extends RuntimeGatewayError {
  constructor(id: string) { super(`Gateway routing not found: ${id}`, 404) }
}
export class ExposureNotFoundError extends RuntimeGatewayError {
  constructor(id: string) { super(`Runtime exposure not found: ${id}`, 404) }
}
export class DuplicateExposureError extends RuntimeGatewayError {
  constructor(nonce: string) { super(`Duplicate exposure nonce: ${nonce}`, 409) }
}
export class SurfaceProtectionNotFoundError extends RuntimeGatewayError {
  constructor(id: string) { super(`Surface protection not found: ${id}`, 404) }
}
export class DuplicateSurfaceProtectionError extends RuntimeGatewayError {
  constructor(nonce: string) { super(`Duplicate protection nonce: ${nonce}`, 409) }
}
