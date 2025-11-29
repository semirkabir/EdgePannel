'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Trash2 } from 'lucide-react'

export default function SettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

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
        // Option to go back to dashboard
        if (confirm('API key saved! Would you like to go back to the dashboard?')) {
          router.push('/dashboard')
        }
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
        // Option to go back to dashboard
        if (confirm('API keys saved! Would you like to go back to the dashboard?')) {
          router.push('/dashboard')
        }
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

  const deleteApiKey = async (platform: 'polymarket' | 'kalshi') => {
    if (!confirm(`Are you sure you want to delete your ${platform} API key?\n\nYou can add it back at any time by entering it again below.`)) {
      return
    }

    setDeleting(platform)
    try {
      const response = await fetch(`/api/user/api-keys?platform=${platform}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        alert(`${platform} API key deleted successfully! You can add it back by entering it below.`)
        loadApiKeys()
        // Clear form fields
        if (platform === 'polymarket') {
          setPolymarketKey('')
        } else {
          setKalshiAccessKeyId('')
          setKalshiPrivateKey('')
        }
      } else {
        const data = await response.json()
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      alert('Error deleting API key')
    } finally {
      setDeleting(null)
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
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard')}
            className="hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link 
              href="/dashboard" 
              className="hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
            <span>/</span>
            <span>Settings</span>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

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
              <div className="p-3 bg-green-500/20 border border-green-500 rounded text-sm flex items-center justify-between">
                <span>✓ Polymarket API key is configured</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteApiKey('polymarket')}
                  disabled={deleting === 'polymarket'}
                  className="ml-2"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {deleting === 'polymarket' ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2">API Key</label>
              <input
                type="text"
                value={polymarketKey}
                onChange={(e) => setPolymarketKey(e.target.value)}
                placeholder={hasPolymarket ? "Enter new API key to replace existing" : "Enter your Polymarket API key"}
                className="w-full px-4 py-2 bg-background border border-input rounded-md"
              />
            </div>
            <Button onClick={savePolymarketKey} disabled={saving || !polymarketKey}>
              {saving ? 'Saving...' : hasPolymarket ? 'Update Polymarket API Key' : 'Save Polymarket API Key'}
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
              <div className="p-3 bg-green-500/20 border border-green-500 rounded text-sm flex items-center justify-between">
                <span>✓ Kalshi API keys are configured</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteApiKey('kalshi')}
                  disabled={deleting === 'kalshi'}
                  className="ml-2"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {deleting === 'kalshi' ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2">Access Key ID</label>
              <input
                type="text"
                value={kalshiAccessKeyId}
                onChange={(e) => setKalshiAccessKeyId(e.target.value)}
                placeholder={hasKalshi ? "Enter new Access Key ID to replace existing" : "Enter your Kalshi Access Key ID"}
                className="w-full px-4 py-2 bg-background border border-input rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Private Key</label>
              <textarea
                value={kalshiPrivateKey}
                onChange={(e) => setKalshiPrivateKey(e.target.value)}
                placeholder={hasKalshi ? "Enter new Private Key to replace existing" : "Enter your Kalshi Private Key (PEM format)"}
                rows={4}
                className="w-full px-4 py-2 bg-background border border-input rounded-md font-mono text-sm"
              />
            </div>
            <Button onClick={saveKalshiKeys} disabled={saving || !kalshiAccessKeyId || !kalshiPrivateKey}>
              {saving ? 'Saving...' : hasKalshi ? 'Update Kalshi API Keys' : 'Save Kalshi API Keys'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

