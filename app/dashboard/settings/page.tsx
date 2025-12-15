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
    <div className="min-h-screen bg-gray-950 p-8 relative overflow-hidden">
      {/* Futuristic Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:2rem_2rem] pointer-events-none" />

      {/* Gradient Overlay */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-emerald-500/10 blur-[120px] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto space-y-8">
        {/* Modern Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/dashboard')}
              className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            >
              <ArrowLeft className="h-5 w-5 text-gray-300" />
            </Button>
            <div>
              <h1 className="text-4xl font-black text-white tracking-tight mb-1">Settings</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Link
                  href="/dashboard"
                  className="hover:text-blue-400 transition-colors font-medium"
                >
                  Dashboard
                </Link>
                <span>/</span>
                <span className="text-gray-400">Settings</span>
              </div>
            </div>
          </div>
        </div>

        {/* Polymarket API Key - Modernized */}
        <div className="relative group">
          <div className="absolute -inset-[1px] bg-gradient-to-r from-blue-500/20 to-blue-600/20 rounded-2xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative bg-[#0e0f11]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            {/* Header with Icon */}
            <div className="px-8 py-6 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-b border-white/5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <span className="text-lg font-black text-blue-400">PM</span>
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-black text-white mb-1">Polymarket API</h2>
                  <p className="text-sm text-gray-400">
                    Connect your Polymarket account to enable live trading and real-time market data
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-8 py-6 space-y-6">
              {hasPolymarket && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <span className="text-emerald-400 text-xl">✓</span>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-emerald-400">Connected</div>
                      <div className="text-xs text-gray-400">Polymarket API is active and ready</div>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteClick('polymarket')}
                    disabled={deleting === 'polymarket'}
                    className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleting === 'polymarket' ? 'Removing...' : 'Remove'}
                  </Button>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">API Key</label>
                <input
                  type="text"
                  value={polymarketKey}
                  onChange={(e) => setPolymarketKey(e.target.value)}
                  placeholder={hasPolymarket ? "Enter new API key to replace existing" : "paste-your-polymarket-api-key-here"}
                  className="w-full px-5 py-4 bg-black/40 border border-white/10 rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 backdrop-blur-xl transition-all font-mono"
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  data-form-type="other"
                />
              </div>

              <Button
                onClick={savePolymarketKey}
                disabled={saving || !polymarketKey}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : hasPolymarket ? 'Update API Key' : 'Save API Key'}
              </Button>
            </div>
          </div>
        </div>

        {/* Kalshi API Keys - Modernized */}
        <div className="relative group">
          <div className="absolute -inset-[1px] bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 rounded-2xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative bg-[#0e0f11]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            {/* Header with Icon */}
            <div className="px-8 py-6 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-b border-white/5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <span className="text-lg font-black text-emerald-400">KL</span>
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-black text-white mb-1">Kalshi API</h2>
                  <p className="text-sm text-gray-400">
                    Connect your Kalshi account with Access Key ID and Private Key for trading access
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-8 py-6 space-y-6">
              {hasKalshi && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <span className="text-emerald-400 text-xl">✓</span>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-emerald-400">Connected</div>
                      <div className="text-xs text-gray-400">Kalshi API is active and ready</div>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteClick('kalshi')}
                    disabled={deleting === 'kalshi'}
                    className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleting === 'kalshi' ? 'Removing...' : 'Remove'}
                  </Button>
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">Access Key ID</label>
                  <input
                    type="text"
                    value={kalshiAccessKeyId}
                    onChange={(e) => setKalshiAccessKeyId(e.target.value)}
                    placeholder={hasKalshi ? "Enter new Access Key ID" : "your-kalshi-access-key-id"}
                    className="w-full px-5 py-4 bg-black/40 border border-white/10 rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 backdrop-blur-xl transition-all font-mono"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    data-form-type="other"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">Private Key <span className="text-xs text-gray-500 normal-case">(PEM format)</span></label>
                  <textarea
                    value={kalshiPrivateKey}
                    onChange={(e) => setKalshiPrivateKey(e.target.value)}
                    placeholder={hasKalshi ? "Enter new Private Key" : "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"}
                    rows={6}
                    className="w-full px-5 py-4 bg-black/40 border border-white/10 rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 backdrop-blur-xl transition-all font-mono resize-none"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    data-form-type="other"
                    spellCheck="false"
                  />
                </div>
              </div>

              <Button
                onClick={saveKalshiKeys}
                disabled={saving || !kalshiAccessKeyId || !kalshiPrivateKey}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : hasKalshi ? 'Update API Keys' : 'Save API Keys'}
              </Button>
            </div>
          </div>
        </div>
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
