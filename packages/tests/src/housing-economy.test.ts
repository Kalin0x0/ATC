import { describe, it, expect } from 'vitest'
import {
  HousingEconomyError,
  RentalContractNotFoundError,
  RentalContractAlreadyActiveError,
  RentalContractTerminatedError,
  ForeclosureNotFoundError,
  ForeclosureAlreadyActiveError,
  ForeclosureCompletedError,
  PropertyTaxNotFoundError,
  PropertyTaxAlreadyPaidError,
  AssetValuationNotFoundError,
  HousingPaymentNotFoundError,
  DuplicatePaymentError,
} from '@atc/housing-economy'
import {
  createRentalContractSchema,
  payRentSchema,
  terminateRentalContractSchema,
  assessPropertyTaxSchema,
  triggerForeclosureSchema,
  valuatePropertySchema,
  housingPaymentSchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('HousingEconomyError hierarchy', () => {
  it('RentalContractNotFoundError extends HousingEconomyError', () => {
    const e = new RentalContractNotFoundError('c-1')
    expect(e).toBeInstanceOf(HousingEconomyError)
    expect(e.message).toContain('c-1')
    expect(e.name).toBe('RentalContractNotFoundError')
  })

  it('RentalContractAlreadyActiveError extends HousingEconomyError', () => {
    const e = new RentalContractAlreadyActiveError('c-2')
    expect(e).toBeInstanceOf(HousingEconomyError)
    expect(e.message).toContain('c-2')
  })

  it('RentalContractTerminatedError extends HousingEconomyError', () => {
    const e = new RentalContractTerminatedError('c-3')
    expect(e).toBeInstanceOf(HousingEconomyError)
    expect(e.message).toContain('c-3')
  })

  it('ForeclosureNotFoundError extends HousingEconomyError', () => {
    const e = new ForeclosureNotFoundError('f-1')
    expect(e).toBeInstanceOf(HousingEconomyError)
    expect(e.message).toContain('f-1')
  })

  it('ForeclosureAlreadyActiveError extends HousingEconomyError', () => {
    const e = new ForeclosureAlreadyActiveError('prop-1')
    expect(e).toBeInstanceOf(HousingEconomyError)
    expect(e.message).toContain('prop-1')
  })

  it('ForeclosureCompletedError extends HousingEconomyError', () => {
    const e = new ForeclosureCompletedError('f-2')
    expect(e).toBeInstanceOf(HousingEconomyError)
    expect(e.message).toContain('f-2')
  })

  it('PropertyTaxNotFoundError extends HousingEconomyError', () => {
    const e = new PropertyTaxNotFoundError('tax-1')
    expect(e).toBeInstanceOf(HousingEconomyError)
    expect(e.message).toContain('tax-1')
  })

  it('PropertyTaxAlreadyPaidError extends HousingEconomyError', () => {
    const e = new PropertyTaxAlreadyPaidError('tax-2')
    expect(e).toBeInstanceOf(HousingEconomyError)
    expect(e.message).toContain('tax-2')
  })

  it('AssetValuationNotFoundError extends HousingEconomyError', () => {
    const e = new AssetValuationNotFoundError('val-1')
    expect(e).toBeInstanceOf(HousingEconomyError)
    expect(e.message).toContain('val-1')
  })

  it('HousingPaymentNotFoundError extends HousingEconomyError', () => {
    const e = new HousingPaymentNotFoundError('pay-1')
    expect(e).toBeInstanceOf(HousingEconomyError)
    expect(e.message).toContain('pay-1')
  })

  it('DuplicatePaymentError extends HousingEconomyError', () => {
    const e = new DuplicatePaymentError('idem-key-1')
    expect(e).toBeInstanceOf(HousingEconomyError)
    expect(e.message).toContain('idem-key-1')
  })
})

// ── Schema Validation ─────────────────────────────────────────────────────────

describe('createRentalContractSchema', () => {
  it('accepts valid input', () => {
    const result = createRentalContractSchema.safeParse({
      propertyId:          'prop-1',
      tenantPrincipalId:   'principal-tenant',
      landlordPrincipalId: 'principal-landlord',
      monthlyRent:         '5000',
      depositAmount:       '10000',
      contractNonce:       'nonce-abc123',
      startDate:           '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-integer rent amount', () => {
    const result = createRentalContractSchema.safeParse({
      propertyId:          'prop-1',
      tenantPrincipalId:   'p-1',
      landlordPrincipalId: 'p-2',
      monthlyRent:         '5000.50',
      depositAmount:       '10000',
      contractNonce:       'nonce-1',
      startDate:           '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(false)
  })

  it('requires contractNonce', () => {
    const result = createRentalContractSchema.safeParse({
      propertyId:          'prop-1',
      tenantPrincipalId:   'p-1',
      landlordPrincipalId: 'p-2',
      monthlyRent:         '5000',
      depositAmount:       '10000',
      startDate:           '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(false)
  })
})

describe('assessPropertyTaxSchema', () => {
  it('accepts valid tax assessment', () => {
    const result = assessPropertyTaxSchema.safeParse({
      propertyId:       'prop-1',
      ownerPrincipalId: 'principal-owner',
      periodLabel:      '2026-Q1',
      taxAmount:        '2500',
      dueAt:            '2026-03-31T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('requires ownerPrincipalId', () => {
    const result = assessPropertyTaxSchema.safeParse({
      propertyId:  'prop-1',
      periodLabel: '2026-Q1',
      taxAmount:   '2500',
      dueAt:       '2026-03-31T00:00:00Z',
    })
    expect(result.success).toBe(false)
  })
})

describe('triggerForeclosureSchema', () => {
  it('accepts valid foreclosure', () => {
    const result = triggerForeclosureSchema.safeParse({
      propertyId:       'prop-1',
      ownerPrincipalId: 'principal-owner',
      foreclosureNonce: 'nonce-fore-1',
      reason:           'Non-payment',
    })
    expect(result.success).toBe(true)
  })

  it('reason is optional', () => {
    const result = triggerForeclosureSchema.safeParse({
      propertyId:       'prop-1',
      ownerPrincipalId: 'p-1',
      foreclosureNonce: 'nonce-1',
    })
    expect(result.success).toBe(true)
  })
})

describe('valuatePropertySchema', () => {
  it('accepts valid valuation', () => {
    const result = valuatePropertySchema.safeParse({
      propertyId:      'prop-1',
      valuatedBy:      'principal-appraiser',
      valuationAmount: '500000',
      notes:           'Annual market appraisal',
    })
    expect(result.success).toBe(true)
  })
})

describe('payRentSchema', () => {
  it('requires idempotencyKey', () => {
    const result = payRentSchema.safeParse({
      contractId: 'c-1',
      amount:     '5000',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid rent payment', () => {
    const result = payRentSchema.safeParse({
      contractId:     'c-1',
      amount:         '5000',
      idempotencyKey: 'pay-idem-1',
    })
    expect(result.success).toBe(true)
  })
})
