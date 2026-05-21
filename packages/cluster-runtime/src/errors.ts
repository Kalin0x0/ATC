export class ClusterRuntimeError extends Error {
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

export class ClusterNodeNotFoundError extends ClusterRuntimeError {
  constructor(id: string) {
    super(`Cluster node not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class DuplicateNodeError extends ClusterRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate node nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class DeploymentNotFoundError extends ClusterRuntimeError {
  constructor(id: string) {
    super(`Deployment not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class DuplicateDeploymentError extends ClusterRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate deployment nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class ScalingNotFoundError extends ClusterRuntimeError {
  constructor(id: string) {
    super(`Scaling operation not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class DuplicateScalingError extends ClusterRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate scaling nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class AllocationNotFoundError extends ClusterRuntimeError {
  constructor(entityId: string) {
    super(`Allocation not found for entity: ${entityId}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}
