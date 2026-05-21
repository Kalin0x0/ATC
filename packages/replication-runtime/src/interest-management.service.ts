import type { InterestRegionRepository } from './interest-region.repository.js'
import type {
  AtcInterestRegion,
  UpsertInterestRegionParams,
} from './interest-region.repository.js'
import type { ReplicationAuditRepository } from './replication-audit.repository.js'

export class InterestManagementService {
  constructor(
    private readonly regionRepo: InterestRegionRepository,
    private readonly auditRepo: ReplicationAuditRepository
  ) {}

  async registerRegion(params: UpsertInterestRegionParams): Promise<AtcInterestRegion> {
    const region = await this.regionRepo.upsert(params)
    await this.auditRepo.record(
      params.regionId,
      'region.registered',
      params.ownerServerId,
      {
        regionType: params.regionType,
      }
    )
    return region
  }

  async listRegions(): Promise<AtcInterestRegion[]> {
    return this.regionRepo.listActive()
  }

  async deactivateRegion(regionId: string): Promise<void> {
    await this.regionRepo.deactivate(regionId)
    await this.auditRepo.record(regionId, 'region.deactivated')
  }
}
