import { z } from 'zod'
import { ATC_ENTITY_TYPES } from '@atc/shared-types'

const idSchema = z
  .string()
  .trim()
  .min(1, 'id must not be empty')
  .max(64, 'id too long')

export const entityIdParamSchema = z.object({ id: idSchema })
export type EntityIdParamInput = z.input<typeof entityIdParamSchema>

export const entityTypeSchema = z.enum(ATC_ENTITY_TYPES as readonly [string, ...string[]])

const typesQuerySchema = z
  .union([
    z.string().transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean)),
    z.array(z.string()),
  ])
  .optional()
  .transform((arr) => {
    if (!arr) return undefined
    const valid = (arr as string[]).filter((t) =>
      (ATC_ENTITY_TYPES as readonly string[]).includes(t),
    )
    return valid.length > 0 ? (valid as (typeof ATC_ENTITY_TYPES)[number][]) : undefined
  })

export const entitySearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'q must not be empty').max(128, 'q too long'),
  types: typesQuerySchema,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().trim().min(1).max(256).optional(),
})
export type EntitySearchQueryInput = z.input<typeof entitySearchQuerySchema>
export type EntitySearchQueryOutput = z.output<typeof entitySearchQuerySchema>

export const entityRelationshipsQuerySchema = z.object({
  direction: z.enum(['outbound', 'inbound', 'both']).default('both'),
  relationship: z.string().trim().min(1).max(128).optional(),
  includeEnded: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().trim().min(1).max(256).optional(),
})

export const entityRelatedQuerySchema = z.object({
  depth: z.coerce.number().int().min(1).max(4).default(1),
  relationships: z
    .union([
      z.string().transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean)),
      z.array(z.string()),
    ])
    .optional(),
  includeEnded: z.coerce.boolean().default(false),
})

export const entityHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().trim().min(1).max(256).optional(),
})

export type EntityRelationshipsQueryOutput = z.output<typeof entityRelationshipsQuerySchema>
export type EntityRelatedQueryOutput = z.output<typeof entityRelatedQuerySchema>
export type EntityHistoryQueryOutput = z.output<typeof entityHistoryQuerySchema>
