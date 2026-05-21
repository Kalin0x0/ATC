export class CombatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CombatError'
  }
}

export class WeaponNotFoundError extends CombatError {
  constructor(id: string) {
    super(`Weapon not found: ${id}`)
    this.name = 'WeaponNotFoundError'
  }
}

export class WeaponValidationError extends CombatError {
  constructor(message: string) {
    super(message)
    this.name = 'WeaponValidationError'
  }
}

export class WeaponSeizedError extends CombatError {
  constructor(id: string) {
    super(`Weapon ${id} has been seized and cannot be used`)
    this.name = 'WeaponSeizedError'
  }
}

export class WeaponLockedError extends CombatError {
  constructor(id: string) {
    super(`Weapon ${id} is locked`)
    this.name = 'WeaponLockedError'
  }
}

export class WeaponAlreadyEquippedError extends CombatError {
  constructor(id: string) {
    super(`Weapon ${id} is already equipped by this holder`)
    this.name = 'WeaponAlreadyEquippedError'
  }
}

export class DuplicateDamageError extends CombatError {
  constructor(nonce: string) {
    super(`Duplicate damage event rejected (nonce: ${nonce})`)
    this.name = 'DuplicateDamageError'
  }
}

export class CombatSessionNotFoundError extends CombatError {
  constructor(id: string) {
    super(`Combat session not found: ${id}`)
    this.name = 'CombatSessionNotFoundError'
  }
}

export class CombatSessionEndedError extends CombatError {
  constructor(id: string) {
    super(`Combat session ${id} has already ended`)
    this.name = 'CombatSessionEndedError'
  }
}

export class InjuryNotFoundError extends CombatError {
  constructor(id: string) {
    super(`Injury not found: ${id}`)
    this.name = 'InjuryNotFoundError'
  }
}

export class InsufficientAmmoError extends CombatError {
  constructor(weaponId: string, current: number, needed: number) {
    super(`Weapon ${weaponId} has insufficient ammo (${current}/${needed})`)
    this.name = 'InsufficientAmmoError'
  }
}
