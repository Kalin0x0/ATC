import { z } from 'zod'
import { uuidV7Schema, isoDateSchema } from './helpers.js'

export const atcGenderSchema = z.enum(['male', 'female', 'other'])

export const atcCharacterSchema = z.object({
  id: uuidV7Schema,
  accountId: uuidV7Schema,
  firstName: z.string().min(2).max(32).regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Name must contain only letters'),
  lastName: z.string().min(2).max(32).regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Name must contain only letters'),
  dateOfBirth: isoDateSchema,
  nationality: z.string().min(2).max(64),
  gender: atcGenderSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  lastSeen: z.date().nullable(),
  metadata: z.record(z.unknown()),
  isDeleted: z.boolean(),
})

export const createCharacterDtoSchema = z.object({
  accountId: uuidV7Schema,
  firstName: z.string().min(2).max(32).regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Name must contain only letters'),
  lastName: z.string().min(2).max(32).regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Name must contain only letters'),
  dateOfBirth: isoDateSchema,
  nationality: z.string().min(2).max(64),
  gender: atcGenderSchema,
})
