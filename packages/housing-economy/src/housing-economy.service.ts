import type { RentalContractService } from './rental-contract.service.js'
import type { ForeclosureService } from './foreclosure.service.js'
import type { PropertyTaxService } from './property-tax.service.js'
import type { AssetValuationService } from './asset-valuation.service.js'
import type { TenantManagementService } from './tenant-management.service.js'
import type { AtcRentalContract, CreateContractParams } from './rental-contract.repository.js'
import type { AtcHousingPayment } from './housing-payment.repository.js'
import type { AtcForeclosure, StartForeclosureParams } from './foreclosure.repository.js'
import type { AtcPropertyTax, AssessTaxParams } from './property-tax.repository.js'

export class HousingEconomyService {
  constructor(
    private readonly rentalContractService: RentalContractService,
    private readonly foreclosureService: ForeclosureService,
    private readonly propertyTaxService: PropertyTaxService,
    private readonly assetValuationService: AssetValuationService,
    private readonly tenantManagementService: TenantManagementService,
  ) {}

  async createRentalContract(params: CreateContractParams): Promise<AtcRentalContract> {
    return this.rentalContractService.createContract(params)
  }

  async collectRent(
    contractId: string,
    idempotencyKey: string,
  ): Promise<AtcHousingPayment> {
    return this.rentalContractService.collectRent(contractId, idempotencyKey)
  }

  async startForeclosure(params: StartForeclosureParams): Promise<AtcForeclosure> {
    return this.foreclosureService.startForeclosure(params)
  }

  async completeForeclosure(foreclosureId: string): Promise<AtcForeclosure> {
    return this.foreclosureService.completeForeclosure(foreclosureId)
  }

  async assessPropertyTax(params: AssessTaxParams): Promise<AtcPropertyTax> {
    return this.propertyTaxService.assessTax(params)
  }

  async payPropertyTax(
    taxId: string,
    paidByPrincipalId: string,
    idempotencyKey: string,
  ): Promise<AtcPropertyTax> {
    return this.propertyTaxService.payTax(taxId, paidByPrincipalId, idempotencyKey)
  }
}
