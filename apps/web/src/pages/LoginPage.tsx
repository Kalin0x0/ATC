import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { Button, Input, Alert } from '@atc/ui'

export function LoginPage() {
  const navigate = useNavigate()
  const setCredentials = useAuthStore((s) => s.setCredentials)

  const [apiUrl, setApiUrl] = useState('http://localhost:3000')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!apiUrl.trim() || !token.trim()) {
      setError('Please enter both API URL and token.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const url = `${apiUrl.replace(/\/$/, '')}/health`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`)
      }
      setCredentials(apiUrl, token)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not reach server.'
      setError(`Login failed: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 40%, rgba(212,175,55,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-[#d4af37] flex items-center justify-center mb-4 shadow-lg shadow-[#d4af3730]">
            <span className="text-[#0d0d1a] font-black text-lg tracking-tight">ATC</span>
          </div>
          <h1 className="text-2xl font-bold text-[#d4af37] tracking-wide">Atlantic Core</h1>
          <p className="text-[#8888aa] text-sm mt-1">Admin Panel</p>
        </div>

        {/* Card */}
        <div className="bg-[#1a1a2e] border border-[#d4af3730] rounded-xl p-6 shadow-2xl">
          {error && (
            <div className="mb-4">
              <Alert variant="danger" onDismiss={() => setError(null)}>
                {error}
              </Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="API URL"
              placeholder="http://localhost:3000"
              value={apiUrl}
              onChange={setApiUrl}
              type="url"
            />
            <Input
              label="API Token"
              placeholder="Bearer token…"
              value={token}
              onChange={setToken}
              type="password"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              className="w-full mt-2"
            >
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center text-[#8888aa40] text-xs mt-6">
          Atlantic Core &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
