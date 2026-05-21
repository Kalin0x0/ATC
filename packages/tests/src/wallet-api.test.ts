import { describe, it, expect } from 'vitest'
import { validate } from '@atc/schemas'
import { walletCreditSchema, walletDebitSchema, walletTransferSchema } from '@atc/schemas'

const validCredit = {
  account: 'cash' as const,
  amount: 500,
  currency: 'ATC',
  reason: 'reward',
  source: 'system' as const,
  idempotencyKey: 'idem-key-001',
}

describe('walletCreditSchema', () => {
  it('accepts a valid credit payload', () => {
    expect(validate(walletCreditSchema, validCredit).success).toBe(true)
  })

  it('accepts amount of 1 (minimum positive integer)', () => {
    expect(validate(walletCreditSchema, { ...validCredit, amount: 1 }).success).toBe(true)
  })

  it('accepts all valid account values', () => {
    for (const account of ['cash', 'bank']) {
      expect(validate(walletCreditSchema, { ...validCredit, account }).success).toBe(true)
    }
  })

  it('accepts all valid source values', () => {
    for (const source of ['system', 'admin', 'api', 'gameplay']) {
      expect(validate(walletCreditSchema, { ...validCredit, source }).success).toBe(true)
    }
  })

  it('defaults currency to ATC when omitted', () => {
    const { currency: _c, ...withoutCurrency } = validCredit
    const result = validate(walletCreditSchema, withoutCurrency)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.currency).toBe('ATC')
    }
  })

  it('rejects amount of 0', () => {
    expect(validate(walletCreditSchema, { ...validCredit, amount: 0 }).success).toBe(false)
  })

  it('rejects negative amount', () => {
    expect(validate(walletCreditSchema, { ...validCredit, amount: -1 }).success).toBe(false)
  })

  it('rejects float amount', () => {
    expect(validate(walletCreditSchema, { ...validCredit, amount: 1.5 }).success).toBe(false)
  })

  it('rejects invalid account value', () => {
    expect(validate(walletCreditSchema, { ...validCredit, account: 'wallet' }).success).toBe(false)
  })

  it('rejects invalid source value', () => {
    expect(validate(walletCreditSchema, { ...validCredit, source: 'player' }).success).toBe(false)
  })

  it('rejects empty idempotency key', () => {
    expect(validate(walletCreditSchema, { ...validCredit, idempotencyKey: '' }).success).toBe(false)
  })

  it('rejects idempotency key longer than 128 characters', () => {
    expect(validate(walletCreditSchema, { ...validCredit, idempotencyKey: 'x'.repeat(129) }).success).toBe(false)
  })

  it('rejects empty reason', () => {
    expect(validate(walletCreditSchema, { ...validCredit, reason: '' }).success).toBe(false)
  })

  it('rejects reason longer than 128 characters', () => {
    expect(validate(walletCreditSchema, { ...validCredit, reason: 'x'.repeat(129) }).success).toBe(false)
  })

  it('rejects lowercase currency', () => {
    expect(validate(walletCreditSchema, { ...validCredit, currency: 'atc' }).success).toBe(false)
  })

  it('rejects currency longer than 8 characters', () => {
    expect(validate(walletCreditSchema, { ...validCredit, currency: 'TOOLONGCUR' }).success).toBe(false)
  })

  it('accepts MAX_SAFE_INTEGER as amount', () => {
    expect(validate(walletCreditSchema, { ...validCredit, amount: Number.MAX_SAFE_INTEGER }).success).toBe(true)
  })

  it('rejects amount above MAX_SAFE_INTEGER', () => {
    expect(validate(walletCreditSchema, { ...validCredit, amount: Number.MAX_SAFE_INTEGER + 1 }).success).toBe(false)
  })

  it('accepts optional metadata', () => {
    expect(validate(walletCreditSchema, { ...validCredit, metadata: { extra: 'info' } }).success).toBe(true)
  })
})

describe('walletCreditSchema — metadata limit (BUG-6)', () => {
  it('accepts metadata with exactly 20 keys', () => {
    const meta = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, i]))
    expect(validate(walletCreditSchema, { ...validCredit, metadata: meta }).success).toBe(true)
  })

  it('rejects metadata with 21 keys', () => {
    const meta = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, i]))
    expect(validate(walletCreditSchema, { ...validCredit, metadata: meta }).success).toBe(false)
  })
})

describe('walletDebitSchema', () => {
  it('accepts a valid debit payload', () => {
    expect(validate(walletDebitSchema, validCredit).success).toBe(true)
  })

  it('rejects float amount', () => {
    expect(validate(walletDebitSchema, { ...validCredit, amount: 0.99 }).success).toBe(false)
  })

  it('rejects metadata with more than 20 keys', () => {
    const meta = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, i]))
    expect(validate(walletDebitSchema, { ...validCredit, metadata: meta }).success).toBe(false)
  })
})

describe('walletTransferSchema — metadata limit (BUG-6)', () => {
  it('rejects transfer metadata with more than 20 keys', () => {
    const meta = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, i]))
    const validTransfer = {
      fromAccount: 'cash' as const,
      toAccount: 'bank' as const,
      amount: 1000,
      currency: 'ATC',
      reason: 'deposit',
      idempotencyKey: 'idem-meta-001',
    }
    expect(validate(walletTransferSchema, { ...validTransfer, metadata: meta }).success).toBe(false)
  })
})

describe('walletTransferSchema', () => {
  const validTransfer = {
    fromAccount: 'cash' as const,
    toAccount: 'bank' as const,
    amount: 1000,
    currency: 'ATC',
    reason: 'deposit',
    idempotencyKey: 'idem-transfer-001',
  }

  it('accepts a valid cash→bank transfer', () => {
    expect(validate(walletTransferSchema, validTransfer).success).toBe(true)
  })

  it('accepts a valid bank→cash transfer', () => {
    expect(validate(walletTransferSchema, { ...validTransfer, fromAccount: 'bank', toAccount: 'cash' }).success).toBe(true)
  })

  it('rejects when fromAccount equals toAccount (cash→cash)', () => {
    expect(validate(walletTransferSchema, { ...validTransfer, toAccount: 'cash' }).success).toBe(false)
  })

  it('rejects when fromAccount equals toAccount (bank→bank)', () => {
    expect(validate(walletTransferSchema, { ...validTransfer, fromAccount: 'bank', toAccount: 'bank' }).success).toBe(false)
  })

  it('rejects zero amount', () => {
    expect(validate(walletTransferSchema, { ...validTransfer, amount: 0 }).success).toBe(false)
  })

  it('rejects float amount', () => {
    expect(validate(walletTransferSchema, { ...validTransfer, amount: 1.1 }).success).toBe(false)
  })

  it('defaults currency to ATC when omitted', () => {
    const { currency: _c, ...withoutCurrency } = validTransfer
    const result = validate(walletTransferSchema, withoutCurrency)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.currency).toBe('ATC')
    }
  })
})
