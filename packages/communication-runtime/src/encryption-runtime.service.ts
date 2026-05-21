import type { AtcEventBus } from '@atc/events'
import type { EncryptedChannelRepository } from './encrypted-channel.repository.js'
import type { RadioChannelRepository } from './radio-channel.repository.js'
import type { CommunicationAuditRepository } from './communication-audit.repository.js'
import type { AtcEncryptedChannel } from './encrypted-channel.repository.js'

export class EncryptionRuntimeService {
  constructor(
    private readonly encryptedChannelRepo: EncryptedChannelRepository,
    private readonly channelRepo: RadioChannelRepository,
    private readonly auditRepo: CommunicationAuditRepository,
    private readonly eventBus: AtcEventBus,
  ) {}

  async setEncryption(
    channelId: string,
    encryptionKeyHash: string,
  ): Promise<AtcEncryptedChannel> {
    const encryptedChannel = await this.encryptedChannelRepo.upsert(channelId, encryptionKeyHash)

    await this.auditRepo.record(
      channelId,
      'encrypted_channel',
      'encryption_set',
      undefined,
      JSON.stringify({ keyRotatedAt: encryptedChannel.keyRotatedAt }),
    )

    this.eventBus
      .emit('atc:comms:encryption:set', { channelId })
      .catch(() => undefined)

    return encryptedChannel
  }

  async getEncryption(channelId: string): Promise<AtcEncryptedChannel | null> {
    return this.encryptedChannelRepo.findByChannelId(channelId)
  }
}
