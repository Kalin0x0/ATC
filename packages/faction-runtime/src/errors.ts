export class FactionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FactionError'
  }
}

export class FactionNotFoundError extends FactionError {
  constructor(id: string) {
    super(`Faction not found: ${id}`)
    this.name = 'FactionNotFoundError'
  }
}

export class FactionValidationError extends FactionError {
  constructor(message: string) {
    super(message)
    this.name = 'FactionValidationError'
  }
}

export class FactionAlreadyExistsError extends FactionError {
  constructor(tag: string) {
    super(`Faction with tag already exists: ${tag}`)
    this.name = 'FactionAlreadyExistsError'
  }
}

export class FactionMemberNotFoundError extends FactionError {
  constructor(factionId: string, principalId: string) {
    super(`Member not found in faction ${factionId}: ${principalId}`)
    this.name = 'FactionMemberNotFoundError'
  }
}

export class FactionMemberAlreadyActiveError extends FactionError {
  constructor(factionId: string, principalId: string) {
    super(`Member already active in faction ${factionId}: ${principalId}`)
    this.name = 'FactionMemberAlreadyActiveError'
  }
}

export class TerritoryNotFoundError extends FactionError {
  constructor(id: string) {
    super(`Territory not found: ${id}`)
    this.name = 'TerritoryNotFoundError'
  }
}

export class TerritoryAlreadyClaimedError extends FactionError {
  constructor(territoryId: string, factionId: string) {
    super(`Territory ${territoryId} is already claimed by faction ${factionId}`)
    this.name = 'TerritoryAlreadyClaimedError'
  }
}

export class TerritoryClaimNotFoundError extends FactionError {
  constructor(id: string) {
    super(`Territory claim not found: ${id}`)
    this.name = 'TerritoryClaimNotFoundError'
  }
}

export class TerritoryClaimImmutableError extends FactionError {
  constructor(id: string, from: string, to: string) {
    super(`Territory claim ${id} cannot transition from ${from} to ${to}`)
    this.name = 'TerritoryClaimImmutableError'
  }
}

export class ConflictNotFoundError extends FactionError {
  constructor(id: string) {
    super(`Conflict not found: ${id}`)
    this.name = 'ConflictNotFoundError'
  }
}

export class ConflictAlreadyActiveError extends FactionError {
  constructor(territoryId: string) {
    super(`An active conflict already exists for territory: ${territoryId}`)
    this.name = 'ConflictAlreadyActiveError'
  }
}

export class ConflictImmutableError extends FactionError {
  constructor(id: string, from: string, to: string) {
    super(`Conflict ${id} cannot transition from ${from} to ${to}`)
    this.name = 'ConflictImmutableError'
  }
}

export class ResourceNodeNotFoundError extends FactionError {
  constructor(id: string) {
    super(`Resource node not found: ${id}`)
    this.name = 'ResourceNodeNotFoundError'
  }
}

export class ResourceNodeAlreadyOwnedError extends FactionError {
  constructor(nodeId: string, factionId: string) {
    super(`Resource node ${nodeId} is already owned by faction ${factionId}`)
    this.name = 'ResourceNodeAlreadyOwnedError'
  }
}

export class InfluenceRecordNotFoundError extends FactionError {
  constructor(factionId: string, territoryId: string) {
    super(`Influence record not found for faction ${factionId} in territory ${territoryId}`)
    this.name = 'InfluenceRecordNotFoundError'
  }
}
