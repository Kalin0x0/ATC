import React, { useEffect, useState } from 'react'
import { Card, Badge, Spinner, Alert } from '@atc/ui'
import { api, ApiError } from '../lib/api'

interface JobGrade {
  grade: number
  name: string
  salary?: number
}

interface Job {
  id?: string
  name: string
  label?: string
  maxPlayers?: number
  onDutyCount?: number
  grades?: JobGrade[]
}

interface JobsResponse {
  data?: Job[]
  items?: Job[]
  jobs?: Job[]
}

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await api.get<JobsResponse | Job[]>('/api/v1/jobs')
        if (cancelled) return
        const items = Array.isArray(res)
          ? res
          : (res.data ?? res.items ?? res.jobs ?? [])
        setJobs(items)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Failed to load jobs.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-[#e8e8f0] text-2xl font-bold">Jobs</h1>
        <p className="text-[#8888aa] text-sm mt-1">
          Registered jobs and grade structures — {jobs.length} total
        </p>
      </div>

      {error && (
        <Alert variant="danger" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <p className="text-[#8888aa] text-sm text-center py-6">No jobs registered.</p>
        </Card>
      ) : (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#16213e] border border-[#ffffff0a] rounded-lg px-5 py-4">
              <p className="text-[#8888aa] text-xs uppercase tracking-wide mb-2">Total Jobs</p>
              <p className="text-[#e8e8f0] text-2xl font-bold">{jobs.length}</p>
            </div>
            <div className="bg-[#16213e] border border-[#ffffff0a] rounded-lg px-5 py-4">
              <p className="text-[#8888aa] text-xs uppercase tracking-wide mb-2">On Duty</p>
              <p className="text-[#52c052] text-2xl font-bold">
                {jobs.reduce((s, j) => s + (j.onDutyCount ?? 0), 0)}
              </p>
            </div>
            <div className="bg-[#16213e] border border-[#ffffff0a] rounded-lg px-5 py-4">
              <p className="text-[#8888aa] text-xs uppercase tracking-wide mb-2">Max Capacity</p>
              <p className="text-[#d4af37] text-2xl font-bold">
                {jobs.reduce((s, j) => s + (j.maxPlayers ?? 0), 0)}
              </p>
            </div>
          </div>

          {/* Job cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jobs.map((job) => {
              const occupancy =
                job.maxPlayers && job.maxPlayers > 0
                  ? Math.round(((job.onDutyCount ?? 0) / job.maxPlayers) * 100)
                  : 0
              const occupancyVariant =
                occupancy >= 80 ? 'warning' : occupancy > 0 ? 'success' : 'muted'

              return (
                <Card
                  key={job.id ?? job.name}
                  title={job.label ?? job.name}
                  subtitle={`ID: ${job.name}`}
                  actions={
                    <Badge variant={occupancyVariant}>
                      {job.onDutyCount ?? 0} / {job.maxPlayers ?? '∞'} on duty
                    </Badge>
                  }
                >
                  {job.grades && job.grades.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-[#8888aa] text-xs uppercase tracking-wide mb-2">
                        Grades ({job.grades.length})
                      </p>
                      <div className="space-y-1">
                        {job.grades.map((grade) => (
                          <div
                            key={grade.grade}
                            className="flex items-center justify-between px-3 py-1.5 rounded bg-[#16213e] border border-[#ffffff06]"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                                style={{
                                  background: 'rgba(212,175,55,0.15)',
                                  color: '#d4af37',
                                }}
                              >
                                {grade.grade}
                              </span>
                              <span className="text-[#e8e8f0] text-sm">{grade.name}</span>
                            </div>
                            {grade.salary != null && (
                              <span className="text-[#52c052] text-xs font-mono">
                                ${grade.salary.toLocaleString()}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[#8888aa] text-sm">No grades defined.</p>
                  )}
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
