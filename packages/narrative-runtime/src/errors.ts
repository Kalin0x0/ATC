export class NarrativeRuntimeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NarrativeRuntimeError'
  }
}

export class CampaignNotFoundError extends NarrativeRuntimeError {
  constructor(id: string) {
    super(`Campaign not found: ${id}`)
    this.name = 'CampaignNotFoundError'
  }
}

export class DuplicateCampaignError extends NarrativeRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate campaign nonce: ${nonce}`)
    this.name = 'DuplicateCampaignError'
  }
}

export class WorldEventNotFoundError extends NarrativeRuntimeError {
  constructor(id: string) {
    super(`World event not found: ${id}`)
    this.name = 'WorldEventNotFoundError'
  }
}

export class StoryProgressionNotFoundError extends NarrativeRuntimeError {
  constructor(id: string) {
    super(`Story progression not found: ${id}`)
    this.name = 'StoryProgressionNotFoundError'
  }
}

export class NarrativeSessionNotFoundError extends NarrativeRuntimeError {
  constructor(id: string) {
    super(`Narrative session not found: ${id}`)
    this.name = 'NarrativeSessionNotFoundError'
  }
}

export class DynamicStoryNotFoundError extends NarrativeRuntimeError {
  constructor(id: string) {
    super(`Dynamic story state not found: ${id}`)
    this.name = 'DynamicStoryNotFoundError'
  }
}

export class CampaignAlreadyActiveError extends NarrativeRuntimeError {
  constructor(id: string) {
    super(`Campaign already active: ${id}`)
    this.name = 'CampaignAlreadyActiveError'
  }
}
