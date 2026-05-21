export class CriminalError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CriminalError'
  }
}

export class GangNotFoundError extends CriminalError {
  constructor(id: string) {
    super(`Gang not found: ${id}`)
    this.name = 'GangNotFoundError'
  }
}

export class GangValidationError extends CriminalError {
  constructor(message: string) {
    super(message)
    this.name = 'GangValidationError'
  }
}

export class GangAlreadyExistsError extends CriminalError {
  constructor(tag: string) {
    super(`Gang with tag '${tag}' already exists`)
    this.name = 'GangAlreadyExistsError'
  }
}

export class GangMemberNotFoundError extends CriminalError {
  constructor(gangId: string, principalId: string) {
    super(`Member ${principalId} not found in gang ${gangId}`)
    this.name = 'GangMemberNotFoundError'
  }
}

export class GangMemberAlreadyActiveError extends CriminalError {
  constructor(gangId: string, principalId: string) {
    super(`Principal ${principalId} is already an active member of gang ${gangId}`)
    this.name = 'GangMemberAlreadyActiveError'
  }
}

export class GangOperationNotFoundError extends CriminalError {
  constructor(id: string) {
    super(`Criminal operation not found: ${id}`)
    this.name = 'GangOperationNotFoundError'
  }
}

export class GangOperationImmutableError extends CriminalError {
  constructor(id: string, from: string, to: string) {
    super(`Cannot transition operation ${id} from '${from}' to '${to}'`)
    this.name = 'GangOperationImmutableError'
  }
}

export class ContrabandNotFoundError extends CriminalError {
  constructor(id: string) {
    super(`Contraband not found: ${id}`)
    this.name = 'ContrabandNotFoundError'
  }
}

export class ContrabandAlreadySeizedError extends CriminalError {
  constructor(id: string) {
    super(`Contraband ${id} has already been seized`)
    this.name = 'ContrabandAlreadySeizedError'
  }
}

export class RaidNotFoundError extends CriminalError {
  constructor(id: string) {
    super(`Raid not found: ${id}`)
    this.name = 'RaidNotFoundError'
  }
}

export class RaidImmutableError extends CriminalError {
  constructor(id: string, from: string, to: string) {
    super(`Cannot transition raid ${id} from '${from}' to '${to}'`)
    this.name = 'RaidImmutableError'
  }
}

export class RaidAlreadyActiveError extends CriminalError {
  constructor(propertyId: string) {
    super(`An active raid is already in progress for property ${propertyId}`)
    this.name = 'RaidAlreadyActiveError'
  }
}

export class BlackMarketTransactionNotFoundError extends CriminalError {
  constructor(id: string) {
    super(`Black market transaction not found: ${id}`)
    this.name = 'BlackMarketTransactionNotFoundError'
  }
}
