export class RuntimeProtocolError extends Error {
  constructor(message: string) { super(message); this.name = 'RuntimeProtocolError' }
}

// Runtime Protocol
export class ProtocolNotFoundError extends RuntimeProtocolError {
  constructor(id: string) { super(`Runtime protocol not found: ${id}`) }
}
export class DuplicateProtocolError extends RuntimeProtocolError {
  constructor(nonce: string) { super(`Duplicate protocol nonce: ${nonce}`) }
}

// Federation Contract
export class FederationContractNotFoundError extends RuntimeProtocolError {
  constructor(id: string) { super(`Federation contract not found: ${id}`) }
}
export class DuplicateFederationContractError extends RuntimeProtocolError {
  constructor(nonce: string) { super(`Duplicate federation contract nonce: ${nonce}`) }
}

// Protocol Registry
export class RegistryEntryNotFoundError extends RuntimeProtocolError {
  constructor(nodeId: string) { super(`Registry entry not found: ${nodeId}`) }
}

// Runtime Handshake
export class HandshakeNotFoundError extends RuntimeProtocolError {
  constructor(id: string) { super(`Runtime handshake not found: ${id}`) }
}
export class DuplicateHandshakeError extends RuntimeProtocolError {
  constructor(nonce: string) { super(`Duplicate handshake nonce: ${nonce}`) }
}

// Protocol Bridge
export class BridgeNotFoundError extends RuntimeProtocolError {
  constructor(bridgeId: string) { super(`Protocol bridge not found: ${bridgeId}`) }
}
