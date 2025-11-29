'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function SettingsPage() {
  const { data: session } = useSession()
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Polymarket
  const [polymarketKey, setPolymarketKey] = useState('')

  // Kalshi
  const [kalshiAccessKeyId, setKalshiAccessKeyId] = useState('')
  const [kalshiPrivateKey, setKalshiPrivateKey] = useState('')

  useEffect(() => {
    loadApiKeys()
  }, [])

  const loadApiKeys = async () => {
    try {
      const response = await fetch('/api/user/api-keys')
      if (response.ok) {
        const data = await response.json()
        setApiKeys(data.apiKeys || [])
      }
    } catch (error) {
      console.error('Error loading API keys:', error)
    } finally {
      setLoading(false)
    }
  }

  const savePolymarketKey = async () => {
    if (!polymarketKey) return

    setSaving(true)
    try {
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'polymarket',
          apiKey: polymarketKey,
        }),
      })

      if (response.ok) {
        alert('Polymarket API key saved successfully!')
        setPolymarketKey('')
        loadApiKeys()
      } else {
        const data = await response.json()
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      alert('Error saving API key')
    } finally {
      setSaving(false)
    }
  }

  const saveKalshiKeys = async () => {
    if (!kalshiAccessKeyId || !kalshiPrivateKey) return

    setSaving(true)
    try {
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'kalshi',
          accessKeyId: kalshiAccessKeyId,
          privateKey: kalshiPrivateKey,
        }),
      })

      if (response.ok) {
        alert('Kalshi API keys saved successfully!')
        setKalshiAccessKeyId('')
        setKalshiPrivateKey('')
        loadApiKeys()
      } else {
        const data = await response.json()
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      alert('Error saving API keys')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  const hasPolymarket = apiKeys.some(k => k.platform === 'polymarket' && k.isActive)
  const hasKalshi = apiKeys.some(k => k.platform === 'kalshi' && k.isActive)

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Settings</h1>

        {/* Polymarket API Key */}
        <Card>
          <CardHeader>
            <CardTitle>Polymarket API Key</CardTitle>
            <CardDescription>
              Enter your Polymarket API key to enable trading and market data access
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasPolymarket && (
              <div className="p-3 bg-green-500/20 border border-green-500 rounded text-sm">
                ✓ Polymarket API key is configured
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2">API Key</label>
              <input
                type="text"
                value={polymarketKey}
                onChange={(e) => setPolymarketKey(e.target.value)}
                placeholder="Enter your Polymarket API key"
                className="w-full px-4 py-2 bg-background border border-input rounded-md"
              />
            </div>
            <Button onClick={savePolymarketKey} disabled={saving || !polymarketKey}>
              {saving ? 'Saving...' : 'Save Polymarket API Key'}
            </Button>
          </CardContent>
        </Card>

        {/* Kalshi API Keys */}
        <Card>
          <CardHeader>
            <CardTitle>Kalshi API Keys</CardTitle>
            <CardDescription>
              Enter your Kalshi Access Key ID and Private Key to enable trading and market data access
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasKalshi && (
              <div className="p-3 bg-green-500/20 border border-green-500 rounded text-sm">
                ✓ Kalshi API keys are configured
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2">Access Key ID</label>
              <input
                type="text"
                value={kalshiAccessKeyId}
                onChange={(e) => setKalshiAccessKeyId(e.target.value)}
                placeholder="Enter your Kalshi Access Key ID"
                className="w-full px-4 py-2 bg-background border border-input rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Private Key</label>
              <textarea
                value={kalshiPrivateKey}
                onChange={(e) => setKalshiPrivateKey(e.target.value)}
                placeholder="Enter your Kalshi Private Key (PEM format)"
                rows={4}
                className="w-full px-4 py-2 bg-background border border-input rounded-md font-mono text-sm"
              />
            </div>
            <Button onClick={saveKalshiKeys} disabled={saving || !kalshiAccessKeyId || !kalshiPrivateKey}>
              {saving ? 'Saving...' : 'Save Kalshi API Keys'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

