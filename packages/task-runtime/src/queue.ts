import type { AtcTask } from '@atc/shared-types'
import { TaskPayloadTooLargeError, TaskPayloadInvalidError, TaskQueueOverloadedError } from './errors.js'

// Max serialized task size: 512 KB
const MAX_TASK_BYTES = 512 * 1024
// Max queue depth before rejecting new tasks (per queue)
export const DEFAULT_MAX_QUEUE_DEPTH = 10_000

// Injectable storage interface — Redis or in-memory for testing
export interface TaskQueueStorage {
  push(queueName: string, data: string): Promise<void>
  pop(queueName: string): Promise<string | null>
  len(queueName: string): Promise<number>
  pushToDeadLetter(data: string): Promise<void>
  lenDeadLetter(): Promise<number>
  peekDeadLetter(offset?: number, limit?: number): Promise<string[]>
  removeDeadLetterItem(raw: string): Promise<boolean>
  addDelayed(score: number, data: string): Promise<void>
  popReadyDelayed(now: number, limit?: number): Promise<string[]>
  lenDelayed(): Promise<number>
  getAllQueueNames(): string[]
}

export class InMemoryTaskQueueStorage implements TaskQueueStorage {
  private readonly _queues = new Map<string, string[]>()
  private readonly _dlq: string[] = []
  private readonly _delayed: Array<{ score: number; data: string }> = []

  async push(queueName: string, data: string): Promise<void> {
    const q = this._queues.get(queueName) ?? []
    q.push(data)
    this._queues.set(queueName, q)
  }

  async pop(queueName: string): Promise<string | null> {
    const q = this._queues.get(queueName)
    if (!q || q.length === 0) return null
    return q.shift() ?? null
  }

  async len(queueName: string): Promise<number> {
    return this._queues.get(queueName)?.length ?? 0
  }

  async pushToDeadLetter(data: string): Promise<void> {
    this._dlq.push(data)
  }

  async lenDeadLetter(): Promise<number> {
    return this._dlq.length
  }

  async peekDeadLetter(offset = 0, limit = 20): Promise<string[]> {
    return this._dlq.slice(offset, offset + limit)
  }

  async removeDeadLetterItem(raw: string): Promise<boolean> {
    const idx = this._dlq.indexOf(raw)
    if (idx === -1) return false
    this._dlq.splice(idx, 1)
    return true
  }

  async addDelayed(score: number, data: string): Promise<void> {
    this._delayed.push({ score, data })
    this._delayed.sort((a, b) => a.score - b.score)
  }

  async popReadyDelayed(now: number, limit = 100): Promise<string[]> {
    const ready: string[] = []
    while (this._delayed.length > 0 && (this._delayed[0]?.score ?? Infinity) <= now && ready.length < limit) {
      const item = this._delayed.shift()
      if (item) ready.push(item.data)
    }
    return ready
  }

  async lenDelayed(): Promise<number> {
    return this._delayed.length
  }

  getAllQueueNames(): string[] {
    return Array.from(this._queues.keys())
  }
}

export class RedisTaskQueueStorage implements TaskQueueStorage {
  private readonly _seenQueues = new Set<string>()
  private readonly _dlqKey = 'atc:tasks:dlq'
  private readonly _delayedKey = 'atc:tasks:delayed'

  constructor(
    private readonly _redis: {
      lpush(key: string, value: string): Promise<number>
      rpop(key: string): Promise<string | null>
      llen(key: string): Promise<number>
      lrange(key: string, start: number, stop: number): Promise<string[]>
      lrem(key: string, count: number, element: string): Promise<number>
      zadd(key: string, score: number, member: string): Promise<number>
      zrangebyscore(key: string, min: number, max: number, limitToken: 'LIMIT', offset: number, count: number): Promise<string[]>
      zrem(key: string, ...members: string[]): Promise<number>
      zcard(key: string): Promise<number>
    },
  ) {}

  async push(queueName: string, data: string): Promise<void> {
    this._seenQueues.add(queueName)
    await this._redis.lpush(queueName, data)
  }

  async pop(queueName: string): Promise<string | null> {
    return this._redis.rpop(queueName)
  }

  async len(queueName: string): Promise<number> {
    return this._redis.llen(queueName)
  }

  async pushToDeadLetter(data: string): Promise<void> {
    await this._redis.lpush(this._dlqKey, data)
  }

  async lenDeadLetter(): Promise<number> {
    return this._redis.llen(this._dlqKey)
  }

  async peekDeadLetter(offset = 0, limit = 20): Promise<string[]> {
    return this._redis.lrange(this._dlqKey, offset, offset + limit - 1)
  }

  async removeDeadLetterItem(raw: string): Promise<boolean> {
    const removed = await this._redis.lrem(this._dlqKey, 1, raw)
    return removed > 0
  }

