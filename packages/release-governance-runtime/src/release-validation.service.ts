import type {
  ReleaseValidationRepository,
  AtcReleaseValidation,
  CreateReleaseValidationParams,
} from './release-validation.repository.js'
import type { ReleaseAuditRepository } from './release-audit.repository.js'
import type { ReleaseGovernanceEventBus } from './release-governance.service.js'

export class RuntimeReleaseValidationService {
  constructor(
    private readonly repo: ReleaseValidationRepository,
    private readonly audit: ReleaseAuditRepository,
    private readonly bus: ReleaseGovernanceEventBus
  ) {}

  async createValidation(params: CreateReleaseValidationParams): Promise<AtcReleaseValidation> {
    const record = await this.repo.create(params)
    await this.audit.append(record.id, 'release_validation.created', { validationId: record.validationId })
    this.bus.emit('release_validation.created', { validationId: record.validationId }).catch(() => undefined)
    return record
  }

  async beginValidating(id: string): Promise<AtcReleaseValidation> {
    const record = await this.repo.updateStatus(id, 'validating')
    this.bus.emit('release_validation.validating', { validationId: record.validationId }).catch(() => undefined)
    return record
  }

  async passValidation(id: string): Promise<AtcReleaseValidation> {
    const record = await this.repo.updateStatus(id, 'passed', new Date())
    await this.audit.append(record.id, 'release_validation.passed', { validationId: record.validationId })
    this.bus.emit('release_validation.passed', { validationId: record.validationId }).catch(() => undefined)
    return record
  }

  async failValidation(id: string): Promise<AtcReleaseValidation> {
    const record = await this.repo.updateStatus(id, 'failed')
    this.bus.emit('release_validation.failed', { validationId: record.validationId }).catch(() => undefined)
    return record
  }

  async getValidation(id: string): Promise<AtcReleaseValidation | null> {
    return this.repo.findById(id)
  }
}
