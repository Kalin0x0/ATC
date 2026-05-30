import { useState } from 'react'
import { Card, Button, Input, Alert } from '@atc/ui'
import { api } from '../lib/api'

export function RollbackPage() {
  const [characterId, setCharacterId] = useState('')
  const [snapshotId,  setSnapshotId]  = useState('')
  const [msg, setMsg] = useState<{text:string;ok:boolean}|null>(null)
  const [loading, setLoading] = useState(false)

  const createSnapshot = async () => {
    if (!characterId) return
    setLoading(true)
    try {
      const d = await api.post(`/api/v1/characters/${characterId}/snapshot`, {}) as Record<string, unknown>
      setMsg({ text: 'Snapshot created: ' + ((d?.snapshotId as string) || 'ok'), ok: true })
    } catch(e: any) { setMsg({ text: e.message, ok: false }) }
    setLoading(false)
  }

  const restoreSnapshot = async () => {
    if (!characterId || !snapshotId) return
    setLoading(true)
    try {
      await api.post(`/api/v1/characters/${characterId}/snapshot/${snapshotId}/restore`, {})
      setMsg({ text: 'Snapshot restored successfully', ok: true })
    } catch(e: any) { setMsg({ text: e.message, ok: false }) }
    setLoading(false)
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ color: '#d4af37', marginBottom: 16 }}>Rollback Tools</h1>
      {msg && <Alert variant={msg.ok ? 'success' : 'danger'} onDismiss={() => setMsg(null)}>{msg.text}</Alert>}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 340 }}><Card title="Create Character Snapshot">
          <Input label="Character ID" value={characterId} onChange={setCharacterId} placeholder="ULID..." />
          <div style={{ marginTop: 10 }}><Button variant="primary" loading={loading} onClick={createSnapshot}>Create Snapshot</Button></div>
        </Card></div>
        <div style={{ width: 340 }}><Card title="Restore Snapshot">
          <Input label="Character ID" value={characterId} onChange={setCharacterId} placeholder="ULID..." />
          <Input label="Snapshot ID"  value={snapshotId}  onChange={setSnapshotId}  placeholder="Snapshot ID..." />
          <div style={{ marginTop: 10 }}><Button variant="danger" loading={loading} onClick={restoreSnapshot}>Restore</Button></div>
        </Card></div>
      </div>
    </div>
  )
}
