export class EcologyRuntimeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EcologyRuntimeError'
  }
}

export class EcologyNotFoundError extends EcologyRuntimeError {
  constructor(id: string) {
    super(`Ecology not found: ${id}`)
    this.name = 'EcologyNotFoundError'
  }
}

export class DuplicateEcologyError extends EcologyRuntimeError {
  constructor(id: string) {
    super(`Duplicate ecology: ${id}`)
    this.name = 'DuplicateEcologyError'
  }
}

export class EvolutionNotFoundError extends EcologyRuntimeError {
  constructor(id: string) {
    super(`Evolution not found: ${id}`)
    this.name = 'EvolutionNotFoundError'
  }
}

export class DuplicateEvolutionError extends EcologyRuntimeError {
  constructor(id: string) {
    super(`Duplicate evolution: ${id}`)
    this.name = 'DuplicateEvolutionError'
  }
}

export class RegenerationNotFoundError extends EcologyRuntimeError {
  constructor(id: string) {
    super(`Regeneration not found: ${id}`)
    this.name = 'RegenerationNotFoundError'
  }
}

export class DuplicateRegenerationError extends EcologyRuntimeError {
  constructor(id: string) {
    super(`Duplicate regeneration: ${id}`)
    this.name = 'DuplicateRegenerationError'
  }
}
