export class FederationRuntimeError extends Error {
  constructor(message: string) { super(message); this.name = 'FederationRuntimeError' }
}
export class FederationNodeNotFoundError extends FederationRuntimeError {
  constructor(id: string) { super(`Federation node not found: ${id}`) }
}
export class DuplicateFederationNodeError extends FederationRuntimeError {
  constructor(nonce: string) { super(`Duplicate federation node nonce: ${nonce}`) }
}
export class InterclusterRouteNotFoundError extends FederationRuntimeError {
  constructor(id: string) { super(`Inter-cluster route not found: ${id}`) }
}
export class DuplicateInterclusterRouteError extends FederationRuntimeError {
  constructor(nonce: string) { super(`Duplicate inter-cluster route nonce: ${nonce}`) }
}
export class ConsistencyCheckNotFoundError extends FederationRuntimeError {
  constructor(id: string) { super(`Regional consistency check not found: ${id}`) }
}
export class DuplicateConsistencyCheckError extends FederationRuntimeError {
  constructor(nonce: string) { super(`Duplicate consistency check nonce: ${nonce}`) }
}
