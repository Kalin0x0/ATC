import { z } from 'zod'
import { uuidV7Schema } from './helpers.js'
import { ATC_SUPPORTED_LOCALES } from '@atc/shared-types'

const localeSchema = z.enum([...ATC_SUPPORTED_LOCALES] as [string, ...string[]])

export const accountIdentifiersSchema = z.object({
  license: z.string().min(1).max(128).optional(),
  license2: z.string().min(1).max(128).optional(),
  discord: z.string().min(1).max(128).optional(),
  steam: z.string().min(1).max(128).optional(),
  fivem: z.string().min(1).max(128).optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one identifier is required' }
)

export const accountUpsertRequestSchema = z.object({
  primaryIdentifier: z.string().min(1).max(128),
  identifiers: accountIdentifiersSchema,
  preferredLanguage: localeSchema,
})

export const accountUpsertResponseSchema = z.object({
  accountId: uuidV7Schema,
  status: z.enum(['active', 'banned', 'suspended']),
  preferredLanguage: localeSchema,
  created: z.boolean(),
})

export const banCheckResponseSchema = z.object({
  allowed: z.boolean(),
  status: z.enum(['active', 'banned', 'suspended']),
  reason: z.string().nullable(),
  accountId: uuidV7Schema.nullable(),
})

export const identifierParamSchema = z.object({
  identifier: z.string().min(1).max(128),
})

/**
 * Ban an account. The caller may name the account by id or by any identifier it
 * is known under — the game server has a Rockstar license in hand, not an
 * account id, and looking it up first would be a round trip for nothing.
 * Exactly one of the two is required.
 *
 * expiresAt omitted or null is a permanent ban.
 */
export const banCreateRequestSchema = z.object({
  accountId: uuidV7Schema.optional(),
  identifier: z.string().min(1).max(128).optional(),
  reason: z.string().min(1).max(512),
  expiresAt: z.string().datetime().nullable().optional(),
  bannedByPrincipalId: z.string().min(1).max(128).nullable().optional(),
}).refine(
  (data) => data.accountId !== undefined || data.identifier !== undefined,
  { message: 'Either accountId or identifier is required' }
)

export const banResponseSchema = z.object({
  id: z.string().min(1),
  accountId: uuidV7Schema,
  reason: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
})

export const banIdParamSchema = z.object({
  banId: z.string().min(1).max(64),
})

export type AccountUpsertRequestInput = z.input<typeof accountUpsertRequestSchema>
export type AccountUpsertResponseOutput = z.output<typeof accountUpsertResponseSchema>
export type BanCreateRequestInput = z.input<typeof banCreateRequestSchema>
