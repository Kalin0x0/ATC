import React, { useEffect, useRef, useState } from 'react'
import { Card, Badge, Button, Modal, Input, Spinner, Alert, StatusDot } from '@atc/ui'
import { api, ApiError } from '../lib/api'

interface HealthData {
  status?: string
  version?: string
  uptime?: number
  serverId?: string
  nodeVersion?: string
  environment?: string
}

interface MetricsData {
  requests?: number
  errors?: number
  latencyMs?: number
  memoryMb?: number
  cpuPercent?: number
  [key: string]: unknown
}

interface OpsData {
  status?: string
  timestamp?: string
  checks?: Record<string, string>
}

function formatUptime(sec?: number): string {
  if (sec == null) return '—'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function ServerOpsPage() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [liveness, setLiveness] = useState<OpsData | null>(null)
  const [readiness, setReadiness] = useState<OpsData | null>(null)
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<string[]>([])

  // Runtime controls state
  const [announceText, setAnnounceText] = useState('')
  const [announceLoading, setAnnounceLoading] = useState(false)
  const [announceResult, setAnnounceResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [gcLoading, setGcLoading] = useState(false)
  const [gcResult, setGcResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [exportLoading, setExportLoading] = useState(false)

  // Danger zone modal state
  const [opModal, setOpModal] = useState<{ action: string; label: string } | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [opLoading, setOpLoading] = useState(false)
  const [opResult, setOpResult] = useState<{ ok: boolean; msg: string } | null>(null)

  async function fetchAll() {
    setLoading(true)
    setErrors([])
    const errs: string[] = []

    const [h, l, r, m] = await Promise.allSettled([
      api.get<HealthData>('/health'),
      api.get<OpsData>('/api/v1/ops/live'),
      api.get<OpsData>('/api/v1/ops/ready'),
      api.get<MetricsData>('/api/v1/metrics'),
    ])

    if (h.status === 'fulfilled') setHealth(h.value)
    else errs.push(`Health: ${(h.reason as ApiError).message}`)

    if (l.status === 'fulfilled') setLiveness(l.value)
    else errs.push(`Liveness: ${(l.reason as ApiError).message}`)

    if (r.status === 'fulfilled') setReadiness(r.value)
    else errs.push(`Readiness: ${(r.reason as ApiError).message}`)

    if (m.status === 'fulfilled') setMetrics(m.value)
    // metrics is optional — skip error

    setErrors(errs)
    setLoading(false)
  }

  useEffect(() => {
    void fetchAll()
  }, [])

  async function broadcastAnnounce() {
    if (!announceText.trim()) return
    setAnnounceLoading(true)
    setAnnounceResult(null)
    try {
      await api.post('/api/v1/ops/announce', { message: announceText })
      setAnnounceResult({ ok: true, msg: 'Announcement broadcast to all players.' })
      setAnnounceText('')
    } catch (err) {
      setAnnounceResult({ ok: false, msg: err instanceof ApiError ? err.message : 'Announce failed.' })
    } finally {
      setAnnounceLoading(false)
    }
  }

  async function forceGC() {
    setGcLoading(true)
    setGcResult(null)
    try {
      await api.post('/api/v1/ops/gc', {})
      setGcResult({ ok: true, msg: 'Garbage collection triggered.' })
    } catch (err) {
      setGcResult({ ok: false, msg: err instanceof ApiError ? err.message : 'GC failed.' })
    } finally {
      setGcLoading(false)
    }
  }

  async function exportMetrics() {
    setExportLoading(true)
    try {
      const data = await api.get<unknown>('/api/v1/metrics')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `atc-metrics-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      // silent — metrics export failure is non-critical
    } finally {
      setExportLoading(false)
    }
  }

  async function executeOp(action: string) {
    setOpLoading(true)
    setOpResult(null)
    try {
      await api.post(`/api/v1/ops/${action}`)
      setOpResult({ ok: true, msg: `${action} executed successfully.` })
    } catch (err) {
      setOpResult({ ok: false, msg: err instanceof ApiError ? err.message : 'Operation failed.' })
    } finally {
      setOpLoading(false)
      setConfirmText('')
    }
  }

  const apiStatus: 'online' | 'offline' | 'warning' =
    health?.status === 'ok' || health?.status === 'healthy' ? 'online'
    : errors.length > 0 ? 'offline'
    : 'warning'

  const DANGER_OPS = [
    { action: 'restart',   label: 'Restart API',      variant: 'warning' as const, confirm: 'RESTART' },
    { action: 'flush-cache', label: 'Flush Redis Cache', variant: 'warning' as const, confirm: 'FLUSH' },
    { action: 'shutdown',  label: 'Shutdown Server',   variant: 'danger' as const, confirm: 'SHUTDOWN' },
  ]

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#e8e8f0] text-2xl font-bold">Server Ops</h1>
          <p className="text-[#8888aa] text-sm mt-1">Health monitoring and operational controls</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchAll} disabled={loading}>
          {loading ? <Spinner size="sm" /> : 'Refresh'}
        </Button>
      </div>

      {errors.map((e, i) => (
        <Alert key={i} variant="warning">{e}</Alert>
      ))}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Health grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'API Status', value: <StatusDot status={apiStatus} label={health?.status ?? '—'} /> },
              { label: 'Version', value: health?.version ?? '—' },
              { label: 'Uptime', value: formatUptime(health?.uptime) },
              { label: 'Environment', value: health?.environment ?? '—' },
            ].map((card) => (
              <div key={card.label} className="bg-[#16213e] border border-[#ffffff0a] rounded-lg px-4 py-3">
                <p className="text-[#8888aa] text-xs uppercase tracking-wide mb-2">{card.label}</p>
                <div className="text-[#e8e8f0] font-semibold text-sm">{card.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Liveness */}
            <Card title="Liveness" subtitle="/api/v1/ops/live">
              <div className="flex items-center gap-3">
                <StatusDot
                  status={liveness?.status === 'ok' ? 'online' : 'error'}
                  label={liveness?.status ?? 'unavailable'}
                />
                {liveness?.timestamp && (
                  <span className="text-[#8888aa] text-xs">
                    {new Date(liveness.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </Card>

            {/* Readiness */}
            <Card title="Readiness" subtitle="/api/v1/ops/ready">
              {readiness?.checks && Object.keys(readiness.checks).length > 0 ? (
                <dl className="space-y-2">
                  {Object.entries(readiness.checks).map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center text-sm">
                      <dt className="text-[#8888aa] capitalize">{k}</dt>
                      <dd>
                        <StatusDot
                          status={v === 'ok' || v === 'pass' ? 'online' : 'error'}
                          label={v}
                        />
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <StatusDot
                  status={readiness?.status === 'ok' ? 'online' : 'offline'}
                  label={readiness?.status ?? 'unavailable'}
                />
              )}
            </Card>
          </div>

          {/* Metrics */}
          {metrics && (
            <Card title="Runtime Metrics" subtitle="Current snapshot">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Requests', value: metrics.requests?.toLocaleString() ?? '—', color: '#5288e0' },
                  { label: 'Errors', value: metrics.errors?.toLocaleString() ?? '—', color: '#e05252' },
                  { label: 'Avg Latency', value: metrics.latencyMs != null ? `${metrics.latencyMs}ms` : '—', color: '#d4af37' },
                  { label: 'Memory', value: metrics.memoryMb != null ? `${metrics.memoryMb}MB` : '—', color: '#52c052' },
                ].map((m) => (
                  <div key={m.label} className="bg-[#16213e] rounded-lg px-4 py-3 border border-[#ffffff06]">
                    <p className="text-[#8888aa] text-xs uppercase tracking-wide mb-1">{m.label}</p>
                    <p className="font-bold font-mono" style={{ color: m.color }}>{m.value}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Runtime Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Announce */}
            <Card title="Announce" subtitle="Broadcast message to all players">
              <div className="space-y-2">
                {announceResult && (
                  <Alert variant={announceResult.ok ? 'success' : 'danger'} onDismiss={() => setAnnounceResult(null)}>
                    {announceResult.msg}
                  </Alert>
                )}
                <Input
                  placeholder="Message to broadcast…"
                  value={announceText}
                  onChange={setAnnounceText}
                />
                <Button
                  variant="primary"
                  size="sm"
                  loading={announceLoading}
                  disabled={!announceText.trim()}
                  onClick={broadcastAnnounce}
                >
                  Broadcast
                </Button>
              </div>
            </Card>

            {/* Force GC */}
            <Card title="Force GC" subtitle="Trigger server-side garbage collection">
              <div className="space-y-2">
                {gcResult && (
                  <Alert variant={gcResult.ok ? 'success' : 'danger'} onDismiss={() => setGcResult(null)}>
                    {gcResult.msg}
                  </Alert>
                )}
                <p className="text-[#8888aa] text-xs">
                  Forces immediate garbage collection on the API process. Use if memory usage is elevated.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={gcLoading}
                  onClick={forceGC}
                >
                  Run GC
                </Button>
              </div>
            </Card>

            {/* Export Metrics */}
            <Card title="Export Metrics" subtitle="Download current metrics snapshot as JSON">
              <div className="space-y-2">
                <p className="text-[#8888aa] text-xs">
                  Fetches <span className="font-mono text-[#d4af37]">GET /api/v1/metrics</span> and downloads the response as a timestamped JSON file.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={exportLoading}
                  onClick={exportMetrics}
                >
                  Export JSON
                </Button>
              </div>
            </Card>
          </div>

          {/* Danger Zone */}
          <Card
            title="Danger Zone"
            subtitle="Irreversible server operations — use with caution"
          >
            <div className="space-y-3">
              <div
                className="p-3 rounded-lg border border-[#e0525230] bg-[#e0525208] flex items-center gap-2 mb-4"
              >
                <svg className="w-4 h-4 text-[#e05252] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-[#e05252] text-xs">These operations affect live server state and may impact players.</p>
              </div>

              {opResult && (
                <Alert
                  variant={opResult.ok ? 'success' : 'danger'}
                  onDismiss={() => setOpResult(null)}
                >
                  {opResult.msg}
                </Alert>
              )}

              <div className="flex flex-wrap gap-3">
                {DANGER_OPS.map((op) => (
                  <Button
                    key={op.action}
                    variant={op.variant === 'danger' ? 'danger' : 'secondary'}
                    size="sm"
                    onClick={() => { setOpModal({ action: op.action, label: op.label }); setConfirmText(''); setOpResult(null) }}
                  >
                    {op.label}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Confirm modal */}
      <Modal
        open={opModal !== null}
        onClose={() => { setOpModal(null); setConfirmText('') }}
        title={opModal?.label ?? ''}
        size="sm"
      >
        {opResult ? (
          <div className="space-y-4">
            <Alert variant={opResult.ok ? 'success' : 'danger'}>
              {opResult.msg}
            </Alert>
            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => { setOpModal(null); setConfirmText('') }}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[#e8e8f0] text-sm">
              This action may disrupt active players. Type{' '}
              <span className="font-mono text-[#d4af37]">
                {DANGER_OPS.find((o) => o.action === opModal?.action)?.confirm}
              </span>{' '}
              to confirm.
            </p>
            <Input
              placeholder="Type to confirm…"
              value={confirmText}
              onChange={setConfirmText}
            />
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" size="sm" onClick={() => { setOpModal(null); setConfirmText('') }}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={opLoading}
                disabled={
                  confirmText !== (DANGER_OPS.find((o) => o.action === opModal?.action)?.confirm ?? '')
                }
                onClick={() => opModal && executeOp(opModal.action)}
              >
                Execute
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
