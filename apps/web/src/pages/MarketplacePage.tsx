import { useState, useEffect } from 'react'
import { Card, DataTable, Badge, Button, Spinner } from '@atc/ui'
import { api } from '../lib/api'

interface Plugin extends Record<string, unknown> { id: string; name: string; version: string; author: string; downloads: number; status: string }

export function MarketplacePage() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch from registry (falls back to static list if API not available)
    api.get('/api/v1/plugins/registry')
      .then(d => setPlugins(Array.isArray(d) ? d : (d as any)?.plugins ?? []))
      .catch(() => setPlugins([
        { id:'atc-phone',       name:'ATC Phone',       version:'0.1.0', author:'ATC Team', downloads:0, status:'installed' },
        { id:'atc-mdt',         name:'ATC MDT',         version:'0.1.0', author:'ATC Team', downloads:0, status:'installed' },
        { id:'atc-marketplace', name:'ATC Marketplace', version:'0.1.0', author:'ATC Team', downloads:0, status:'installed' },
        { id:'atc-criminal',    name:'ATC Criminal',    version:'0.1.0', author:'ATC Team', downloads:0, status:'installed' },
        { id:'atc-ems',         name:'ATC EMS',         version:'0.1.0', author:'ATC Team', downloads:0, status:'installed' },
      ]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ color: '#d4af37', marginBottom: 16 }}>Plugin Marketplace</h1>
      {loading ? <Spinner /> : (
        <DataTable
          columns={[
            { key: 'name',      label: 'Plugin' },
            { key: 'version',   label: 'Version' },
            { key: 'author',    label: 'Author' },
            { key: 'downloads', label: 'Downloads' },
            { key: 'status', label: 'Status', render: (v) => <Badge variant={String(v)==='installed'?'success':'info'}>{String(v ?? '')}</Badge> },
            { key: 'id',     label: '', render: () => <Button variant="secondary" onClick={() => {}}>Details</Button> },
          ]}
          data={plugins}
          emptyMessage="No plugins found"
        />
      )}
    </div>
  )
}
