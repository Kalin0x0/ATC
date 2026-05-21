export type AtcTelemetryMetricKind = 'counter' | 'gauge' | 'histogram'

export interface AtcTelemetryMetric {
  name: string
  kind: AtcTelemetryMetricKind
  value: number
  labels?: Record<string, string>
  updatedAt: string
}

export interface AtcTelemetrySnapshot {
  metrics: AtcTelemetryMetric[]
  capturedAt: string
}
