import type { RuntimeCertificationRepository } from './runtime-certification.repository.js'
import type { DeterministicValidationRepository } from './deterministic-validation.repository.js'
import type { RuntimeComplianceRepository } from './runtime-compliance.repository.js'
import type { VerificationRuntimeRepository } from './verification-runtime.repository.js'
import type { ComplianceCoordinationRepository } from './compliance-coordination.repository.js'
import type { CertificationAuditRepository } from './certification-audit.repository.js'

export interface RuntimeCertificationEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export interface CertificationCleanupResult {
  certifications: number
  validations: number
  compliances: number
  verifications: number
  coordinations: number
}

export class CertificationRecoveryService {
  constructor(
    private certRepo: RuntimeCertificationRepository,
    private validationRepo: DeterministicValidationRepository,
    private complianceRepo: RuntimeComplianceRepository,
    private verificationRepo: VerificationRuntimeRepository,
    private coordinationRepo: ComplianceCoordinationRepository,
    private auditRepo: CertificationAuditRepository,
    private eventBus: RuntimeCertificationEventBus,
  ) {}

  async cleanupStale(thresholdMs: number): Promise<CertificationCleanupResult> {
    const [certifications, validations, compliances, verifications, coordinations] = await Promise.all([
      this.certRepo.cleanupStale(thresholdMs),
      this.validationRepo.cleanupStale(thresholdMs),
      this.complianceRepo.cleanupStale(thresholdMs),
      this.verificationRepo.cleanupStale(thresholdMs),
      this.coordinationRepo.cleanupStale(thresholdMs),
    ])

    await this.auditRepo.append({
      eventType: 'stale_cleanup',
      auditData: { certifications, validations, compliances, verifications, coordinations, thresholdMs },
    })

    this.eventBus.emit('atc:certification:stale:cleaned', {
      certifications,
      validations,
      compliances,
      verifications,
      coordinations,
    }).catch(() => undefined)

    return { certifications, validations, compliances, verifications, coordinations }
  }
}
