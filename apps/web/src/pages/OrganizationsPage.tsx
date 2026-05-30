import { useEffect, useState } from 'react'
import { Card, DataTable, Badge, Spinner } from '@atc/ui'
import { api } from '../lib/api'

interface OrgFinance extends Record<string, unknown> { id: string; name: string; type: string; balance: number; members: number }

export function OrganizationsPage() {
  const [orgs, setOrgs] = useState<OrgFinance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/v1/organizations')
      .then((d: unknown) => setOrgs(Array.isArray(d) ? (d as OrgFinance[]) : ((d as Record<string,unknown>)?.organizations as OrgFinance[] ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const total = orgs.reduce((s, o) => s + (o.balance || 0), 0)

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ color: '#d4af37', marginBottom: 16 }}>Organizations</h1>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <Card title="Total Organizations"><span style={{ fontSize: 28, color: '#e8e8f0' }}>{orgs.length}</span></Card>
        <Card title="Total Org Funds"><span style={{ fontSize: 28, color: '#d4af37' }}>${total.toLocaleString()}</span></Card>
      </div>
      {loading ? <Spinner /> : (
        <DataTable
          columns={[
            { key: 'name',    label: 'Name' },
            { key: 'type',    label: 'Type', render: (v) => <Badge variant="info">{String(v ?? '')}</Badge> },
            { key: 'members', label: 'Members' },
            { key: 'balance', label: 'Balance', render: (v) => <span style={{ color: '#d4af37' }}>${(Number(v)||0).toLocaleString()}</span> },
          ]}
          data={orgs}
          emptyMessage="No organizations found"
        />
      )}
    </div>
  )
}
