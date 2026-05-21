export class NpcRuntimeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NpcRuntimeError'
  }
}

export class NpcNotFoundError extends NpcRuntimeError {
  constructor(id: string) {
    super(`NPC not found: ${id}`)
    this.name = 'NpcNotFoundError'
  }
}

export class NpcAlreadySpawnedError extends NpcRuntimeError {
  constructor(id: string) {
    super(`NPC already spawned: ${id}`)
    this.name = 'NpcAlreadySpawnedError'
  }
}

export class NpcAlreadyOwnedError extends NpcRuntimeError {
  constructor(id: string) {
    super(`NPC already owned: ${id}`)
    this.name = 'NpcAlreadyOwnedError'
  }
}

export class NpcSpawnNonceConflictError extends NpcRuntimeError {
  constructor(nonce: string) {
    super(`Spawn nonce already used: ${nonce}`)
    this.name = 'NpcSpawnNonceConflictError'
  }
}

export class PopulationZoneNotFoundError extends NpcRuntimeError {
  constructor(id: string) {
    super(`Population zone not found: ${id}`)
    this.name = 'PopulationZoneNotFoundError'
  }
}

export class SpawnPointNotFoundError extends NpcRuntimeError {
  constructor(id: string) {
    super(`Spawn point not found: ${id}`)
    this.name = 'SpawnPointNotFoundError'
  }
}

export class CrowdRuntimeNotFoundError extends NpcRuntimeError {
  constructor(id: string) {
    super(`Crowd runtime not found: ${id}`)
    this.name = 'CrowdRuntimeNotFoundError'
  }
}
