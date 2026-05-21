export class TaskNotFoundError extends Error {
  readonly taskId: string
  constructor(taskId: string) {
    super(`Task not found: ${taskId}`)
    this.name = 'TaskNotFoundError'
    this.taskId = taskId
  }
}

export class TaskAlreadyCancelledError extends Error {
  readonly taskId: string
  constructor(taskId: string) {
    super(`Task already cancelled: ${taskId}`)
    this.name = 'TaskAlreadyCancelledError'
    this.taskId = taskId
  }
}

export class TaskPayloadTooLargeError extends Error {
  constructor(size: number, limit: number) {
    super(`Task payload too large: ${size} bytes (limit ${limit})`)
    this.name = 'TaskPayloadTooLargeError'
  }
}

export class TaskPayloadInvalidError extends Error {
  constructor(reason: string) {
    super(`Task payload invalid: ${reason}`)
    this.name = 'TaskPayloadInvalidError'
  }
}

export class TaskTypeInvalidError extends Error {
  constructor(type: string) {
    super(`Task type invalid: ${type}`)
    this.name = 'TaskTypeInvalidError'
  }
}

export class WorkerNotFoundError extends Error {
  readonly workerId: string
  constructor(workerId: string) {
    super(`Worker not found: ${workerId}`)
    this.name = 'WorkerNotFoundError'
    this.workerId = workerId
  }
}

export class TaskQueueOverloadedError extends Error {
  readonly queueName: string
  constructor(queueName: string, depth: number, limit: number) {
    super(`Queue '${queueName}' is overloaded: depth=${depth}, limit=${limit}`)
    this.name = 'TaskQueueOverloadedError'
    this.queueName = queueName
  }
}

export class TaskTimeoutError extends Error {
  readonly taskId: string
  constructor(taskId: string, timeoutMs: number) {
    super(`Task timed out after ${timeoutMs}ms: ${taskId}`)
    this.name = 'TaskTimeoutError'
    this.taskId = taskId
  }
}
