export class EventStoreAppendError extends Error {
  constructor(eventName: string, reason: string) {
    super(`Failed to append event '${eventName}': ${reason}`)
    this.name = 'EventStoreAppendError'
  }
}

export class EventStoreReadError extends Error {
  constructor(eventName: string, reason: string) {
    super(`Failed to read events for '${eventName}': ${reason}`)
    this.name = 'EventStoreReadError'
  }
}
