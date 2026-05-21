export class CombatSimulationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CombatSimulationError'
  }
}

export class CombatSessionNotFoundError extends CombatSimulationError {
  constructor(id: string) {
    super(`Combat session not found: ${id}`)
    this.name = 'CombatSessionNotFoundError'
  }
}

export class DuplicateCombatSessionError extends CombatSimulationError {
  constructor(nonce: string) {
    super(`Duplicate combat session nonce: ${nonce}`)
    this.name = 'DuplicateCombatSessionError'
  }
}

export class BallisticsNotFoundError extends CombatSimulationError {
  constructor(id: string) {
    super(`Ballistics record not found: ${id}`)
    this.name = 'BallisticsNotFoundError'
  }
}

export class TacticalDamageNotFoundError extends CombatSimulationError {
  constructor(id: string) {
    super(`Tactical damage record not found: ${id}`)
    this.name = 'TacticalDamageNotFoundError'
  }
}

export class SuppressionNotFoundError extends CombatSimulationError {
  constructor(id: string) {
    super(`Suppression record not found: ${id}`)
    this.name = 'SuppressionNotFoundError'
  }
}

export class ArmorRuntimeNotFoundError extends CombatSimulationError {
  constructor(id: string) {
    super(`Armor runtime record not found: ${id}`)
    this.name = 'ArmorRuntimeNotFoundError'
  }
}

export class CombatSessionAlreadyActiveError extends CombatSimulationError {
  constructor(id: string) {
    super(`Combat session already active: ${id}`)
    this.name = 'CombatSessionAlreadyActiveError'
  }
}
