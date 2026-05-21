export type AtcRiskLevel = 'normal' | 'elevated' | 'high' | 'critical'

export const ATC_RISK_THRESHOLDS: Record<AtcRiskLevel, number> = {
  normal: 0,
  elevated: 30,
  high: 60,
  critical: 85,
}

export interface AtcRiskEvent {
  type: string
  points: number
  description: string
  timestamp: number
}

export interface AtcSecurityRiskScore {
  identifier: string
  score: number
  level: AtcRiskLevel
  events: AtcRiskEvent[]
  lastUpdated: number
}

export interface AtcSecurityViolation {
  source: number
  identifier: string
  eventName: string
  violationType: AtcViolationType
  severity: AtcViolationSeverity
  details: Record<string, unknown>
  timestamp: number
}

export type AtcViolationType =
  | 'EVENT_NOT_WHITELISTED'
  | 'CLIENT_NOT_ALLOWED'
  | 'NO_SESSION'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SCHEMA_VALIDATION_FAILED'
  | 'COORD_MISMATCH'
  | 'ITEM_NOT_OWNED'
  | 'ECONOMY_ANOMALY'
  | 'INVENTORY_DUPE_DETECTED'

export type AtcViolationSeverity = 1 | 2 | 3

export const ATC_VIOLATION_POINTS: Record<AtcViolationType, number> = {
  EVENT_NOT_WHITELISTED: 10,
  CLIENT_NOT_ALLOWED: 10,
  NO_SESSION: 5,
  RATE_LIMIT_EXCEEDED: 3,
  SCHEMA_VALIDATION_FAILED: 15,
  COORD_MISMATCH: 20,
  ITEM_NOT_OWNED: 5,
  ECONOMY_ANOMALY: 25,
  INVENTORY_DUPE_DETECTED: 50,
}

export function getRiskLevel(score: number): AtcRiskLevel {
  if (score >= ATC_RISK_THRESHOLDS.critical) return 'critical'
  if (score >= ATC_RISK_THRESHOLDS.high) return 'high'
  if (score >= ATC_RISK_THRESHOLDS.elevated) return 'elevated'
  return 'normal'
}
