export class HousingEconomyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HousingEconomyError'
  }
}

export class RentalContractNotFoundError extends HousingEconomyError {
  constructor(id: string) {
    super(`Rental contract not found: ${id}`)
    this.name = 'RentalContractNotFoundError'
  }
}

export class RentalContractAlreadyActiveError extends HousingEconomyError {
  constructor(id: string) {
    super(`Rental contract already active: ${id}`)
    this.name = 'RentalContractAlreadyActiveError'
  }
}

export class RentalContractTerminatedError extends HousingEconomyError {
  constructor(id: string) {
    super(`Rental contract is terminated: ${id}`)
    this.name = 'RentalContractTerminatedError'
  }
}

export class ForeclosureNotFoundError extends HousingEconomyError {
  constructor(id: string) {
    super(`Foreclosure not found: ${id}`)
    this.name = 'ForeclosureNotFoundError'
  }
}

export class ForeclosureAlreadyActiveError extends HousingEconomyError {
  constructor(id: string) {
    super(`Foreclosure already active for property: ${id}`)
    this.name = 'ForeclosureAlreadyActiveError'
  }
}

export class ForeclosureCompletedError extends HousingEconomyError {
  constructor(id: string) {
    super(`Foreclosure already completed: ${id}`)
    this.name = 'ForeclosureCompletedError'
  }
}

export class PropertyTaxNotFoundError extends HousingEconomyError {
  constructor(id: string) {
    super(`Property tax record not found: ${id}`)
    this.name = 'PropertyTaxNotFoundError'
  }
}

export class PropertyTaxAlreadyPaidError extends HousingEconomyError {
  constructor(id: string) {
    super(`Property tax already paid: ${id}`)
    this.name = 'PropertyTaxAlreadyPaidError'
  }
}

export class AssetValuationNotFoundError extends HousingEconomyError {
  constructor(id: string) {
    super(`Asset valuation not found: ${id}`)
    this.name = 'AssetValuationNotFoundError'
  }
}

export class HousingPaymentNotFoundError extends HousingEconomyError {
  constructor(id: string) {
    super(`Housing payment not found: ${id}`)
    this.name = 'HousingPaymentNotFoundError'
  }
}

export class DuplicatePaymentError extends HousingEconomyError {
  constructor(key: string) {
    super(`Duplicate payment idempotency key: ${key}`)
    this.name = 'DuplicatePaymentError'
  }
}

export class TenantHistoryNotFoundError extends HousingEconomyError {
  constructor(id: string) {
    super(`Tenant history not found: ${id}`)
    this.name = 'TenantHistoryNotFoundError'
  }
}
