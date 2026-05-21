import { z } from 'zod'
import { uuidV7Schema } from './helpers.js'

const moneyAccountSchema = z.enum(['cash', 'bank'])

const transactionSourceSchema = z.enum(['system', 'admin', 'api', 'gameplay'])

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(1, 'Idempotency key must not be empty')
  .max(128, 'Idempotency key must be at most 128 characters')

export const currencySchema = z
  .string()
  .trim()
  .min(1)
  .max(8)
  .regex(/^[A-Z0-9]+$/, 'Currency must be uppercase alphanumeric')
  .default('ATC')

// Amount in minor units (e.g. cents). Must be a positive integer within JS safe integer range.
export const amountMinorSchema = z
  .number()
  .int('Amount must be an integer')
  .positive('Amount must be positive')
  .max(Number.MAX_SAFE_INTEGER, 'Amount exceeds maximum safe integer')

const metadataSchema = z
  .record(z.unknown())
  .refine((m) => Object.keys(m).length <= 20, 'Metadata must not exceed 20 keys')
  .optional()

export const walletCreditSchema = z.object({
  account: moneyAccountSchema,
  amount: amountMinorSchema,
  currency: currencySchema,
  reason: z.string().trim().min(1, 'Reason is required').max(128, 'Reason must be at most 128 characters'),
  source: transactionSourceSchema,
  idempotencyKey: idempotencyKeySchema,
  metadata: metadataSchema,
})

export const walletDebitSchema = z.object({
  account: moneyAccountSchema,
  amount: amountMinorSchema,
  currency: currencySchema,
  reason: z.string().trim().min(1, 'Reason is required').max(128, 'Reason must be at most 128 characters'),
  source: transactionSourceSchema,
  idempotencyKey: idempotencyKeySchema,
  metadata: metadataSchema,
})

export const walletTransferSchema = z
  .object({
    fromAccount: moneyAccountSchema,
    toAccount: moneyAccountSchema,
    amount: amountMinorSchema,
    currency: currencySchema,
    reason: z.string().trim().min(1, 'Reason is required').max(128, 'Reason must be at most 128 characters'),
    idempotencyKey: idempotencyKeySchema,
    metadata: metadataSchema,
  })
  .refine((d) => d.fromAccount !== d.toAccount, {
    message: 'fromAccount and toAccount must be different',
    path: ['toAccount'],
  })

export const walletCharacterParamSchema = z.object({
  characterId: uuidV7Schema,
})

export const walletTransactionQuerySchema = z.object({
  currency: currencySchema,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export type WalletCreditInput = z.input<typeof walletCreditSchema>
export type WalletDebitInput = z.input<typeof walletDebitSchema>
export type WalletTransferInput = z.input<typeof walletTransferSchema>
