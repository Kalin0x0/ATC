import type { FailureCorrelationRepository, AtcFailureCorrelation, CreateCorrelationParams } from './failure-correlation.repository.js'
import type { ObservabilityAuditRepository } from './observability-audit.repository.js'
import type { RuntimeObservabilityEventBus } from './trace-recovery.service.js'

export class FailureCorrelationService {
  constructor(
    private correlationRepo: FailureCorrelationRepository,
    private auditRepo: ObservabilityAuditRepository,
    private eventBus: RuntimeObservabilityEventBus,
  ) {}

  async createCorrelation(params: CreateCorrelationParams): Promise<AtcFailureCorrelation> {
    const correlation = await this.correlationRepo.create(params)
    await this.auditRepo.append({ eventType: 'correlation_created', auditData: { correlationId: correlation.correlationId } })
    this.eventBus.emit('atc:observability:correlation:created', { correlationId: correlation.correlationId }).catch(() => undefined)
    return correlation
  }

  async resolveCorrelation(id: string): Promise<AtcFailureCorrelation> {
    const correlation = await this.correlationRepo.resolve(id)
    await this.auditRepo.append({ eventType: 'correlation_resolved', auditData: { correlationId: correlation.correlationId } })
    this.eventBus.emit('atc:observability:correlation:resolved', { correlationId: correlation.correlationId }).catch(() => undefined)
    return correlation
  }

  async getCorrelation(id: string): Promise<AtcFailureCorrelation | null> {
    return this.correlationRepo.findById(id)
  }

  async listOpenCorrelations(ownerServerId?: string): Promise<AtcFailureCorrelation[]> {
    return this.correlationRepo.listOpen(ownerServerId)
  }
}
