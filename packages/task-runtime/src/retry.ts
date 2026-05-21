import type { AtcRetryPolicy } from '@atc/shared-types'

export const DEFAULT_RETRY_POLICY: AtcRetryPolicy = {
  maxRetries: 3,
  initialDelayMs: 1_000,
  backoffMultiplier: 2,
  maxDelayMs: 30_000,
}

export function computeRetryDelayMs(policy: AtcRetryPolicy, attemptNumber: number): number {
  const delay = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attemptNumber)
  return Math.min(delay, policy.maxDelayMs)
}

export type FailureClass = 'retryable' | 'non-retryable'

export function classifyFailure(err: unknown): FailureClass {
  if (!(err instanceof Error)) return 'retryable'

  const name = err.name
  const message = err.message.toLowerCase()

  // Non-retryable: permission/validation/payload errors
  if (
    name === 'TaskPayloadInvalidError' ||
    name === 'TaskTypeInvalidError' ||
    name === 'TaskPayloadTooLargeError' ||
    name === 'AtcPermissionDeniedError' ||
    name === 'ZodError'
  ) {
    return 'non-retryable'
  }

  // Non-retryable message patterns
  if (
    message.includes('permission denied') ||
    message.includes('validation') ||
    message.includes('malformed') ||
    message.includes('invalid payload') ||
    message.includes('schema')
  ) {
    return 'non-retryable'
  }

  // Retryable: network, Redis, service unavailable
  return 'retryable'
}
