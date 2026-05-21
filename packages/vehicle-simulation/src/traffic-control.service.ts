import type { AtcEventBus } from '@atc/events'
import type {
  TrafficViolationRepository,
  AtcTrafficViolation,
  RecordViolationParams,
} from './traffic-violation.repository.js'

export interface TrafficControlDeps {
  violationRepo: TrafficViolationRepository
  eventBus: AtcEventBus | undefined
}

export class TrafficControlService {
  private readonly violationRepo: TrafficViolationRepository
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: TrafficControlDeps) {
    this.violationRepo = deps.violationRepo
    this.eventBus      = deps.eventBus
  }

  async recordViolation(params: RecordViolationParams): Promise<AtcTrafficViolation> {
    return this.violationRepo.record(params)
  }

  async markViolationPaid(violationId: string): Promise<AtcTrafficViolation> {
    return this.violationRepo.markPaid(violationId)
  }

  async getUnpaidViolations(principalId: string): Promise<AtcTrafficViolation[]> {
    return this.violationRepo.listUnpaidByPrincipal(principalId)
  }

  async getViolationHistory(principalId: string, limit: number): Promise<AtcTrafficViolation[]> {
    return this.violationRepo.listByPrincipal(principalId, limit)
  }
}
