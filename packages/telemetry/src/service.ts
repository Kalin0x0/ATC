import type { AtcTelemetryMetric, AtcTelemetrySnapshot } from '@atc/shared-types'

function makeMetric(
  name: string,
  kind: AtcTelemetryMetric['kind'],
  value: number,
  labels?: Record<string, string>,
): AtcTelemetryMetric {
  return labels !== undefined
    ? { name, kind, value, labels, updatedAt: new Date().toISOString() }
    : { name, kind, value, updatedAt: new Date().toISOString() }
}

export class AtcTelemetryService {
  private readonly _metrics = new Map<string, AtcTelemetryMetric>()

  counter(name: string, labels?: Record<string, string>): void {
    this.increment(name, 1, labels)
  }

  increment(name: string, by = 1, labels?: Record<string, string>): void {
    const key = this._key(name, labels)
    const existing = this._metrics.get(key)
    if (existing) {
      existing.value += by
      existing.updatedAt = new Date().toISOString()
    } else {
      this._metrics.set(key, makeMetric(name, 'counter', by, labels))
    }
  }

  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this._key(name, labels)
    const existing = this._metrics.get(key)
    if (existing) {
      existing.value = value
      existing.updatedAt = new Date().toISOString()
    } else {
      this._metrics.set(key, makeMetric(name, 'gauge', value, labels))
    }
  }

  observe(name: string, value: number, labels?: Record<string, string>): void {
    this.histogram(name, value, labels)
  }

  histogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this._key(name, labels)
    const existing = this._metrics.get(key)
    if (existing) {
      existing.value = value
      existing.updatedAt = new Date().toISOString()
    } else {
      this._metrics.set(key, makeMetric(name, 'histogram', value, labels))
    }
  }

  snapshot(): AtcTelemetrySnapshot {
    return {
      metrics: Array.from(this._metrics.values()).map((m) => ({ ...m })),
      capturedAt: new Date().toISOString(),
    }
  }

  get(name: string, labels?: Record<string, string>): AtcTelemetryMetric | undefined {
    const m = this._metrics.get(this._key(name, labels))
    return m ? { ...m } : undefined
  }

  reset(name: string, labels?: Record<string, string>): void {
    this._metrics.delete(this._key(name, labels))
  }

  clear(): void {
    this._metrics.clear()
  }

  private _key(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) return name
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',')
    return `${name}{${labelStr}}`
  }
}
