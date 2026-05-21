import { z } from 'zod'

// ── Common primitives ────────────────────────────────────────────────────────

const idSchema = z
  .string()
  .trim()
  .min(1, 'id must not be empty')
  .max(64, 'id too long')

// ── Pagination ────────────────────────────────────────────────────────────────

export const mdtPaginationSchema = z.object({
  limit: z.coerce
    .number()
    .int('limit must be an integer')
    .min(1, 'limit must be >= 1')
    .max(100, 'limit must be <= 100')
    .default(20),
  cursor: z
    .string()
    .trim()
    .min(1)
    .max(256)
    .optional(),
})

export type MdtPaginationInput = z.input<typeof mdtPaginationSchema>
export type MdtPaginationOutput = z.output<typeof mdtPaginationSchema>

// ── Params ────────────────────────────────────────────────────────────────────

export const mdtCharacterParamSchema = z.object({
  id: idSchema,
})

export type MdtCharacterParamInput = z.input<typeof mdtCharacterParamSchema>

export const mdtIncidentParamSchema = z.object({
  id: idSchema,
})

export type MdtIncidentParamInput = z.input<typeof mdtIncidentParamSchema>

// ── Search query ──────────────────────────────────────────────────────────────

export const mdtSearchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, 'q must not be empty')
    .max(128, 'q too long'),
  limit: z.coerce
    .number()
    .int('limit must be an integer')
    .min(1, 'limit must be >= 1')
    .max(100, 'limit must be <= 100')
    .default(20),
  cursor: z
    .string()
    .trim()
    .min(1)
    .max(256)
    .optional(),
})

export type MdtSearchQueryInput = z.input<typeof mdtSearchQuerySchema>
export type MdtSearchQueryOutput = z.output<typeof mdtSearchQuerySchema>
