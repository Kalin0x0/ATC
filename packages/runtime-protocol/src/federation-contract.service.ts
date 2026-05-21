import type { FederationContractRepository, AtcFederationContract } from './federation-contract.repository.js'
import type { AtcFederationContractType } from './federation-contract.repository.js'
import type { ProtocolAuditRepository } from './protocol-audit.repository.js'
import type { RuntimeProtocolEventBus } from './protocol-recovery.service.js'
import { generateId } from './id.js'

export interface RegisterContractServiceParams {
  contractType: AtcFederationContractType
  ownerServerId: string
  targetServerId: string
  contractNonce: string
  contractData?: Record<string, unknown> | undefined
  expiresAt?: Date | null | undefined
}

export class FederationContractService {
  constructor(
    private contractRepo: FederationContractRepository,
    private auditRepo: ProtocolAuditRepository,
    private eventBus: RuntimeProtocolEventBus,
  ) {}

  async registerContract(params: RegisterContractServiceParams): Promise<AtcFederationContract> {
    const contract = await this.contractRepo.create({
      contractId: generateId(),
      contractType: params.contractType,
      ownerServerId: params.ownerServerId,
      targetServerId: params.targetServerId,
      contractNonce: params.contractNonce,
      contractData: params.contractData,
      expiresAt: params.expiresAt,
    })

    try {
      await this.auditRepo.append({
        eventType: 'contract_registered',
        contractId: contract.contractId,
        ownerServerId: contract.ownerServerId,
        auditData: { contractType: contract.contractType, targetServerId: contract.targetServerId },
      })
    } catch { /* audit failure must not break main operation */ }

    this.eventBus
      .emit('atc:runtime-protocol:contract:registered', {
        id: contract.id,
        contractId: contract.contractId,
        contractType: contract.contractType,
      })
      .catch(() => undefined)

    return contract
  }

  async activateContract(id: string): Promise<AtcFederationContract> {
    const contract = await this.contractRepo.updateStatus(id, 'active')

    try {
      await this.auditRepo.append({
        eventType: 'contract_activated',
        contractId: contract.contractId,
        ownerServerId: contract.ownerServerId,
      })
    } catch { /* audit failure must not break main operation */ }

    this.eventBus
      .emit('atc:runtime-protocol:contract:activated', { id: contract.id, contractId: contract.contractId })
      .catch(() => undefined)

    return contract
  }

  async revokeContract(id: string): Promise<AtcFederationContract> {
    const contract = await this.contractRepo.updateStatus(id, 'revoked')

    try {
      await this.auditRepo.append({
        eventType: 'contract_revoked',
        contractId: contract.contractId,
        ownerServerId: contract.ownerServerId,
      })
    } catch { /* audit failure must not break main operation */ }

    this.eventBus
      .emit('atc:runtime-protocol:contract:revoked', { id: contract.id, contractId: contract.contractId })
      .catch(() => undefined)

    return contract
  }

  async getContract(id: string): Promise<AtcFederationContract | null> {
    return this.contractRepo.findById(id)
  }
}
