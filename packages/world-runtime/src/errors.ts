export class WorldError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorldError'
  }
}

export class WorldEntityNotFoundError extends WorldError {
  constructor(id: string) {
    super(`World entity not found: ${id}`)
    this.name = 'WorldEntityNotFoundError'
  }
}

export class WorldEntityValidationError extends WorldError {
  constructor(message: string) {
    super(message)
    this.name = 'WorldEntityValidationError'
  }
}

export class WorldEntityAlreadySpawnedError extends WorldError {
  constructor(nonce: string) {
    super(`World entity with spawn nonce '${nonce}' is already spawned`)
    this.name = 'WorldEntityAlreadySpawnedError'
  }
}

export class WorldEntityImmutableError extends WorldError {
  constructor(id: string, from: string, to: string) {
    super(`Cannot transition world entity ${id} from '${from}' to '${to}'`)
    this.name = 'WorldEntityImmutableError'
  }
}

export class SceneNotFoundError extends WorldError {
  constructor(sceneId: string) {
    super(`Scene not found: ${sceneId}`)
    this.name = 'SceneNotFoundError'
  }
}

export class SceneAlreadyExistsError extends WorldError {
  constructor(sceneId: string) {
    super(`Scene already exists: ${sceneId}`)
    this.name = 'SceneAlreadyExistsError'
  }
}

export class SceneImmutableError extends WorldError {
  constructor(sceneId: string, from: string, to: string) {
    super(`Cannot transition scene ${sceneId} from '${from}' to '${to}'`)
    this.name = 'SceneImmutableError'
  }
}

export class SceneLockedError extends WorldError {
  constructor(sceneId: string) {
    super(`Scene ${sceneId} is locked`)
    this.name = 'SceneLockedError'
  }
}

export class OwnershipConflictError extends WorldError {
  constructor(entityId: string) {
    super(`Entity ${entityId} already has an active owner`)
    this.name = 'OwnershipConflictError'
  }
}

export class OwnershipNotFoundError extends WorldError {
  constructor(entityId: string, principalId: string) {
    super(`No active ownership found for entity ${entityId} by principal ${principalId}`)
    this.name = 'OwnershipNotFoundError'
  }
}

export class PersistentSceneNotFoundError extends WorldError {
  constructor(sceneId: string) {
    super(`Persistent scene not found: ${sceneId}`)
    this.name = 'PersistentSceneNotFoundError'
  }
}

export class CleanupNotFoundError extends WorldError {
  constructor(id: string) {
    super(`Cleanup record not found: ${id}`)
    this.name = 'CleanupNotFoundError'
  }
}