  async addDelayed(score: number, data: string): Promise<void> {
    await this._redis.zadd(this._delayedKey, score, data)
  }

  async popReadyDelayed(now: number, limit = 100): Promise<string[]> {
    const items = await this._redis.zrangebyscore(
      this._delayedKey,
      0,
      now,
      'LIMIT',
      0,
      limit,
    )
    if (items.length > 0) {
      await this._redis.zrem(this._delayedKey, ...items)
    }
    return items
  }

  async lenDelayed(): Promise<number> {
    return this._redis.zcard(this._delayedKey)
  }

  getAllQueueNames(): string[] {
    return Array.from(this._seenQueues)
  }
}

export class AtcTaskQueue {
  constructor(
    private readonly _storage: TaskQueueStorage,
    private readonly _maxDepth: number = DEFAULT_MAX_QUEUE_DEPTH,
  ) {}

  async enqueue(task: AtcTask): Promise<void> {
    const depth = await this._storage.len(task.queueName)
    if (depth >= this._maxDepth) {
      throw new TaskQueueOverloadedError(task.queueName, depth, this._maxDepth)
    }

    const serialized = this._serialize(task)
    await this._storage.push(task.queueName, serialized)
  }

  async scheduleDelayed(task: AtcTask): Promise<void> {
    if (!task.scheduledAt) return
    const score = new Date(task.scheduledAt).getTime()
    const serialized = this._serialize(task)
    await this._storage.addDelayed(score, serialized)
  }

  async dequeue(queueName: string): Promise<AtcTask | null> {
    const raw = await this._storage.pop(queueName)
    if (!raw) return null
    try {
      return this._deserialize(raw)
    } catch {
      // Malformed task in active queue — dead-letter to prevent silent data loss
      await this._storage.pushToDeadLetter(raw).catch(() => undefined)
      return null
    }
  }

  async promoteReady(): Promise<AtcTask[]> {
    const now = Date.now()
    const items = await this._storage.popReadyDelayed(now)
    const tasks: AtcTask[] = []
    for (const item of items) {
      try {
        const task = this._deserialize(item)
        if (task) {
          await this._storage.push(task.queueName, this._serialize(task))
          tasks.push(task)
        }
      } catch {
        // Malformed delayed item — dead-letter rather than losing it permanently
        await this._storage.pushToDeadLetter(item).catch(() => undefined)
      }
    }
    return tasks
  }

  async sendToDeadLetter(task: AtcTask): Promise<void> {
    await this._storage.pushToDeadLetter(this._serialize(task))
  }

  async getDepth(queueName: string): Promise<number> {
    return this._storage.len(queueName)
  }

  async getDeadLetterSize(): Promise<number> {
    return this._storage.lenDeadLetter()
  }

  async listDeadLetter(limit = 20, offset = 0): Promise<{ items: AtcTask[]; total: number; offset: number; limit: number }> {
    const [raws, total] = await Promise.all([
      this._storage.peekDeadLetter(offset, limit),
      this._storage.lenDeadLetter(),
    ])
    const items: AtcTask[] = []
    for (const raw of raws) {
      try {
        const task = this._deserialize(raw)
        if (task) items.push(task)
      } catch {
        // Skip unparseable entries — they remain in the DLQ untouched
      }
    }
    return { items, total, offset, limit }
  }

  async requeueFromDeadLetter(taskId: string): Promise<boolean> {
    const raws = await this._storage.peekDeadLetter(0, 1000)
    for (const raw of raws) {
      let task: AtcTask | null = null
      try { task = this._deserialize(raw) } catch { continue }
      if (!task || task.id !== taskId) continue
      const removed = await this._storage.removeDeadLetterItem(raw)
      if (!removed) return false
      task = { ...task, state: 'queued', retryCount: (task.retryCount ?? 0) }
      await this._storage.push(task.queueName, this._serialize(task))
      return true
    }
    return false
  }

  async getDelayedCount(): Promise<number> {
    return this._storage.lenDelayed()
  }

  getAllQueueNames(): string[] {
    return this._storage.getAllQueueNames()
  }

  private _serialize(task: AtcTask): string {
    const json = JSON.stringify(task)
    if (json.length > MAX_TASK_BYTES) {
      throw new TaskPayloadTooLargeError(json.length, MAX_TASK_BYTES)
    }
    return json
  }

  private _deserialize(raw: string): AtcTask | null {
    try {
      const parsed = JSON.parse(raw) as AtcTask
      if (!parsed.id || !parsed.type || !parsed.state) {
        throw new Error('Missing required fields')
      }
      return parsed
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new TaskPayloadInvalidError(`Malformed task JSON: ${msg}`)
    }
  }
}
