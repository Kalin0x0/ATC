import type { ChaosRuntimeRepository, AtcChaosRuntime, CreateChaosTestParams } from './chaos-runtime.repository.js'
import type { FailoverAuditRepository } from './failover-audit.repository.js'
import type { RuntimeResilienceEventBus } from './runtime-recovery-coordinator.js'

export class ChaosSimulationService {
  constructor(
    private chaosRepo: ChaosRuntimeRepository,
    private auditRepo: FailoverAuditRepository,
    private eventBus: RuntimeResilienceEventBus,
  ) {}

  async startTest(params: CreateChaosTestParams): Promise<AtcChaosRuntime> {
    const test = await this.chaosRepo.create(params)
    await this.auditRepo.append({ eventType: 'chaos_test_started', auditData: { testId: test.testId } })
    this.eventBus.emit('atc:resilience:chaos:started', { testId: test.testId }).catch(() => undefined)
    return test
  }

  async completeTest(id: string): Promise<AtcChaosRuntime> {
    const test = await this.chaosRepo.updateStatus(id, 'completed', new Date())
    this.eventBus.emit('atc:resilience:chaos:completed', { testId: test.testId }).catch(() => undefined)
    return test
  }

  async abortTest(id: string): Promise<AtcChaosRuntime> {
    const test = await this.chaosRepo.updateStatus(id, 'aborted')
    this.eventBus.emit('atc:resilience:chaos:aborted', { testId: test.testId }).catch(() => undefined)
    return test
  }

  async getTest(id: string): Promise<AtcChaosRuntime | null> {
    return this.chaosRepo.findById(id)
  }

  async listActiveTests(): Promise<AtcChaosRuntime[]> {
    return this.chaosRepo.listActive()
  }
}
