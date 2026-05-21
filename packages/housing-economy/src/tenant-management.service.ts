import type { AtcEventBus } from '@atc/events'
import type {
  TenantHistoryRepository,
  AtcTenantHistory,
} from './tenant-history.repository.js'
import type { RentalContractRepository } from './rental-contract.repository.js'
import { RentalContractNotFoundError } from './errors.js'

export class TenantManagementService {
  constructor(
    private readonly contractRepo: RentalContractRepository,
    private readonly tenantHistoryRepo: TenantHistoryRepository,
    private readonly eventBus: AtcEventBus,
  ) {}

  async assignTenant(
    contractId: string,
    propertyId: string,
    tenantPrincipalId: string,
    assignedByPrincipalId: string,
  ): Promise<void> {
    const contract = await this.contractRepo.findById(contractId)
    if (!contract) throw new RentalContractNotFoundError(contractId)

    await this.tenantHistoryRepo.record({
      contractId,
      propertyId,
      tenantPrincipalId,
      action: 'assigned',
      performedByPrincipalId: assignedByPrincipalId,
    })

    this.eventBus
      .emit('atc:housing:tenant:assigned', {
        contractId,
        propertyId,
        tenantPrincipalId,
        assignedByPrincipalId,
      })
      .catch(() => undefined)
  }

  async transferTenant(
    contractId: string,
    toPropertyId: string,
    transferredByPrincipalId: string,
  ): Promise<AtcTenantHistory> {
    const contract = await this.contractRepo.findById(contractId)
    if (!contract) throw new RentalContractNotFoundError(contractId)

    const history = await this.tenantHistoryRepo.record({
      contractId,
      propertyId: toPropertyId,
      tenantPrincipalId: contract.tenantPrincipalId,
      action: 'transferred',
      performedByPrincipalId: transferredByPrincipalId,
      notes: `Transferred from property ${contract.propertyId} to ${toPropertyId}`,
    })

    this.eventBus
      .emit('atc:housing:tenant:transferred', {
        contractId,
        fromPropertyId: contract.propertyId,
        toPropertyId,
        tenantPrincipalId: contract.tenantPrincipalId,
        transferredByPrincipalId,
      })
      .catch(() => undefined)

    return history
  }
}
