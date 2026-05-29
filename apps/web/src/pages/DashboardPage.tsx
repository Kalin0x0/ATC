import React, { useEffect, useState } from 'react'
import { Card, Badge, StatusDot, Spinner, Alert } from '@atc/ui'
import { api, ApiError } from '../lib/api'

interface HealthResponse {
  status?: string
  version?: string
  uptime?: number
  serverId?: string
}

interface LiveResponse {
  status?: string
  timestamp?: string
}

interface ReadyResponse {
  status?: string
  checks?: Record<string, string>
}

function StatCard({
  label,
  value,
  sub,
  status,
}: {
  label: string
  value: React.ReactNode
  sub?: string
  status?: 'online' | 'offline' | 'warning' | 'error'
}) {
  return (
    <div className="bg-[#16213e] border border-[#ffffff0a] rounded-lg px-5 py-4">
      <p className="text-[#8888aa] text-xs font-medium uppercase tracking-wide mb-2">{label}</p>
      <div className="flex items-center gap-3">
        {status && <StatusDot status={status} />}
        <span className="text-[#e8e8f0] text-xl font-bold">{value}</span>
      </div>
      {sub && <p className="text-[#8888aa] text-xs mt-1">{sub}</p>}
    </div>
  )
}

function formatUptime(seconds?: number): string {
  if (seconds == null) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${h}h ${m}m ${s}s`
}

export function DashboardPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [live, setLive] = useState<LiveResponse | null>(null)
  const [ready, setReady] = useState<ReadyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [h, l, r] = await Promise.allSettled([
          api.get<HealthResponse>('/health'),
          api.get<LiveResponse>('/api/v1/ops/live'),
          api.get<ReadyResponse>('/api/v1/ops/ready'),
        ])
        if (cancelled) return
        if (h.status === 'fulfilled') setHealth(h.value)
        if (l.status === 'fulfilled') setLive(l.value)
        if (r.status === 'fulfilled') setReady(r.value)
        if (h.status === 'rejected') {
          const reason = h.reason as ApiError | Error
          setError(reason.message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const apiStatus: 'online' | 'offline' | 'warning' =
    health?.status === 'ok' || health?.status === 'healthy' ? 'online'
    : error ? 'offline'
    : 'warning'

  const readyChecks = ready?.checks ?? {}
  const allReady = Object.values(readyChecks).every((v) => v === 'ok' || v === 'pass')

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-[#e8e8f0] text-2xl font-bold">Dashboard</h1>
        <p className="text-[#8888aa] text-sm mt-1">System overview and health status</p>
      </div>

      {error && (
        <Alert variant="warning" title="Partial data" onDismiss={() => setError(null)}>
          {error} — some panels may be unavailable.
        </Alert>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="API Status"
              value={
                <Badge variant={apiStatus === 'online' ? 'success' : apiStatus === 'offline' ? 'danger' : 'warning'}>
                  {apiStatus === 'online' ? 'Online' : apiStatus === 'offline' ? 'Offline' : 'Degraded'}
                </Badge>
              }
              status={apiStatus}
            />
            <StatCard
              label="Version"
              value={health?.version ?? '—'}
              sub="API server"
            />
            <StatCard
              label="Uptime"
              value={formatUptime(health?.uptime)}
              sub="Since last restart"
            />
            <StatCard
              label="Readiness"
              value={
                <Badge variant={allReady ? 'success' : 'warning'}>
                  {allReady ? 'Ready' : 'Degraded'}
                </Badge>
              }
            />
          </div>

          {/* Health detail */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="API Health" subtitle="Live endpoint status">
              <dl className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <dt className="text-[#8888aa]">Status</dt>
                  <dd>
                    <StatusDot
                      status={apiStatus}
                      label={health?.status ?? '—'}
                    />
                  </dd>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <dt className="text-[#8888aa]">Liveness</dt>
                  <dd>
                    <Badge variant={live?.status === 'ok' ? 'success' : 'muted'}>
                      {live?.status ?? '—'}
                    </Badge>
                  </dd>
                </div>
                {live?.timestamp && (
                  <div className="flex justify-between items-center text-sm">
                    <dt className="text-[#8888aa]">Last ping</dt>
                    <dd className="text-[#e8e8f0] text-xs font-mono">
                      {new Date(live.timestamp).toLocaleTimeString()}
                    </dd>
                  </div>
                )}
                {health?.serverId && (
                  <div className="flex justify-between items-center text-sm">
                    <dt className="text-[#8888aa]">Server ID</dt>
                    <dd className="text-[#e8e8f0] font-mono text-xs">{health.serverId}</dd>
                  </div>
                )}
              </dl>
            </Card>

            <Card title="Readiness Checks" subtitle="Dependency health">
              {Object.keys(readyChecks).length === 0 ? (
                <p className="text-[#8888aa] text-sm">No readiness data.</p>
              ) : (
                <dl className="space-y-3">
                  {Object.entries(readyChecks).map(([key, val]) => (
                    <div key={key} className="flex justify-between items-center text-sm">
                      <dt className="text-[#8888aa] capitalize">{key}</dt>
                      <dd>
                        <StatusDot
                          status={val === 'ok' || val === 'pass' ? 'online' : 'error'}
                          label={val}
                        />
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
