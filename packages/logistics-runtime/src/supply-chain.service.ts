import type { AtcEventBus } from '@atc/events'
import type { SupplyChainRepository } from './supply-chain.repository.js'
import type { AtcSupplyChain } from './supply-chain.repository.js'
import { SupplyChainNotFoundError } from './errors.js'

export class SupplyChainService {
  constructor(
    private readonly chainRepo: SupplyChainRepository,
    private readonly eventBus: AtcEventBus,
  ) {}

  async upsertChain(params: {
    chainId: string
    chainName: string
    nodes: string[]
    edges: Array<{ from: string; to: string }>
  }): Promise<AtcSupplyChain> {
    const chain = await this.chainRepo.upsert(params)
    this.eventBus.emit('atc:logistics:chain:upserted', { chainId: chain.chainId }).catch(() => undefined)
    return chain
  }

  async getChain(chainId: string): Promise<AtcSupplyChain | null> {
    return this.chainRepo.findByChainId(chainId)
  }

  async disruptChain(chainId: string): Promise<AtcSupplyChain> {
    const chain = await this.chainRepo.findByChainId(chainId)
    if (!chain) throw new SupplyChainNotFoundError(chainId)
    const updated = await this.chainRepo.updateStatus(chainId, 'disrupted')
    this.eventBus.emit('atc:logistics:chain:disrupted', { chainId }).catch(() => undefined)
    return updated
  }

  async restoreChain(chainId: string): Promise<AtcSupplyChain> {
    const chain = await this.chainRepo.findByChainId(chainId)
    if (!chain) throw new SupplyChainNotFoundError(chainId)
    const updated = await this.chainRepo.updateStatus(chainId, 'active')
    this.eventBus.emit('atc:logistics:chain:restored', { chainId }).catch(() => undefined)
    return updated
  }
}
