import type {
  AtcSecurityRiskScore,
  AtcSecurityViolation,
  AtcViolationType,
} from '@atc/shared-types'
import {
  ATC_VIOLATION_POINTS,
  getRiskLevel,
} from '@atc/shared-types'
import { AtcNotImplementedError } from './errors.js'

export class AtcSecuritySDK {
  getRiskScore(_identifier: string): Promise<AtcSecurityRiskScore> {
    throw new AtcNotImplementedError('AtcSecuritySDK.getRiskScore')
  }

  reportViolation(_violation: AtcSecurityViolation): Promise<void> {
    throw new AtcNotImplementedError('AtcSecuritySDK.reportViolation')
  }

  checkBan(_identifier: string): Promise<{ isBanned: boolean; reason?: string; expiresAt?: Date }> {
    throw new AtcNotImplementedError('AtcSecuritySDK.checkBan')
  }
}

export interface RiskScoreUpdate {
  identifier: string
  violationType: AtcViolationType
  customPoints?: number
}

export function calculateRiskPoints(violationType: AtcViolationType, customPoints?: number): number {
  return customPoints ?? ATC_VIOLATION_POINTS[violationType]
}

export function buildRiskScore(
  identifier: string,
  events: Array<{ type: AtcViolationType; points: number; description: string; timestamp: number }>
): AtcSecurityRiskScore {
  const totalScore = events.reduce((sum, e) => sum + e.points, 0)
  return {
    identifier,
    score: totalScore,
    level: getRiskLevel(totalScore),
    events,
    lastUpdated: Date.now(),
  }
}
