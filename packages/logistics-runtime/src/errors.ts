export class LogisticsRuntimeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LogisticsRuntimeError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ShipmentNotFoundError extends LogisticsRuntimeError {
  constructor(shipmentId: string) {
    super(`Shipment not found: ${shipmentId}`)
    this.name = 'ShipmentNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ShipmentAlreadyInTransitError extends LogisticsRuntimeError {
  constructor(shipmentId: string) {
    super(`Shipment already in transit: ${shipmentId}`)
    this.name = 'ShipmentAlreadyInTransitError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ShipmentAlreadyDeliveredError extends LogisticsRuntimeError {
  constructor(shipmentId: string) {
    super(`Shipment already delivered: ${shipmentId}`)
    this.name = 'ShipmentAlreadyDeliveredError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class DuplicateShipmentNonceError extends LogisticsRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate shipment nonce: ${nonce}`)
    this.name = 'DuplicateShipmentNonceError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class SupplyRouteNotFoundError extends LogisticsRuntimeError {
  constructor(routeId: string) {
    super(`Supply route not found: ${routeId}`)
    this.name = 'SupplyRouteNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class LogisticsFleetNotFoundError extends LogisticsRuntimeError {
  constructor(fleetId: string) {
    super(`Fleet not found: ${fleetId}`)
    this.name = 'LogisticsFleetNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class FleetAlreadyDeployedError extends LogisticsRuntimeError {
  constructor(fleetId: string) {
    super(`Fleet already deployed: ${fleetId}`)
    this.name = 'FleetAlreadyDeployedError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class SupplyChainNotFoundError extends LogisticsRuntimeError {
  constructor(chainId: string) {
    super(`Supply chain not found: ${chainId}`)
    this.name = 'SupplyChainNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class CargoNotFoundError extends LogisticsRuntimeError {
  constructor(cargoId: string) {
    super(`Cargo not found: ${cargoId}`)
    this.name = 'CargoNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
