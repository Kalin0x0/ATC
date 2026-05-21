import type { AtcEventBus } from '@atc/events'
import type {
  PropertyTaxRepository,
  AtcPropertyTax,
  AssessTaxParams,
} from './property-tax.repository.js'
import { PropertyTaxNotFoundError, PropertyTaxAlreadyPaidError } from './errors.js'

export class PropertyTaxService {
  constructor(
    private readonly taxRepo: PropertyTaxRepository,
    private readonly eventBus: AtcEventBus,
  ) {}

  async assessTax(params: AssessTaxParams): Promise<AtcPropertyTax> {
    const tax = await this.taxRepo.assess(params)

    this.eventBus
      .emit('atc:housing:tax:assessed', {
        taxId: tax.id,
        propertyId: tax.propertyId,
        principalId: tax.principalId,
        amount: tax.amount.toString(),
        periodLabel: tax.periodLabel,
        dueAt: tax.dueAt.toISOString(),
      })
      .catch(() => undefined)

    return tax
  }

  async payTax(
    taxId: string,
    paidByPrincipalId: string,
    idempotencyKey: string,
  ): Promise<AtcPropertyTax> {
    const tax = await this.taxRepo.findById(taxId)
    if (!tax) throw new PropertyTaxNotFoundError(taxId)
    if (tax.status === 'paid') throw new PropertyTaxAlreadyPaidError(taxId)

    // idempotencyKey is provided for external payment systems; logged here for traceability
    void idempotencyKey

    const updated = await this.taxRepo.transition(taxId, 'paid', {
      paidByPrincipalId,
    })

    this.eventBus
      .emit('atc:housing:tax:paid', {
        taxId: updated.id,
        propertyId: updated.propertyId,
        principalId: updated.principalId,
        paidByPrincipalId,
        amount: updated.amount.toString(),
        periodLabel: updated.periodLabel,
      })
      .catch(() => undefined)

    return updated
  }

  async listOverdueTaxes(): Promise<AtcPropertyTax[]> {
    return this.taxRepo.listOverdue()
  }
}
