export class CommunicationRuntimeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CommunicationRuntimeError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class RadioChannelNotFoundError extends CommunicationRuntimeError {
  constructor(public readonly channelId: string) {
    super(`Radio channel not found: ${channelId}`)
    this.name = 'RadioChannelNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class RadioChannelAlreadyExistsError extends CommunicationRuntimeError {
  constructor(public readonly channelId: string) {
    super(`Radio channel already exists: ${channelId}`)
    this.name = 'RadioChannelAlreadyExistsError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class MembershipNotFoundError extends CommunicationRuntimeError {
  constructor(
    public readonly channelId: string,
    public readonly principalId: string,
  ) {
    super(`Membership not found: ${channelId}/${principalId}`)
    this.name = 'MembershipNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class MembershipAlreadyExistsError extends CommunicationRuntimeError {
  constructor(
    public readonly channelId: string,
    public readonly principalId: string,
  ) {
    super(`Already member of channel: ${channelId}/${principalId}`)
    this.name = 'MembershipAlreadyExistsError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class SignalNotFoundError extends CommunicationRuntimeError {
  constructor(public readonly signalId: string) {
    super(`Signal not found: ${signalId}`)
    this.name = 'SignalNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class EmergencyBroadcastNotFoundError extends CommunicationRuntimeError {
  constructor(public readonly broadcastId: string) {
    super(`Emergency broadcast not found: ${broadcastId}`)
    this.name = 'EmergencyBroadcastNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class DuplicateBroadcastNonceError extends CommunicationRuntimeError {
  constructor(public readonly nonce: string) {
    super(`Duplicate broadcast nonce: ${nonce}`)
    this.name = 'DuplicateBroadcastNonceError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class EncryptedChannelNotFoundError extends CommunicationRuntimeError {
  constructor(public readonly channelId: string) {
    super(`Encrypted channel not found: ${channelId}`)
    this.name = 'EncryptedChannelNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
