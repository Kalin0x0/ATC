import { z } from 'zod'

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: string[] }

// Use ZodTypeAny so TypeScript infers T from the OUTPUT type only,
// avoiding false `string | undefined` inference from ZodDefault schemas.
export function validate<S extends z.ZodTypeAny>(
  schema: S,
  input: unknown,
): ValidationResult<z.output<S>> {
  const result = schema.safeParse(input)
  if (result.success) {
    return { success: true, data: result.data as z.output<S> }
  }
  return {
    success: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    ),
  }
}

export function validateOrThrow<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  return schema.parse(input) as z.output<S>
}

export const uuidV7Schema = z
  .string()
  .regex(/^[0-9A-Za-z]{26}$/, 'Must be a valid ULID/UUID v7')

export const semverSchema = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/,
    'Must be a valid semantic version'
  )

export const semverRangeSchema = z
  .string()
  .min(1)

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be ISO date format YYYY-MM-DD')

export const atcEventNameSchema = z
  .string()
  .regex(/^atc:[a-z]+:[a-z_]+(?::[a-z_]+)?$/, 'Must be a valid ATC event name (atc:domain:noun:verb)')
