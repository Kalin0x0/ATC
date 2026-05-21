export class EntityGraphError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EntityGraphError'
  }
}

export class EntityNotFoundError extends EntityGraphError {
  constructor(id: string) {
    super(`Entity not found: ${id}`)
    this.name = 'EntityNotFoundError'
  }
}

export class InvalidEntityTypeError extends EntityGraphError {
  constructor(type: string) {
    super(`Invalid entity type: ${type}`)
    this.name = 'InvalidEntityTypeError'
  }
}

export class InvalidTraversalDepthError extends EntityGraphError {
  constructor(depth: number) {
    super(`Invalid traversal depth: ${depth}`)
    this.name = 'InvalidTraversalDepthError'
  }
}
