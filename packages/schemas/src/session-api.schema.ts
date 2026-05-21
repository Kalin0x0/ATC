import { z } from 'zod'
import { uuidV7Schema } from './helpers.js'
import { ATC_SUPPORTED_LOCALES } from '@atc/shared-types'

const localeSchema = z.enum([...ATC_SUPPORTED_LOCALES] as [string, ...string[]])

export const sessionCreateRequestSchema = z.object({
  accountId: uuidV7Schema,
  source: z.number().int().positive(),
  name: z.string().min(1).max(256),
  primaryIdentifier: z.string().min(1).max(128),
  language: localeSchema,
})

export const sessionResponseSchema = z.object({
  sessionId: uuidV7Schema,
  accountId: uuidV7Schema,
  source: z.number().int().positive(),
  language: localeSchema,
  state: z.enum(['connecting', 'active', 'ended']),
})

export const sourceParamSchema = z.object({
  source: z.coerce.number().int().positive(),
})

export type SessionCreateRequestInput = z.input<typeof sessionCreateRequestSchema>
export type SessionResponseOutput = z.output<typeof sessionResponseSchema>
