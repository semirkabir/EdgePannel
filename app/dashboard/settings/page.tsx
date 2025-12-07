'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { useUserApiKeys } from '@/hooks/use-markets'
import { ArrowLeft, Trash2, Loader2 } from 'lucide-react'

export default function SettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  
  // Use SWR for API keys fetching with caching
  const { apiKeys, isLoading: loading, refresh: refreshApiKeys } = useUserApiKeys()
  
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Polymarket
  const [polymarketKey, setPolymarketKey] = useState('')

  // Kalshi
  const [kalshiAccessKeyId, setKalshiAccessKeyId] = useState('')
  const [kalshiPrivateKey, setKalshiPrivateKey] = useState('')

  // Confirmation dialogs
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<'polymarket' | 'kalshi' | null>(null)
  const [redirectConfirmOpen, setRedirectConfirmOpen] = useState(false)

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
        toast.success('Polymarket API key saved successfully!')
        setPolymarketKey('')
        refreshApiKeys() // Refresh the SWR cache
        // Show redirect confirmation
        setRedirectConfirmOpen(true)
      } else {
        const data = await response.json()
        toast.error('Failed to save API key', data.error)
      }
    } catch (error) {
      toast.error('Error saving API key', 'Please try again')
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
        toast.success('Kalshi API keys saved successfully!')
        setKalshiAccessKeyId('')
        setKalshiPrivateKey('')
        refreshApiKeys() // Refresh the SWR cache
        // Show redirect confirmation
        setRedirectConfirmOpen(true)
      } else {
        const data = await response.json()
        toast.error('Failed to save API keys', data.error)
      }
    } catch (error) {
      toast.error('Error saving API keys', 'Please try again')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = (platform: 'polymarket' | 'kalshi') => {
    setDeleteTarget(platform)
    setDeleteConfirmOpen(true)
  }

  const deleteApiKey = async () => {
    if (!deleteTarget) return

    const platform = deleteTarget
    setDeleting(platform)
    
    try {
      const response = await fetch(`/api/user/api-keys?platform=${platform}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success(`${platform.charAt(0).toUpperCase() + platform.slice(1)} API key deleted`, 'You can add it back anytime')
        refreshApiKeys() // Refresh the SWR cache
        // Clear form fields
        if (platform === 'polymarket') {
          setPolymarketKey('')
        } else {
          setKalshiAccessKeyId('')
          setKalshiPrivateKey('')
        }
      } else {
        const data = await response.json()
        toast.error('Failed to delete API key', data.error)
      }
    } catch (error) {
      toast.error('Error deleting API key', 'Please try again')
    } finally {
      setDeleting(null)
      setDeleteTarget(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-md" />
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-36" />
          </div>
          {/* Skeleton cards for API key sections */}
          {[1, 2].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-6 space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-72" />
              </div>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-9 w-48" />
            </div>
          ))}
        </div>
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
                  onClick={() => handleDeleteClick('polymarket')}
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
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
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
                  onClick={() => handleDeleteClick('kalshi')}
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
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
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
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
                spellCheck="false"
              />
            </div>
            <Button onClick={saveKalshiKeys} disabled={saving || !kalshiAccessKeyId || !kalshiPrivateKey}>
              {saving ? 'Saving...' : hasKalshi ? 'Update Kalshi API Keys' : 'Save Kalshi API Keys'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={`Delete ${deleteTarget ? deleteTarget.charAt(0).toUpperCase() + deleteTarget.slice(1) : ''} API Key?`}
        description="Are you sure you want to delete this API key? You can add it back at any time by entering it again."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={deleteApiKey}
      />

      {/* Redirect Confirmation Dialog */}
      <ConfirmDialog
        open={redirectConfirmOpen}
        onOpenChange={setRedirectConfirmOpen}
        title="API Key Saved!"
        description="Would you like to go back to the dashboard to see your markets?"
        confirmText="Go to Dashboard"
        cancelText="Stay Here"
        onConfirm={() => router.push('/dashboard')}
      />
    </div>
  )
}
