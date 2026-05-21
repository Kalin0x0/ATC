import type { AtcEventBus } from '@atc/events'
import type { ProductionJobRepository } from './production-job.repository.js'
import type { ManufacturingQueueRepository } from './manufacturing-queue.repository.js'
import type { CraftingRecipeRepository } from './crafting-recipe.repository.js'
import type { CraftingAuditRepository } from './crafting-audit.repository.js'
import type { AtcProductionJob } from './production-job.repository.js'
import {
  ManufacturingQueueNotFoundError,
  ManufacturingQueueOfflineError,
  ProductionJobAlreadyActiveError,
  ProductionJobNotFoundError,
  ProductionJobNotActiveError,
  RecipeNotFoundError,
} from './errors.js'

export interface StartJobParams {
  queueId: string
  recipeId: string
  initiatedByPrincipalId: string
  quantityOrdered: number
  jobNonce: string
}

export class ProductionJobService {
  constructor(
    private readonly jobRepo: ProductionJobRepository,
    private readonly queueRepo: ManufacturingQueueRepository,
    private readonly recipeRepo: CraftingRecipeRepository,
    private readonly auditRepo: CraftingAuditRepository,
    private readonly eventBus: AtcEventBus,
  ) {}

  async startJob(params: StartJobParams): Promise<AtcProductionJob> {
    const queue = await this.queueRepo.findByStationId(params.queueId)
    if (!queue) throw new ManufacturingQueueNotFoundError(params.queueId)
    if (queue.status === 'offline') throw new ManufacturingQueueOfflineError(params.queueId)

    const activeJob = await this.jobRepo.findActiveByQueue(queue.queueId)
    if (activeJob) throw new ProductionJobAlreadyActiveError(params.queueId)

    const recipe = await this.recipeRepo.findByRecipeId(params.recipeId)
    if (!recipe) throw new RecipeNotFoundError(params.recipeId)

    const job = await this.jobRepo.create({
      queueId: queue.queueId,
      recipeId: params.recipeId,
      initiatedByPrincipalId: params.initiatedByPrincipalId,
      quantityOrdered: params.quantityOrdered,
      jobNonce: params.jobNonce,
    })

    await this.auditRepo.record(job.jobId, 'started', params.initiatedByPrincipalId)
    this.eventBus
      .emit('atc:crafting:job:started', {
        jobId: job.jobId,
        recipeId: params.recipeId,
        queueId: queue.queueId,
      })
      .catch(() => undefined)

    return job
  }

  async completeJob(jobId: string, quantityProduced: number): Promise<AtcProductionJob> {
    const job = await this.jobRepo.findById(jobId)
    if (!job) throw new ProductionJobNotFoundError(jobId)
    if (job.status !== 'in_progress' && job.status !== 'pending') {
      throw new ProductionJobNotActiveError(jobId)
    }

    const updated = await this.jobRepo.transition(jobId, 'completed', { quantityProduced })
    await this.auditRepo.record(jobId, 'completed')
    this.eventBus.emit('atc:crafting:job:completed', { jobId, quantityProduced }).catch(() => undefined)
    return updated
  }

  async failJob(jobId: string, reason: string): Promise<AtcProductionJob> {
    const job = await this.jobRepo.findById(jobId)
    if (!job) throw new ProductionJobNotFoundError(jobId)
    if (job.status !== 'in_progress' && job.status !== 'pending') {
      throw new ProductionJobNotActiveError(jobId)
    }

    const updated = await this.jobRepo.transition(jobId, 'failed', { failedReason: reason })
    await this.auditRepo.record(jobId, 'failed', undefined, reason)
    this.eventBus.emit('atc:crafting:job:failed', { jobId, reason }).catch(() => undefined)
    return updated
  }

  async cancelJob(jobId: string, cancelledBy: string): Promise<AtcProductionJob> {
    const job = await this.jobRepo.findById(jobId)
    if (!job) throw new ProductionJobNotFoundError(jobId)
    if (job.status !== 'in_progress' && job.status !== 'pending') {
      throw new ProductionJobNotActiveError(jobId)
    }

    const updated = await this.jobRepo.transition(jobId, 'cancelled')
    await this.auditRepo.record(jobId, 'cancelled', cancelledBy)
    this.eventBus.emit('atc:crafting:job:cancelled', { jobId, cancelledBy }).catch(() => undefined)
    return updated
  }

  async getJob(jobId: string): Promise<AtcProductionJob | null> {
    return this.jobRepo.findById(jobId)
  }

  async listActiveJobs(stationId: string): Promise<AtcProductionJob[]> {
    const queue = await this.queueRepo.findByStationId(stationId)
    if (!queue) return []
    return this.jobRepo.listByQueue(queue.queueId)
  }
}
