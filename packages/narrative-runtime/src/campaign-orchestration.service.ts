import type { CampaignRuntimeRepository, AtcCampaignRecord, CreateCampaignParams } from './campaign-runtime.repository.js'
import type { StoryProgressionRepository } from './story-progression.repository.js'
import type { NarrativeAuditRepository } from './narrative-audit.repository.js'
import type { NarrativeEventBus } from './narrative-runtime.service.js'

export class CampaignOrchestrationService {
  constructor(
    private campaignRepo: CampaignRuntimeRepository,
    private progressionRepo: StoryProgressionRepository,
    private auditRepo: NarrativeAuditRepository,
    private eventBus: NarrativeEventBus,
  ) {}

  async startCampaign(params: CreateCampaignParams): Promise<AtcCampaignRecord> {
    const campaign = await this.campaignRepo.create(params)
    await this.auditRepo.append({ eventType: 'campaign_started' })
    this.eventBus.emit('atc:narrative:campaign:started', { campaignId: campaign.campaignId }).catch(() => undefined)
    return campaign
  }

  async getCampaign(id: string): Promise<AtcCampaignRecord | null> {
    return this.campaignRepo.findById(id)
  }

  async completeCampaign(id: string): Promise<AtcCampaignRecord> {
    const campaign = await this.campaignRepo.updateStatus(id, 'completed', new Date())
    await this.auditRepo.append({ eventType: 'campaign_completed' })
    this.eventBus.emit('atc:narrative:campaign:completed', { campaignId: campaign.campaignId }).catch(() => undefined)
    return campaign
  }

  async failCampaign(id: string): Promise<AtcCampaignRecord> {
    const campaign = await this.campaignRepo.updateStatus(id, 'failed')
    this.eventBus.emit('atc:narrative:campaign:failed', { campaignId: campaign.campaignId }).catch(() => undefined)
    return campaign
  }

  async listActiveCampaigns(ownerServerId?: string): Promise<AtcCampaignRecord[]> {
    return this.campaignRepo.listActive(ownerServerId)
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    return this.campaignRepo.cleanupStale(thresholdMs)
  }
}
