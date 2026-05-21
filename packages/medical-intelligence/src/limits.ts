export const MEDICAL_INTEL_LIMITS = {
  MAX_LIMIT: 100,
  DEFAULT_LIMIT: 20,
  MAX_TIMELINE_WINDOW_DAYS: 365,
  MAX_ANALYTICS_WINDOW_DAYS: 365,
  MAX_BATCH: 200,
} as const

export const MEDICAL_SEVERITY_WEIGHTS = {
  minor: 1,
  moderate: 3,
  critical: 7,
  fatal: 12,
} as const
