import type {
  AiReinforcementRepository,
  AtcAiReinforcement,
  CreateReinforcementParams,
} from './ai-reinforcement.repository.js'
import type { AiAuditRepository } from './ai-audit.repository.js'
import type { AiRuntimeEventBus } from './ai-runtime.service.js'

export class ReinforcementCoordinationService {
  constructor(
    private readonly reinforcementRepo: AiReinforcementRepository,
    private readonly auditRepo: AiAuditRepository,
    private readonly eventBus?: AiRuntimeEventBus,
  ) {}

  async requestReinforcement(params: CreateReinforcementParams): Promise<AtcAiReinforcement> {
    const reinforcement = await this.reinforcementRepo.create(params)
    await this.auditRepo.record(
      reinforcement.reinforcementId,
      'ai_reinforcement',
      'requested',
      undefined,
      { reinforcementType: params.reinforcementType, quantity: params.quantity ?? 1 },
    )
    this.eventBus?.emit('atc:ai:reinforcement:requested', {
      reinforcementId: reinforcement.reinforcementId,
      reinforcementType: reinforcement.reinforcementType,
    }).catch(() => undefined)
    return reinforcement
  }

  async dispatchReinforcement(reinforcementId: string): Promise<AtcAiReinforcement> {
    const reinforcement = await this.reinforcementRepo.transition(reinforcementId, 'dispatched')
    await this.auditRepo.record(reinforcementId, 'ai_reinforcement', 'dispatched')
    return reinforcement
  }

  async arriveReinforcement(reinforcementId: string): Promise<AtcAiReinforcement> {
    const reinforcement = await this.reinforcementRepo.transition(reinforcementId, 'arrived')
    await this.auditRepo.record(reinforcementId, 'ai_reinforcement', 'arrived')
    return reinforcement
  }

  async withdrawReinforcement(reinforcementId: string): Promise<AtcAiReinforcement> {
    const reinforcement = await this.reinforcementRepo.transition(reinforcementId, 'withdrawn')
    await this.auditRepo.record(reinforcementId, 'ai_reinforcement', 'withdrawn')
    return reinforcement
  }

  async cancelReinforcement(reinforcementId: string): Promise<AtcAiReinforcement> {
    const reinforcement = await this.reinforcementRepo.transition(reinforcementId, 'cancelled')
    await this.auditRepo.record(reinforcementId, 'ai_reinforcement', 'cancelled')
    return reinforcement
  }
}
