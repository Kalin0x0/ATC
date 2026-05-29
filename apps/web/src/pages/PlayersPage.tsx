import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, DataTable, Badge, Button, Modal, Input, Alert } from '@atc/ui'
import { api, ApiError } from '../lib/api'
import type { Column } from '@atc/ui'

interface Account {
  id: string
  identifier: string
  status: string
  createdAt: string
  bannedAt?: string | null
}

interface AccountsResponse {
  data?: Account[]
  items?: Account[]
  total?: number
}

export function PlayersPage() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Ban modal state
  const [banTarget, setBanTarget] = useState<Account | null>(null)
  const [banReason, setBanReason] = useState('')
  const [banLoading, setBanLoading] = useState(false)
  const [banError, setBanError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await api.get<AccountsResponse | Account[]>('/api/v1/accounts')
        if (cancelled) return
        const items = Array.isArray(res) ? res : (res.data ?? res.items ?? [])
        setAccounts(items)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Failed to load accounts.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  async function executeBan() {
    if (!banTarget || !banReason.trim()) return
    setBanLoading(true)
    setBanError(null)
    try {
      await api.post(`/api/v1/accounts/${banTarget.id}/ban`, { reason: banReason })
      setAccounts((prev) =>
        prev.map((a) => (a.id === banTarget.id ? { ...a, status: 'banned' } : a))
      )
      setBanTarget(null)
      setBanReason('')
    } catch (err) {
      setBanError(err instanceof ApiError ? err.message : 'Ban failed.')
    } finally {
      setBanLoading(false)
    }
  }

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'identifier',
      label: 'Identifier',
      render: (val) => (
        <span className="font-mono text-xs text-[#e8e8f0]">
          {typeof val === 'string'
            ? val.length > 24
              ? `${val.slice(0, 12)}…${val.slice(-8)}`
              : val
            : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => {
        const s = typeof val === 'string' ? val : 'unknown'
        const variant =
          s === 'active' ? 'success'
          : s === 'banned' ? 'danger'
          : s === 'suspended' ? 'warning'
          : 'muted'
        return <Badge variant={variant}>{s}</Badge>
      },
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (val) =>
        typeof val === 'string' ? (
          <span className="text-[#8888aa] text-xs">
            {new Date(val).toLocaleDateString()}
          </span>
        ) : '—',
    },
    {
      key: 'id',
      label: 'Actions',
      render: (val, row) => {
        const account = row as unknown as Account
        return (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/players/${account.id}`)}
            >
              View
            </Button>
            {account.status !== 'banned' && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setBanTarget(account)
                  setBanReason('')
                  setBanError(null)
                }}
              >
                Ban
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-[#e8e8f0] text-2xl font-bold">Players</h1>
        <p className="text-[#8888aa] text-sm mt-1">
          Manage player accounts — {accounts.length} total
        </p>
      </div>

      {error && (
        <Alert variant="danger" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <DataTable
          columns={columns}
          data={accounts as unknown as Record<string, unknown>[]}
          loading={loading}
          emptyMessage="No accounts found."
        />
      </Card>

      {/* Ban Modal */}
      <Modal
        open={banTarget !== null}
        onClose={() => { setBanTarget(null); setBanReason(''); setBanError(null) }}
        title={`Ban Player — ${banTarget?.identifier?.slice(0, 20) ?? ''}`}
        size="sm"
      >
        <div className="space-y-4">
          {banError && (
            <Alert variant="danger" onDismiss={() => setBanError(null)}>
              {banError}
            </Alert>
          )}
          <Input
            label="Reason"
            placeholder="Enter ban reason…"
            value={banReason}
            onChange={setBanReason}
          />
          <div className="flex gap-3 justify-end pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setBanTarget(null); setBanReason('') }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={banLoading}
              disabled={!banReason.trim()}
              onClick={executeBan}
            >
              Confirm Ban
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
