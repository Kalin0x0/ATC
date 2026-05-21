import { z } from 'zod'
import { uuidV7Schema } from './helpers.js'
import { ATC_SUPPORTED_LOCALES } from '@atc/shared-types'

const localeCodeSchema = z.enum([...ATC_SUPPORTED_LOCALES] as [string, ...string[]])

export const atcPlayerSessionSchema = z.object({
  id: uuidV7Schema,
  accountId: uuidV7Schema,
  characterId: uuidV7Schema.nullable(),
  source: z.number().int().positive(),
  identifier: z.string().min(1).max(128),
  connectedAt: z.date(),
  lastSeen: z.date(),
  language: localeCodeSchema,
  ipAddress: z.string().ip().nullable(),
  isActive: z.boolean(),
})

export const createSessionDtoSchema = z.object({
  accountId: uuidV7Schema,
  source: z.number().int().positive(),
  identifier: z.string().min(1).max(128),
  language: localeCodeSchema,
  ipAddress: z.string().ip().optional(),
})

export const clientReadyPayloadSchema = z.object({
  language: localeCodeSchema.optional(),
})
