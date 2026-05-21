import type {
  DistributedClosureRepository,
  AtcDistributedClosure,
  RegisterClosureNodeParams,
} from './distributed-closure.repository.js'
import type { CoreClosureAuditRepository } from './core-closure-audit.repository.js'
import type { CoreClosureEventBus } from './core-closure.service.js'

export class DistributedClosureOrchestrator {
  constructor(
    private readonly repo: DistributedClosureRepository,
    private readonly audit: CoreClosureAuditRepository,
    private readonly bus: CoreClosureEventBus
  ) {}

  async registerNode(params: RegisterClosureNodeParams): Promise<AtcDistributedClosure> {
    const record = await this.repo.upsert(params)
    await this.audit.append(record.id, 'closure_node.registered', { closureNodeId: record.closureNodeId })
    this.bus.emit('closure_node.registered', { closureNodeId: record.closureNodeId }).catch(() => undefined)
    return record
  }

  async syncNode(closureNodeId: string): Promise<AtcDistributedClosure> {
    const record = await this.repo.updateStatus(closureNodeId, 'syncing')
    this.bus.emit('closure_node.syncing', { closureNodeId: record.closureNodeId }).catch(() => undefined)
    return record
  }

  async completeSyncNode(closureNodeId: string): Promise<AtcDistributedClosure> {
    const record = await this.repo.updateStatus(closureNodeId, 'synced')
    await this.audit.append(record.id, 'distributed_closure_completed', { closureNodeId: record.closureNodeId })
    this.bus.emit('distributed_closure_completed', { closureNodeId: record.closureNodeId }).catch(() => undefined)
    return record
  }

  async degradeNode(closureNodeId: string): Promise<AtcDistributedClosure> {
    const record = await this.repo.updateStatus(closureNodeId, 'degraded')
    this.bus.emit('closure_node.degraded', { closureNodeId: record.closureNodeId }).catch(() => undefined)
    return record
  }

  async getNode(closureNodeId: string): Promise<AtcDistributedClosure | null> {
    return this.repo.findByNodeId(closureNodeId)
  }
}
