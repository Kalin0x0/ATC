export class PropertyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PropertyError'
  }
}

export class PropertyValidationError extends PropertyError {
  constructor(message: string) {
    super(message)
    this.name = 'PropertyValidationError'
  }
}

export class PropertyNotFoundError extends PropertyError {
  constructor(propertyId: string) {
    super(`Property '${propertyId}' not found`)
    this.name = 'PropertyNotFoundError'
  }
}

export class PropertyImmutableError extends PropertyError {
  constructor(propertyId: string, from: string, to: string) {
    super(`Property '${propertyId}' cannot transition from '${from}' to '${to}'`)
    this.name = 'PropertyImmutableError'
  }
}

export class PropertyAlreadyOwnedError extends PropertyError {
  constructor(propertyId: string) {
    super(`Property '${propertyId}' is already owned`)
    this.name = 'PropertyAlreadyOwnedError'
  }
}

export class PropertyNotOwnedError extends PropertyError {
  constructor(propertyId: string) {
    super(`Property '${propertyId}' is not owned`)
    this.name = 'PropertyNotOwnedError'
  }
}

export class PropertyAccessDeniedError extends PropertyError {
  constructor(propertyId: string, principalId: string) {
    super(`Principal '${principalId}' does not have access to property '${propertyId}'`)
    this.name = 'PropertyAccessDeniedError'
  }
}

export class PropertyAccessNotFoundError extends PropertyError {
  constructor(accessId: string) {
    super(`Property access record '${accessId}' not found`)
    this.name = 'PropertyAccessNotFoundError'
  }
}

export class PropertyKeyNotFoundError extends PropertyError {
  constructor(keyId: string) {
    super(`Property key '${keyId}' not found`)
    this.name = 'PropertyKeyNotFoundError'
  }
}

export class PropertyKeyAlreadyIssuedError extends PropertyError {
  constructor(propertyId: string, principalId: string) {
    super(`Principal '${principalId}' already has an active key to property '${propertyId}'`)
    this.name = 'PropertyKeyAlreadyIssuedError'
  }
}

export class PropertyAccessConflictError extends PropertyError {
  constructor(propertyId: string, principalId: string, accessType: string) {
    super(`Principal '${principalId}' already has active '${accessType}' access to property '${propertyId}'`)
    this.name = 'PropertyAccessConflictError'
  }
}

export class StashNotFoundError extends PropertyError {
  constructor(stashId: string) {
    super(`Stash '${stashId}' not found`)
    this.name = 'StashNotFoundError'
  }
}

export class StashCapacityError extends PropertyError {
  constructor(stashId: string, capacity: number) {
    super(`Stash '${stashId}' is at capacity (${capacity} items)`)
    this.name = 'StashCapacityError'
  }
}

export class StashItemNotFoundError extends PropertyError {
  constructor(stashId: string, itemName: string) {
    super(`Item '${itemName}' not found in stash '${stashId}'`)
    this.name = 'StashItemNotFoundError'
  }
}

export class StashInsufficientQuantityError extends PropertyError {
  constructor(itemName: string, requested: number, available: number) {
    super(`Insufficient quantity of '${itemName}': requested ${requested}, available ${available}`)
    this.name = 'StashInsufficientQuantityError'
  }
}

export class PropertyGarageNotFoundError extends PropertyError {
  constructor(propertyId: string, garageId: string) {
    super(`Garage '${garageId}' is not linked to property '${propertyId}'`)
    this.name = 'PropertyGarageNotFoundError'
  }
}

export class PropertyGarageAlreadyLinkedError extends PropertyError {
  constructor(propertyId: string, garageId: string) {
    super(`Garage '${garageId}' is already linked to property '${propertyId}'`)
    this.name = 'PropertyGarageAlreadyLinkedError'
  }
}

export class PropertyRuntimeNotFoundError extends PropertyError {
  constructor(propertyId: string) {
    super(`Runtime record for property '${propertyId}' not found`)
    this.name = 'PropertyRuntimeNotFoundError'
  }
}

export class EmergencyAccessError extends PropertyError {
  constructor(message: string) {
    super(message)
    this.name = 'EmergencyAccessError'
  }
}
