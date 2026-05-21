import { z } from 'zod'
import { uuidV7Schema } from './helpers.js'

export const atcAccountSchema = z.object({
  id: uuidV7Schema,
  identifier: z.string().min(1).max(128),
  licenses: z.array(z.string().min(1).max(128)).min(1),
  discordId: z.string().nullable(),
  fivemId: z.string().nullable(),
  lastIp: z.string().ip().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  isBanned: z.boolean(),
})

export const createAccountDtoSchema = z.object({
  identifier: z.string().min(1).max(128),
  licenses: z.array(z.string().min(1).max(128)).min(1),
  discordId: z.string().optional(),
  fivemId: z.string().optional(),
  lastIp: z.string().ip().optional(),
})

export type AtcAccountInput = z.input<typeof atcAccountSchema>
export type AtcAccountOutput = z.output<typeof atcAccountSchema>
