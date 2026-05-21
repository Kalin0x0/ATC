import type { RuntimeHardeningRepository } from './runtime-hardening.repository.js'
import type { ImmutableSecurityRepository } from './immutable-security.repository.js'
import type { SecurityValidationRepository } from './security-validation.repository.js'
import type { SealValidationRepository } from './seal-validation.repository.js'
import type { ThreatMitigationRepository } from './threat-mitigation.repository.js'
import type { HardeningAuditRepository } from './hardening-audit.repository.js'
import type { RuntimeHardeningEventBus } from './runtime-hardening.service.js'

export interface HardeningCleanupResult {
  hardenings: number
  securities: number
  validations: number
  sealValidations: number
  mitigations: number
}

export class HardeningRecoveryService {
  constructor(
    private readonly hardeningRepo: RuntimeHardeningRepository,
    private readonly securityRepo: ImmutableSecurityRepository,
    private readonly validationRepo: SecurityValidationRepository,
    private readonly sealValidationRepo: SealValidationRepository,
    private readonly mitigationRepo: ThreatMitigationRepository,
    private readonly audit: HardeningAuditRepository,
    private readonly bus: RuntimeHardeningEventBus
  ) {}

  async cleanupStale(thresholdMs: number): Promise<HardeningCleanupResult> {
    const [hardenings, securities, validations, sealValidations, mitigations] = await Promise.all([
      this.hardeningRepo.cleanupStale(thresholdMs),
      this.securityRepo.cleanupStale(thresholdMs),
      this.validationRepo.cleanupStale(thresholdMs),
      this.sealValidationRepo.cleanupStale(thresholdMs),
      this.mitigationRepo.cleanupStale(thresholdMs),
    ])
    this.bus.emit('hardening.stale_cleaned', { hardenings, securities, validations, sealValidations, mitigations }).catch(() => undefined)
    return { hardenings, securities, validations, sealValidations, mitigations }
  }
}
