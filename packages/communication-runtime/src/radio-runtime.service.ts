import type { AtcEventBus } from '@atc/events'
import type { RadioChannelRepository } from './radio-channel.repository.js'
import type { RadioMembershipRepository } from './radio-membership.repository.js'
import type { CommunicationAuditRepository } from './communication-audit.repository.js'
import type { AtcRadioChannel, AtcChannelType } from './radio-channel.repository.js'
import type { AtcRadioMembership, AtcMembershipRole } from './radio-membership.repository.js'
import { RadioChannelNotFoundError } from './errors.js'

export class RadioRuntimeService {
  constructor(
    private readonly channelRepo: RadioChannelRepository,
    private readonly membershipRepo: RadioMembershipRepository,
    private readonly auditRepo: CommunicationAuditRepository,
    private readonly eventBus: AtcEventBus,
  ) {}

  async createChannel(params: {
    channelId: string
    channelName: string
    channelType: AtcChannelType
    frequency: number
    ownerPrincipalId?: string
    isEncrypted?: boolean
    maxMembers?: number
  }): Promise<AtcRadioChannel> {
    const channel = await this.channelRepo.create(params)

    await this.auditRepo.record(
      channel.channelId,
      'radio_channel',
      'created',
      params.ownerPrincipalId,
      JSON.stringify({ channelName: channel.channelName, channelType: channel.channelType }),
    )

    this.eventBus
      .emit('atc:comms:channel:created', { channelId: channel.channelId })
      .catch(() => undefined)

    return channel
  }

  async joinChannel(
    channelId: string,
    principalId: string,
    role: AtcMembershipRole,
  ): Promise<AtcRadioMembership> {
    const channel = await this.channelRepo.findById(channelId)
    if (channel === null) {
      throw new RadioChannelNotFoundError(channelId)
    }

    const membership = await this.membershipRepo.addMember(channelId, principalId, role)

    await this.auditRepo.record(
      channelId,
      'radio_channel',
      'member_joined',
      principalId,
      JSON.stringify({ role }),
    )

    this.eventBus
      .emit('atc:comms:channel:joined', { channelId, principalId })
      .catch(() => undefined)

    return membership
  }

  async leaveChannel(channelId: string, principalId: string): Promise<void> {
    await this.membershipRepo.removeMember(channelId, principalId)

    await this.auditRepo.record(
      channelId,
      'radio_channel',
      'member_left',
      principalId,
    )

    this.eventBus
      .emit('atc:comms:channel:left', { channelId, principalId })
      .catch(() => undefined)
  }

  async jamChannel(channelId: string): Promise<AtcRadioChannel> {
    const channel = await this.channelRepo.updateStatus(channelId, 'jammed')

    await this.auditRepo.record(
      channelId,
      'radio_channel',
      'jammed',
    )

    this.eventBus
      .emit('atc:comms:channel:jammed', { channelId })
      .catch(() => undefined)

    return channel
  }

  async restoreChannel(channelId: string): Promise<AtcRadioChannel> {
    const channel = await this.channelRepo.updateStatus(channelId, 'active')

    await this.auditRepo.record(
      channelId,
      'radio_channel',
      'restored',
    )

    this.eventBus
      .emit('atc:comms:channel:restored', { channelId })
      .catch(() => undefined)

    return channel
  }
}
