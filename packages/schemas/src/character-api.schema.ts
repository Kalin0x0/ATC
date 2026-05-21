import { z } from 'zod'
import { uuidV7Schema, isoDateSchema } from './helpers.js'

const namePartSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(64, 'Name must be at most 64 characters')
  .regex(
    /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/,
    'Name may only contain letters, spaces, hyphens, and apostrophes'
  )

const genderSchema = z.enum(['male', 'female', 'other'])

export const characterCreateSchema = z.object({
  accountId: uuidV7Schema,
  slot: z.number().int().min(1).max(5),
  firstName: namePartSchema,
  lastName: namePartSchema,
  gender: genderSchema,
  dateOfBirth: isoDateSchema
    .refine((d) => new Date(d) < new Date(), { message: 'Date of birth must be in the past' })
    .optional(),
  nationality: z.string().trim().min(2).max(64).optional(),
  // Limit metadata to 20 keys max; values are arbitrary but the request body limit (64 KB) caps total size.
  metadata: z.record(z.unknown()).refine(
    (m) => Object.keys(m).length <= 20,
    { message: 'Metadata must not exceed 20 keys' }
  ).optional(),
})

export const characterSelectSchema = z.object({
  characterId: uuidV7Schema,
})

export const characterIdParamSchema = z.object({
  characterId: uuidV7Schema,
})

export const accountIdParamSchema = z.object({
  accountId: uuidV7Schema,
})

export const sessionIdParamSchema = z.object({
  sessionId: uuidV7Schema,
})

export type CharacterCreateInput = z.input<typeof characterCreateSchema>
export type CharacterSelectInput = z.input<typeof characterSelectSchema>
