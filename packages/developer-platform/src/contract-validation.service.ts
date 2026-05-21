import type {
  ContractValidationRepository,
  AtcContractValidation,
  CreateContractParams,
} from './contract-validation.repository.js'
import type { DeveloperAuditRepository } from './developer-audit.repository.js'
import type { DeveloperPlatformEventBus } from './developer-platform.service.js'

export class RuntimeContractValidationService {
  constructor(
    private readonly repo: ContractValidationRepository,
    private readonly audit: DeveloperAuditRepository,
    private readonly bus: DeveloperPlatformEventBus
  ) {}

  async createContract(params: CreateContractParams): Promise<AtcContractValidation> {
    const record = await this.repo.create(params)
    await this.audit.append(record.id, 'contract.created', { contractId: record.contractId })
    this.bus.emit('contract.created', { contractId: record.contractId }).catch(() => undefined)
    return record
  }

  async beginValidating(id: string): Promise<AtcContractValidation> {
    const record = await this.repo.updateStatus(id, 'validating')
    this.bus.emit('contract.validating', { contractId: record.contractId }).catch(() => undefined)
    return record
  }

  async passContract(id: string): Promise<AtcContractValidation> {
    const record = await this.repo.updateStatus(id, 'valid', new Date())
    await this.audit.append(record.id, 'contract_validated', { contractId: record.contractId })
    this.bus.emit('contract_validated', { contractId: record.contractId }).catch(() => undefined)
    return record
  }

  async failContract(id: string): Promise<AtcContractValidation> {
    const record = await this.repo.updateStatus(id, 'invalid')
    this.bus.emit('contract.invalid', { contractId: record.contractId }).catch(() => undefined)
    return record
  }

  async getContract(id: string): Promise<AtcContractValidation | null> {
    return this.repo.findById(id)
  }
}
