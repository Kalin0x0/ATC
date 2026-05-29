import React, { useEffect, useState } from 'react'
import { Card, DataTable, Alert, Spinner } from '@atc/ui'
import { api, ApiError } from '../lib/api'
import type { Column } from '@atc/ui'

interface EconomyAccount {
  id: string
  accountId?: string
  holderName?: string
  identifier?: string
  cash?: number
  bank?: number
  balance?: number
  currency?: string
  updatedAt?: string
  lastUpdated?: string
}

interface EconomyResponse {
  data?: EconomyAccount[]
  items?: EconomyAccount[]
  accounts?: EconomyAccount[]
}

function formatCurrency(val: number | undefined): string {
  if (val == null) return '—'
  return val.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function EconomyPage() {
  const [accounts, setAccounts] = useState<EconomyAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await api.get<EconomyResponse | EconomyAccount[]>('/api/v1/economy/accounts')
        if (cancelled) return
        const items = Array.isArray(res)
          ? res
          : (res.data ?? res.items ?? res.accounts ?? [])
        setAccounts(items)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Failed to load economy data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const totalCash = accounts.reduce((s, a) => s + (a.cash ?? 0), 0)
  const totalBank = accounts.reduce((s, a) => s + (a.bank ?? 0), 0)

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'holderName',
      label: 'Holder',
      render: (val, row) => {
        const acc = row as unknown as EconomyAccount
        const name = acc.holderName ?? acc.identifier ?? acc.accountId ?? '—'
        return <span className="text-[#e8e8f0] text-sm">{typeof name === 'string' ? name : '—'}</span>
      },
    },
    {
      key: 'cash',
      label: 'Cash Balance',
      render: (val) => (
        <span className="font-mono text-[#52c052] text-sm">
          {formatCurrency(typeof val === 'number' ? val : undefined)}
        </span>
      ),
    },
    {
      key: 'bank',
      label: 'Bank Balance',
      render: (val) => (
        <span className="font-mono text-[#5288e0] text-sm">
          {formatCurrency(typeof val === 'number' ? val : undefined)}
        </span>
      ),
    },
    {
      key: 'updatedAt',
      label: 'Last Updated',
      render: (val, row) => {
        const acc = row as unknown as EconomyAccount
        const ts = acc.updatedAt ?? acc.lastUpdated
        if (!ts) return <span className="text-[#8888aa] text-xs">—</span>
        return (
          <span className="text-[#8888aa] text-xs">
            {new Date(ts).toLocaleString()}
          </span>
        )
      },
    },
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-[#e8e8f0] text-2xl font-bold">Economy</h1>
        <p className="text-[#8888aa] text-sm mt-1">
          Money supply and account balances
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
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#16213e] border border-[#ffffff0a] rounded-lg px-5 py-4">
              <p className="text-[#8888aa] text-xs uppercase tracking-wide mb-2">Total Accounts</p>
              <p className="text-[#e8e8f0] text-2xl font-bold">{accounts.length}</p>
            </div>
            <div className="bg-[#16213e] border border-[#ffffff0a] rounded-lg px-5 py-4">
              <p className="text-[#8888aa] text-xs uppercase tracking-wide mb-2">Cash in Circulation</p>
              <p className="text-[#52c052] text-2xl font-bold font-mono">
                {formatCurrency(totalCash)}
              </p>
            </div>
            <div className="bg-[#16213e] border border-[#ffffff0a] rounded-lg px-5 py-4">
              <p className="text-[#8888aa] text-xs uppercase tracking-wide mb-2">Total Bank Balance</p>
              <p className="text-[#5288e0] text-2xl font-bold font-mono">
                {formatCurrency(totalBank)}
              </p>
            </div>
          </div>

          {/* Table */}
          <Card title="Economy Accounts" subtitle="All registered wallets">
            <DataTable
              columns={columns}
              data={accounts as unknown as Record<string, unknown>[]}
              loading={false}
              emptyMessage="No economy accounts found."
            />
          </Card>
        </>
      )}
    </div>
  )
}
