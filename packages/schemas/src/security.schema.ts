import { z } from 'zod'
import { uuidV7Schema } from './helpers.js'

export const atcRiskLevelSchema = z.enum(['normal', 'elevated', 'high', 'critical'])

export const atcViolationTypeSchema = z.enum([
  'EVENT_NOT_WHITELISTED',
  'CLIENT_NOT_ALLOWED',
  'NO_SESSION',
  'RATE_LIMIT_EXCEEDED',
  'SCHEMA_VALIDATION_FAILED',
  'COORD_MISMATCH',
  'ITEM_NOT_OWNED',
  'ECONOMY_ANOMALY',
  'INVENTORY_DUPE_DETECTED',
])

export const atcRiskEventSchema = z.object({
  type: z.string().min(1),
  points: z.number().int().nonnegative(),
  description: z.string(),
  timestamp: z.number().int().positive(),
})

export const atcSecurityRiskScoreSchema = z.object({
  identifier: z.string().min(1),
  score: z.number().int().nonnegative(),
  level: atcRiskLevelSchema,
  events: z.array(atcRiskEventSchema),
  lastUpdated: z.number().int().positive(),
})

export const atcSecurityViolationSchema = z.object({
  source: z.number().int().nonnegative(),
  identifier: z.string(),
  eventName: z.string(),
  violationType: atcViolationTypeSchema,
  severity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  details: z.record(z.unknown()),
  timestamp: z.number().int().positive(),
})
