import type { RuntimeDiagnosticsRepository, AtcRuntimeDiagnostic, CreateDiagnosticParams } from './runtime-diagnostics.repository.js'
import type { ObservabilityAuditRepository } from './observability-audit.repository.js'
import type { RuntimeObservabilityEventBus } from './trace-recovery.service.js'

export class RuntimeDiagnosticsService {
  constructor(
    private diagnosticsRepo: RuntimeDiagnosticsRepository,
    private auditRepo: ObservabilityAuditRepository,
    private eventBus: RuntimeObservabilityEventBus,
  ) {}

  async runDiagnostic(params: CreateDiagnosticParams): Promise<AtcRuntimeDiagnostic> {
    const diagnostic = await this.diagnosticsRepo.create(params)
    await this.auditRepo.append({ eventType: 'diagnostic_started', auditData: { diagnosticId: diagnostic.diagnosticId } })
    this.eventBus.emit('atc:observability:diagnostic:started', { diagnosticId: diagnostic.diagnosticId }).catch(() => undefined)
    return diagnostic
  }

  async completeDiagnostic(id: string): Promise<AtcRuntimeDiagnostic> {
    const diagnostic = await this.diagnosticsRepo.updateStatus(id, 'passed', new Date())
    await this.auditRepo.append({ eventType: 'diagnostic_passed', auditData: { diagnosticId: diagnostic.diagnosticId } })
    this.eventBus.emit('atc:observability:diagnostic:passed', { diagnosticId: diagnostic.diagnosticId }).catch(() => undefined)
    return diagnostic
  }

  async failDiagnostic(id: string): Promise<AtcRuntimeDiagnostic> {
    const diagnostic = await this.diagnosticsRepo.updateStatus(id, 'failed', new Date())
    this.eventBus.emit('atc:observability:diagnostic:failed', { diagnosticId: diagnostic.diagnosticId }).catch(() => undefined)
    return diagnostic
  }

  async getDiagnostics(entityId: string): Promise<AtcRuntimeDiagnostic[]> {
    return this.diagnosticsRepo.listByEntity(entityId)
  }
}
