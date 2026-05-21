import { z } from 'zod'
import { uuidV7Schema, atcEventNameSchema } from './helpers.js'

export const atcEventEnvelopeSchema = z.object({
  _version: z.number().int().positive(),
  _timestamp: z.number().int().positive(),
  _traceId: uuidV7Schema,
  _event: atcEventNameSchema,
  _source: z.number().int().nonnegative().nullable(),
  payload: z.unknown(),
})

export const atcEventRegistrationSchema = z.object({
  eventName: atcEventNameSchema,
  clientAllowed: z.boolean(),
  requireSession: z.boolean(),
  rateLimit: z.object({
    windowMs: z.number().int().positive(),
    max: z.number().int().positive(),
  }),
  schemaId: z.string().optional(),
})

export function createEventEnvelopeSchema<T extends z.ZodTypeAny>(payloadSchema: T) {
  return atcEventEnvelopeSchema.extend({
    payload: payloadSchema,
  })
}

export const localeRequestEventSchema = z.object({
  language: z.enum(['en', 'de', 'fa']),
})
