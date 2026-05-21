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

export type AccountUpsertRequestInput = z.input<typeof accountUpsertRequestSchema>
export type AccountUpsertResponseOutput = z.output<typeof accountUpsertResponseSchema>
