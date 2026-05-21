export class EconomyRegulationError extends Error {
  constructor(message: string) { super(message); this.name = 'EconomyRegulationError' }
}
export class RegulationNotFoundError extends EconomyRegulationError {
  constructor(id: string) { super(`Economy regulation not found: ${id}`) }
}
export class DuplicateRegulationError extends EconomyRegulationError {
  constructor(nonce: string) { super(`Duplicate regulation nonce: ${nonce}`) }
}
export class BalancingNotFoundError extends EconomyRegulationError {
  constructor(id: string) { super(`Resource balancing not found: ${id}`) }
}
export class DuplicateBalancingError extends EconomyRegulationError {
  constructor(nonce: string) { super(`Duplicate balancing nonce: ${nonce}`) }
}
export class StabilizationNotFoundError extends EconomyRegulationError {
  constructor(id: string) { super(`Market stabilization not found: ${id}`) }
}
export class DuplicateStabilizationError extends EconomyRegulationError {
  constructor(nonce: string) { super(`Duplicate stabilization nonce: ${nonce}`) }
}
