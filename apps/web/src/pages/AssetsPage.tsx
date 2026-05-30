import { useEffect, useState } from 'react'
import { Card, DataTable, Badge, Spinner } from '@atc/ui'
import { api } from '../lib/api'

interface Vehicle  extends Record<string, unknown> { plate: string; model: string; owner: string; status: string }
interface Property extends Record<string, unknown> { address: string; type: string; owner: string; status: string }

export function AssetsPage() {
  const [vehicles,   setVehicles]   = useState<Vehicle[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loadingV,   setLoadingV]   = useState(true)
  const [loadingP,   setLoadingP]   = useState(true)

  useEffect(() => {
    api.get('/api/v1/vehicles')
      .then((d: unknown) => setVehicles(Array.isArray(d) ? (d as Vehicle[]) : ((d as Record<string,unknown>)?.vehicles as Vehicle[] ?? [])))
      .catch(() => {})
      .finally(() => setLoadingV(false))

    api.get('/api/v1/properties')
      .then((d: unknown) => setProperties(Array.isArray(d) ? (d as Property[]) : ((d as Record<string,unknown>)?.properties as Property[] ?? [])))
      .catch(() => {})
      .finally(() => setLoadingP(false))
  }, [])

  function StatusBadge({ status }: { status: string }) {
    const variant =
      status === 'active'   ? 'success' :
      status === 'impound'  ? 'warning' :
      status === 'stolen'   ? 'danger'  : 'info'
    return <Badge variant={variant}>{status}</Badge>
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ color: '#d4af37', marginBottom: 24 }}>Asset Management</h1>

      {/* Vehicles */}
      <div style={{ marginBottom: 24 }}><Card title="Vehicles">
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ background: 'rgba(22,33,62,0.6)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 8, padding: '10px 18px' }}>
            <div style={{ fontSize: 11, color: '#8888aa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Vehicles</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#e8e8f0' }}>{vehicles.length}</div>
          </div>
        </div>
        {loadingV ? <Spinner /> : (
          <DataTable
            columns={[
              { key: 'plate', label: 'Plate' },
              { key: 'model', label: 'Model' },
              { key: 'owner', label: 'Owner' },
              { key: 'status', label: 'Status', render: (v) => <StatusBadge status={String(v ?? '')} /> },
            ]}
            data={vehicles}
            emptyMessage="No vehicles found"
          />
        )}
      </Card></div>

      {/* Properties */}
      <Card title="Properties">
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ background: 'rgba(22,33,62,0.6)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 8, padding: '10px 18px' }}>
            <div style={{ fontSize: 11, color: '#8888aa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Properties</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#e8e8f0' }}>{properties.length}</div>
          </div>
        </div>
        {loadingP ? <Spinner /> : (
          <DataTable
            columns={[
              { key: 'address', label: 'Address' },
              { key: 'type',   label: 'Type', render: (v) => <Badge variant="info">{String(v ?? '')}</Badge> },
              { key: 'owner',  label: 'Owner' },
              { key: 'status', label: 'Status', render: (v) => <StatusBadge status={String(v ?? '')} /> },
            ]}
            data={properties}
            emptyMessage="No properties found"
          />
        )}
      </Card>
    </div>
  )
}
