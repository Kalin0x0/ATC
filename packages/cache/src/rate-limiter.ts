import type { RedisClient } from './client.js'

export interface RateLimiterOptions {
  /** Key namespace, e.g. `atc:ratelimit:vitals:mutation`. The subject is appended. */
  prefix: string
  /** Requests permitted per window. A count equal to this is still allowed. */
  max: number
  windowSeconds: number
}

export interface RateLimitResult {
  allowed: boolean
  /** Only present when the request was blocked. */
  retryAfterSeconds?: number
  /**
   * Why the limiter failed open, when it did.
   *
   * Present only on the `allowed: true` result that a Redis failure produces —
   * an ordinary allow carries no error. It is here so a caller can log that
   * limiting is currently not happening: without it, an outage looks exactly
   * like a quiet endpoint.
   */
  error?: Error
}

/**
 * A fixed-window counter.
 *
 * Fixed rather than sliding: a sliding window needs a sorted set per subject and
 * a read-modify-write to trim it, where this is one INCR. The cost is that a
 * caller can spend a full window's budget at the end of one and again at the
 * start of the next — acceptable for the abuse this guards against, which is a
 * client hammering an endpoint rather than a precise quota.
 */
export class RateLimiter {
  constructor(
    private readonly redis: RedisClient,
    private readonly opts: RateLimiterOptions,
  ) {}

  private key(subject: string): string {
    return `${this.opts.prefix}:${subject}`
  }

  /**
   * Count one request against the subject's budget.
   *
   * **Fails open.** If Redis is unreachable the request is allowed: a rate
   * limiter that cannot reach its counter would otherwise take down every
   * endpoint behind it, which is a far worse outcome than briefly not limiting.
   */
  async check(subject: string): Promise<RateLimitResult> {
    const k = this.key(subject)
    try {
      const count = await this.redis.incr(k)

      // Only the first request in a window sets the expiry. Setting it on every
      // request would slide the window forward and let a steady caller stay
      // inside it indefinitely.
      if (count === 1) {
        await this.redis.expire(k, this.opts.windowSeconds)
      }

      if (count <= this.opts.max) return { allowed: true }

      // -1 (no expiry) and -2 (no key) both mean the TTL says nothing useful;
      // the configured window is the honest answer in either case.
      const ttl = await this.redis.ttl(k)
      return {
        allowed: false,
        retryAfterSeconds: ttl > 0 ? ttl : this.opts.windowSeconds,
      }
    } catch (err) {
      return {
        allowed: true,
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }

  /**
   * Clear a subject's counter — an admin lifting a limit, or a test.
   * Silent on failure: the counter expires on its own regardless.
   */
  async reset(subject: string): Promise<void> {
    await this.redis.del(this.key(subject)).catch(() => undefined)
  }
}
