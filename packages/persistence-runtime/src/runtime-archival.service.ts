import type { SnapshotArchiveRepository, AtcSnapshotArchive, CreateArchiveParams } from './snapshot-archive.repository.js'
import type { PersistenceAuditRepository } from './persistence-audit.repository.js'
import type { PersistenceRuntimeEventBus } from './persistence-consistency.service.js'

export class RuntimeArchivalService {
  constructor(
    private archiveRepo: SnapshotArchiveRepository,
    private auditRepo: PersistenceAuditRepository,
    private eventBus: PersistenceRuntimeEventBus,
  ) {}

  async createArchive(params: CreateArchiveParams): Promise<AtcSnapshotArchive> {
    const archive = await this.archiveRepo.create(params)
    await this.auditRepo.append({ snapshotId: params.sourceSnapshotId, eventType: 'archive_created' })
    this.eventBus.emit('atc:persistence:archive:created', { archiveId: archive.archiveId }).catch(() => undefined)
    return archive
  }

  async completeArchive(id: string): Promise<AtcSnapshotArchive> {
    const archive = await this.archiveRepo.updateStatus(id, 'completed', new Date())
    this.eventBus.emit('atc:persistence:archive:completed', { archiveId: archive.archiveId }).catch(() => undefined)
    return archive
  }

  async getArchive(id: string): Promise<AtcSnapshotArchive | null> {
    return this.archiveRepo.findById(id)
  }
}
