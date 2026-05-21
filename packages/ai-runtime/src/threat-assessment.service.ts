import type {
  AiThreatAssessmentRepository,
  AtcAiThreatAssessment,
  AtcThreatLevel,
  UpsertThreatAssessmentParams,
} from './ai-threat-assessment.repository.js'
import type { AiAuditRepository } from './ai-audit.repository.js'
import type { AiRuntimeEventBus } from './ai-runtime.service.js'
import { ThreatAssessmentNotFoundError } from './errors.js'

export class ThreatAssessmentService {
  constructor(
    private readonly threatRepo: AiThreatAssessmentRepository,
    private readonly auditRepo: AiAuditRepository,
    private readonly eventBus?: AiRuntimeEventBus,
  ) {}

  async assessThreat(params: UpsertThreatAssessmentParams): Promise<AtcAiThreatAssessment> {
    const assessment = await this.threatRepo.upsert(params)
    await this.auditRepo.record(
      assessment.assessmentId,
      'ai_threat',
      'assessed',
      undefined,
      { entityId: params.entityId, threatLevel: params.threatLevel, threatType: params.threatType },
    )
    return assessment
  }

  async updateThreat(assessmentId: string, threatLevel: AtcThreatLevel): Promise<AtcAiThreatAssessment> {
    const existing = await this.threatRepo.findById(assessmentId)
    if (!existing) {
      throw new ThreatAssessmentNotFoundError(assessmentId)
    }
    const updated = await this.threatRepo.upsert({
      assessmentId: existing.assessmentId,
      entityId: existing.entityId,
      threatLevel,
      threatType: existing.threatType,
      assessmentData: existing.assessmentData,
      ...(existing.threatSourceId !== null ? { threatSourceId: existing.threatSourceId } : {}),
      ...(existing.expiresAt !== null ? { expiresAt: existing.expiresAt } : {}),
    })
    await this.auditRepo.record(
      assessmentId,
      'ai_threat',
      'updated',
      undefined,
      { threatLevel },
    )
    return updated
  }

  async clearThreat(assessmentId: string): Promise<void> {
    await this.threatRepo.deleteById(assessmentId)
    await this.auditRepo.record(assessmentId, 'ai_threat', 'cleared')
  }

  async expireStaleAssessments(): Promise<number> {
    return this.threatRepo.expireStale()
  }

  async listActiveThreats(): Promise<AtcAiThreatAssessment[]> {
    return this.threatRepo.listActive()
  }
}
