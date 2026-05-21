import type {
  RuntimeCompletionRepository,
  AtcRuntimeCompletion,
  CreateCompletionParams,
} from './runtime-completion.repository.js'
import type { CoreFinalizationAuditRepository } from './core-finalization-audit.repository.js'
import type { CoreFinalizationEventBus } from './finalization-recovery.service.js'

export class ProductionCompletionService {
  constructor(
    private repo: RuntimeCompletionRepository,
    private auditRepo: CoreFinalizationAuditRepository,
    private eventBus: CoreFinalizationEventBus,
  ) {}

  async createCompletion(params: CreateCompletionParams): Promise<AtcRuntimeCompletion> {
    const record = await this.repo.create(params)
    await this.auditRepo.append({
      eventType: 'completion_created',
      finalizationId: record.completionId,
      ownerServerId: record.ownerServerId,
      auditData: { completionType: record.completionType },
    })
    this.eventBus.emit('atc:core-finalization-runtime:completion:created', {
      completionId: record.completionId,
    }).catch(() => undefined)
    return record
  }

  async progressCompletion(id: string): Promise<AtcRuntimeCompletion> {
    const record = await this.repo.updateStatus(id, 'progressing')
    await this.auditRepo.append({
      eventType: 'completion_progressing',
      finalizationId: record.completionId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:core-finalization-runtime:completion:progressing', {
      completionId: record.completionId,
    }).catch(() => undefined)
    return record
  }

  async completeProduction(id: string): Promise<AtcRuntimeCompletion> {
    const record = await this.repo.updateStatus(id, 'completed', new Date())
    await this.auditRepo.append({
      eventType: 'completion_completed',
      finalizationId: record.completionId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:core-finalization-runtime:completion:completed', {
      completionId: record.completionId,
    }).catch(() => undefined)
    return record
  }

  async abortCompletion(id: string): Promise<AtcRuntimeCompletion> {
    const record = await this.repo.updateStatus(id, 'aborted')
    await this.auditRepo.append({
      eventType: 'completion_aborted',
      finalizationId: record.completionId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:core-finalization-runtime:completion:aborted', {
      completionId: record.completionId,
    }).catch(() => undefined)
    return record
  }

  async getCompletion(id: string): Promise<AtcRuntimeCompletion | null> {
    return this.repo.findById(id)
  }
}
