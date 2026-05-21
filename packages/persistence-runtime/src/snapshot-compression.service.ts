import type { SnapshotCompressionRepository, AtcSnapshotCompression, CreateCompressionParams } from './snapshot-compression.repository.js'
import type { PersistenceAuditRepository } from './persistence-audit.repository.js'
import type { PersistenceRuntimeEventBus } from './persistence-consistency.service.js'

export class SnapshotCompressionService {
  constructor(
    private compressionRepo: SnapshotCompressionRepository,
    private auditRepo: PersistenceAuditRepository,
    private eventBus: PersistenceRuntimeEventBus,
  ) {}

  async startCompression(params: CreateCompressionParams): Promise<AtcSnapshotCompression> {
    const compression = await this.compressionRepo.create(params)
    await this.auditRepo.append({ snapshotId: params.snapshotId, eventType: 'compression_started' })
    this.eventBus.emit('atc:persistence:compression:started', { compressionId: compression.compressionId }).catch(() => undefined)
    return compression
  }

  async completeCompression(id: string): Promise<AtcSnapshotCompression> {
    const compression = await this.compressionRepo.updateStatus(id, 'completed', new Date())
    this.eventBus.emit('atc:persistence:compression:completed', { compressionId: compression.compressionId }).catch(() => undefined)
    return compression
  }

  async failCompression(id: string): Promise<AtcSnapshotCompression> {
    const compression = await this.compressionRepo.updateStatus(id, 'failed')
    this.eventBus.emit('atc:persistence:compression:failed', { compressionId: compression.compressionId }).catch(() => undefined)
    return compression
  }

  async getCompression(id: string): Promise<AtcSnapshotCompression | null> {
    return this.compressionRepo.findById(id)
  }
}
