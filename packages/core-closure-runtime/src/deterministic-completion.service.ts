import type {
  FinalValidationRepository,
  AtcFinalValidation,
  CreateFinalValidationParams,
} from './final-validation.repository.js'
import type { CoreClosureAuditRepository } from './core-closure-audit.repository.js'
import type { CoreClosureEventBus } from './core-closure.service.js'

export class DeterministicCompletionValidator {
  constructor(
    private readonly repo: FinalValidationRepository,
    private readonly audit: CoreClosureAuditRepository,
    private readonly bus: CoreClosureEventBus
  ) {}

  async createValidation(params: CreateFinalValidationParams): Promise<AtcFinalValidation> {
    const record = await this.repo.create(params)
    await this.audit.append(record.id, 'final_validation.created', { validationId: record.validationId })
    this.bus.emit('final_validation.created', { validationId: record.validationId }).catch(() => undefined)
    return record
  }

  async beginValidating(id: string): Promise<AtcFinalValidation> {
    const record = await this.repo.updateStatus(id, 'validating')
    this.bus.emit('final_validation.validating', { validationId: record.validationId }).catch(() => undefined)
    return record
  }

  async completeValidation(id: string): Promise<AtcFinalValidation> {
    const record = await this.repo.updateStatus(id, 'completed', new Date())
    await this.audit.append(record.id, 'deterministic_validation_completed', { validationId: record.validationId })
    this.bus.emit('deterministic_validation_completed', { validationId: record.validationId }).catch(() => undefined)
    this.bus.emit('final_runtime_reconciliation_completed', { validationId: record.validationId }).catch(() => undefined)
    this.bus.emit('atc_core_completed', { validationId: record.validationId }).catch(() => undefined)
    return record
  }

  async failValidation(id: string): Promise<AtcFinalValidation> {
    const record = await this.repo.updateStatus(id, 'failed')
    this.bus.emit('final_validation.failed', { validationId: record.validationId }).catch(() => undefined)
    return record
  }

  async getValidation(id: string): Promise<AtcFinalValidation | null> {
    return this.repo.findById(id)
  }
}
