import type { AtcRuntimeNodeRecord, AtcRuntimeNodeStatus } from '@atc/shared-types'
import { generateInstanceId, getHostname, getPid, getNodeVersion } from './identity.js'

// Duck-typed Redis interface — satisfied by ioredis Redis without importing it
export interface RuntimeNodeRedisClient {
  hset(key: string, field: string, value: string): Promise<number>
  hgetall(key: string): Promise<Record<string, string> | null>
  hdel(key: string, ...fields: string[]): Promise<number>
  setex(key: string, seconds: number, value: string): Promise<string>
  exists(key: string): Promise<number>
  del(key: string): Promise<number>
}

const NODES_KEY = 'atc:runtime:nodes'
const HEARTBEAT_PREFIX = 'atc:runtime:heartbeat:'
const HEARTBEAT_TTL_SECONDS = 30
const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000

export class AtcRuntimeNodeService {
  readonly instanceId: string
  private readonly _record: AtcRuntimeNodeRecord
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private _registered = false

  constructor(
    private readonly _redis: RuntimeNodeRedisClient,
    opts: {
      instanceId?: string
      capabilities?: string[]
    } = {},
  ) {
    this.instanceId = opts.instanceId ?? generateInstanceId()
    this._record = {
      instanceId: this.instanceId,
      hostname: getHostname(),
      pid: getPid(),
      startedAt: new Date().toISOString(),
      capabilities: opts.capabilities ?? ['tasks', 'events', 'api'],
      version: getNodeVersion(),
    }
  }

  async register(): Promise<void> {
    try {
      await this._redis.hset(NODES_KEY, this.instanceId, JSON.stringify(this._record))
      await this._redis.setex(`${HEARTBEAT_PREFIX}${this.instanceId}`, HEARTBEAT_TTL_SECONDS, 'alive')
      this._registered = true
    } catch {
      // Fail-open: registration failure doesn't crash the process
    }
  }

  async heartbeat(): Promise<void> {
    try {
      await this._redis.setex(`${HEARTBEAT_PREFIX}${this.instanceId}`, HEARTBEAT_TTL_SECONDS, 'alive')
    } catch {
      // Fail-open
    }
  }

  async deregister(): Promise<void> {
    try {
      await this._redis.hdel(NODES_KEY, this.instanceId)
      await this._redis.del(`${HEARTBEAT_PREFIX}${this.instanceId}`)
      this._registered = false
    } catch {
      // Fail-open
    }
  }

  startHeartbeat(intervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS): void {
    if (this._heartbeatTimer !== null) return
    this._heartbeatTimer = setInterval(() => {
      void this.heartbeat()
    }, intervalMs)
  }

  stopHeartbeat(): void {
    if (this._heartbeatTimer !== null) {
      clearInterval(this._heartbeatTimer)
      this._heartbeatTimer = null
    }
  }

  async listNodes(): Promise<AtcRuntimeNodeStatus[]> {
    try {
      const raw = await this._redis.hgetall(NODES_KEY)
      if (!raw) return []

      const results: AtcRuntimeNodeStatus[] = []
      for (const [id, json] of Object.entries(raw)) {
        let record: AtcRuntimeNodeRecord
        try {
          record = JSON.parse(json) as AtcRuntimeNodeRecord
        } catch {
          continue
        }
        const heartbeatExists = await this._redis.exists(`${HEARTBEAT_PREFIX}${id}`)
        const isStale = heartbeatExists === 0
        results.push({
          ...record,
          isStale,
          lastHeartbeatAt: isStale ? null : new Date().toISOString(),
        })
      }
      return results
    } catch {
      return []
    }
  }

  getRecord(): AtcRuntimeNodeRecord {
    return { ...this._record }
  }

  get isRegistered(): boolean {
    return this._registered
  }
}
