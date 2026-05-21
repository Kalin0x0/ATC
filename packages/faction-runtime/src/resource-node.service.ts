import type { AtcEventBus } from '@atc/events'
import type { FactionPool } from './pool.js'
import { ResourceNodeRepository, type AtcResourceNode } from './resource-node.repository.js'
import { FactionRepository } from './faction.repository.js'
import { ResourceNodeNotFoundError, FactionNotFoundError } from './errors.js'

export class ResourceNodeService {
  private readonly resourceNodeRepo: ResourceNodeRepository
  private readonly factionRepo: FactionRepository

  constructor(
    private readonly pool: FactionPool,
    private readonly eventBus: AtcEventBus,
  ) {
    this.resourceNodeRepo = new ResourceNodeRepository(pool)
    this.factionRepo = new FactionRepository(pool)
  }

  async captureNode(nodeId: string, factionId: string, _capturedByPrincipalId: string): Promise<AtcResourceNode> {
    const node = await this.resourceNodeRepo.findByNodeId(nodeId)
    if (!node) throw new ResourceNodeNotFoundError(nodeId)

    const faction = await this.factionRepo.findById(factionId)
    if (!faction) throw new FactionNotFoundError(factionId)

    const captured = await this.resourceNodeRepo.capture(node.id, factionId)

    this.eventBus.emit('atc:faction:resource:captured', {
      nodeId: node.id,
      factionId,
    }).catch(() => undefined)

    return captured
  }

  async releaseNode(nodeId: string): Promise<void> {
    const node = await this.resourceNodeRepo.findByNodeId(nodeId)
    if (!node) throw new ResourceNodeNotFoundError(nodeId)

    const previousFactionId = node.controllingFactionId
    await this.resourceNodeRepo.release(node.id)

    this.eventBus.emit('atc:faction:resource:released', {
      nodeId: node.id,
      factionId: previousFactionId,
    }).catch(() => undefined)
  }

  async getNodesByFaction(factionId: string): Promise<AtcResourceNode[]> {
    return this.resourceNodeRepo.listByFaction(factionId)
  }
}
