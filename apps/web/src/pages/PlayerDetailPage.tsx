import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Badge, Button, Spinner, Alert, StatusDot } from '@atc/ui'
import { api, ApiError } from '../lib/api'

interface Account {
  id: string
  identifier: string
  status: string
  createdAt: string
  updatedAt?: string
  bannedAt?: string | null
  banReason?: string | null
}

interface Session {
  id: string
  joinedAt: string
  leftAt?: string | null
  ip?: string
  endpoint?: string
}

interface Character {
  id: string
  slot: number
  name: string
  status: string
  createdAt?: string
}

export function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [account, setAccount] = useState<Account | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [acc, sess, chars] = await Promise.allSettled([
          api.get<Account>(`/api/v1/accounts/${id}`),
          api.get<Session[] | { data: Session[] }>(`/api/v1/accounts/${id}/sessions`),
          api.get<Character[] | { data: Character[] }>(`/api/v1/accounts/${id}/characters`),
        ])
        if (cancelled) return
        if (acc.status === 'fulfilled') setAccount(acc.value)
        else setError((acc.reason as ApiError).message)

        if (sess.status === 'fulfilled') {
          const data = sess.value
          setSessions(Array.isArray(data) ? data : (data.data ?? []))
        }
        if (chars.status === 'fulfilled') {
          const data = chars.value
          setCharacters(Array.isArray(data) ? data : (data.data ?? []))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!account) {
    return (
      <div className="max-w-2xl">
        <Alert variant="danger">
          {error ?? 'Account not found.'}
        </Alert>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => navigate('/players')}>
          Back to Players
        </Button>
      </div>
    )
  }

  const statusVariant =
    account.status === 'active' ? 'success'
    : account.status === 'banned' ? 'danger'
    : account.status === 'suspended' ? 'warning'
    : 'muted'

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/players')} className="-ml-2 mb-2">
            ← Back
          </Button>
          <h1 className="text-[#e8e8f0] text-2xl font-bold font-mono">
            {account.identifier.length > 40
              ? `${account.identifier.slice(0, 20)}…${account.identifier.slice(-10)}`
              : account.identifier}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <Badge variant={statusVariant}>{account.status}</Badge>
            <span className="text-[#8888aa] text-xs">ID: {account.id}</span>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <Card title="Account Info">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-[#8888aa] mb-1">Identifier</dt>
            <dd className="text-[#e8e8f0] font-mono text-xs break-all">{account.identifier}</dd>
          </div>
          <div>
            <dt className="text-[#8888aa] mb-1">Status</dt>
            <dd><Badge variant={statusVariant}>{account.status}</Badge></dd>
          </div>
          <div>
            <dt className="text-[#8888aa] mb-1">Created</dt>
            <dd className="text-[#e8e8f0]">
              {new Date(account.createdAt).toLocaleString()}
            </dd>
          </div>
          {account.updatedAt && (
            <div>
              <dt className="text-[#8888aa] mb-1">Last Updated</dt>
              <dd className="text-[#e8e8f0]">
                {new Date(account.updatedAt).toLocaleString()}
              </dd>
            </div>
          )}
          {account.bannedAt && (
            <div>
              <dt className="text-[#8888aa] mb-1">Banned At</dt>
              <dd className="text-[#e05252]">
                {new Date(account.bannedAt).toLocaleString()}
              </dd>
            </div>
          )}
          {account.banReason && (
            <div className="col-span-2">
              <dt className="text-[#8888aa] mb-1">Ban Reason</dt>
              <dd className="text-[#e0a052]">{account.banReason}</dd>
            </div>
          )}
        </dl>
      </Card>

      {/* Active Sessions */}
      <Card title="Sessions" subtitle={`${sessions.length} session${sessions.length !== 1 ? 's' : ''}`}>
        {sessions.length === 0 ? (
          <p className="text-[#8888aa] text-sm">No sessions found.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#16213e] border border-[#ffffff08]"
              >
                <div className="flex items-center gap-3">
                  <StatusDot status={sess.leftAt ? 'offline' : 'online'} />
                  <div>
                    <p className="text-[#e8e8f0] text-sm font-mono text-xs">{sess.id.slice(0, 16)}…</p>
                    <p className="text-[#8888aa] text-xs">
                      Joined {new Date(sess.joinedAt).toLocaleString()}
                      {sess.leftAt && ` · Left ${new Date(sess.leftAt).toLocaleString()}`}
                    </p>
                  </div>
                </div>
                {sess.ip && (
                  <span className="text-[#8888aa] text-xs font-mono">{sess.ip}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Characters */}
      <Card title="Characters" subtitle={`${characters.length} character${characters.length !== 1 ? 's' : ''}`}>
        {characters.length === 0 ? (
          <p className="text-[#8888aa] text-sm">No characters found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {characters.map((char) => {
              const charVariant =
                char.status === 'active' ? 'success'
                : char.status === 'dead' ? 'danger'
                : 'muted'
              return (
                <div
                  key={char.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#16213e] border border-[#ffffff08]"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                    style={{
                      background: 'rgba(212,175,55,0.15)',
                      color: '#d4af37',
                      border: '1px solid rgba(212,175,55,0.3)',
                    }}
                  >
                    {char.slot}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[#e8e8f0] text-sm font-medium truncate">{char.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant={charVariant}>{char.status}</Badge>
                      <span className="text-[#8888aa] text-xs">Slot {char.slot}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
