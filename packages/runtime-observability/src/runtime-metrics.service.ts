import type { RuntimeMetricsRepository, AtcRuntimeMetric, RecordMetricParams } from './runtime-metrics.repository.js'
import type { ObservabilityAuditRepository } from './observability-audit.repository.js'
import type { RuntimeObservabilityEventBus } from './trace-recovery.service.js'

export class RuntimeMetricsService {
  constructor(
    private metricsRepo: RuntimeMetricsRepository,
    private auditRepo: ObservabilityAuditRepository,
    private eventBus: RuntimeObservabilityEventBus,
  ) {}

  async recordMetric(params: RecordMetricParams): Promise<AtcRuntimeMetric> {
    const metric = await this.metricsRepo.record(params)
    this.eventBus.emit('atc:observability:metric:recorded', { metricId: metric.metricId, metricType: metric.metricType }).catch(() => undefined)
    return metric
  }

  async getMetrics(entityId: string): Promise<AtcRuntimeMetric[]> {
    return this.metricsRepo.listByEntity(entityId)
  }
}
