'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { X, User, Key, Save, Loader2, Shield, Eye, EyeOff, Globe, Gauge, MousePointer2, Play, Pause, Mail, Lock, Check, AlertCircle, Zap, Layers, MapPin, Maximize2, Minimize2, RotateCw, Sparkles, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { useToast } from '@/hooks/use-toast'

interface SettingsModalProps {
    isOpen: boolean
    onClose: () => void
    // Map Settings Props
    rotationSpeed?: number
    onRotationSpeedChange?: (speed: number) => void
    pauseOnHover?: boolean
    onPauseOnHoverChange?: (pause: boolean) => void
    autoRotate?: boolean
    onAutoRotateChange?: (rotate: boolean) => void
    showLabels?: boolean
    onShowLabelsChange?: (show: boolean) => void
    showGrid?: boolean
    onShowGridChange?: (show: boolean) => void
}


// Google Logo SVG Component
const GoogleIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
)

// X (Twitter) Logo SVG Component
const XIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
)

export function SettingsModal({
    isOpen,
    onClose,
    rotationSpeed = 0.05,
    onRotationSpeedChange,
    pauseOnHover = false,
    onPauseOnHoverChange,
    autoRotate = true,
    onAutoRotateChange,
    showLabels = true,
    onShowLabelsChange,
    showGrid = false,
    onShowGridChange
}: SettingsModalProps) {


    const { data: session } = useSession()
    const { toast } = useToast()
    const [activeTab, setActiveTab] = useState<'profile' | 'api' | 'map' | 'whats-new'>('profile')
    const [isLoading, setIsLoading] = useState(false)

    type OS = 'mac' | 'windows' | 'linux' | 'unknown';
    const [detectedOS, setDetectedOS] = useState<OS>('unknown');

    const getDetectOS = (): OS => {
        if (typeof window === 'undefined') return 'unknown';

        if ((navigator as any).userAgentData?.platform) {
            const platform = (navigator as any).userAgentData.platform.toLowerCase();
            if (platform.includes('mac')) return 'mac';
            if (platform.includes('win')) return 'windows';
            if (platform.includes('linux')) return 'linux';
        }

        const userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.includes('macintosh') || userAgent.includes('mac os')) return 'mac';
        if (userAgent.includes('windows') || userAgent.includes('win32') || userAgent.includes('win64')) return 'windows';
        if (userAgent.includes('linux') && !userAgent.includes('android')) return 'linux';

        return 'unknown';
    };

    useEffect(() => {
        if (isOpen) {
            setDetectedOS(getDetectOS());
        }
    }, [isOpen]);

    const DOWNLOAD_LINKS: Record<OS, string> = {
        mac: 'https://releases.edgepannel.com/download/EdgePannel-mac.dmg',
        windows: 'https://releases.edgepannel.com/download/EdgePannel-windows-setup.exe',
        linux: 'https://releases.edgepannel.com/download/EdgePannel-linux.AppImage',
        unknown: 'https://releases.edgepannel.com/download'
    };

    const DOWNLOAD_LABELS: Record<OS, string> = {
        mac: 'Download for macOS (.DMG)',
        windows: 'Download for Windows (.EXE)',
        linux: 'Download for Linux (.AppImage)',
        unknown: 'Download Desktop App'
    };
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
    const [authInfo, setAuthInfo] = useState<{
        providers: string[]
        hasPassword: boolean
        authEnabled: boolean
        user: { email: string; name: string | null; image: string | null } | null
    } | null>(null)
    const [authInfoLoading, setAuthInfoLoading] = useState(false)

    // Email change state
    const [isEditingEmail, setIsEditingEmail] = useState(false)
    const [newEmail, setNewEmail] = useState('')
    const [emailLoading, setEmailLoading] = useState(false)

    // API Key States
    const [keys, setKeys] = useState({
        polymarket: '',
        kalshiId: '',
        kalshiKey: ''
    })

    // Map settings state
    const [mapSettings, setMapSettings] = useState({
        zoomLevel: 1.0,
        markerSize: 1.0,
        animationDuration: 1000,
        showGrid: false,
        showLabels: true,
    })

    // Load linked auth providers when modal opens
    useEffect(() => {
        if (!isOpen) return

        let cancelled = false
        setAuthInfoLoading(true)

        fetch('/api/user/linked-accounts', { method: 'GET' })
            .then(async (res) => {
                const json = await res.json()
                if (!res.ok) throw new Error(json?.error || 'Failed to fetch linked accounts')
                if (!cancelled) {
                    setAuthInfo(json)
                    setNewEmail(json.user?.email || '')
                }
            })
            .catch((err) => {
                console.error('Error fetching linked accounts:', err)
                if (!cancelled) setAuthInfo(null)
            })
            .finally(() => {
                if (!cancelled) setAuthInfoLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [isOpen])

    const handleSaveKeys = async () => {
        setIsLoading(true)
        try {
            const response = await fetch('/api/user/settings/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(keys)
            })

            if (!response.ok) throw new Error('Failed to save keys')
            toast({ title: 'API keys saved successfully', variant: 'success' })
        } catch (error) {
            toast({ title: 'Failed to save API keys', variant: 'error' })
        } finally {
            setIsLoading(false)
        }
    }

    const handleUpdateEmail = async () => {
        if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
            toast({ title: 'Please enter a valid email address', variant: 'error' })
            return
        }

        setEmailLoading(true)
        try {
            const response = await fetch('/api/user/update-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newEmail })
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Failed to update email')
            }

            toast({ title: 'Email updated successfully', variant: 'success' })
            setIsEditingEmail(false)
            // Refresh auth info
            if (authInfo) {
                setAuthInfo({ ...authInfo, user: { ...authInfo.user!, email: newEmail } })
            }
        } catch (error: any) {
            toast({ title: error.message || 'Failed to update email', variant: 'error' })
        } finally {
            setEmailLoading(false)
        }
    }

    const toggleSecret = (field: string) => {
        setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }))
    }

    if (!isOpen) return null

    const providers = authInfo?.providers ?? []
    const authEnabled = authInfo?.authEnabled ?? true
    const hasGoogle = providers.includes('google')
    const hasX = providers.includes('twitter') || providers.includes('x')
    const hasPassword = authInfo?.hasPassword ?? false
    const displayedEmail = session?.user?.email || authInfo?.user?.email || 'Not signed in'
    const displayedName = session?.user?.name || authInfo?.user?.name || '—'

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-4xl bg-gradient-to-br from-[#0a0b0d] via-[#0e0f11] to-[#0a0b0d] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Modern Header with Gradient */}
                <div className="relative px-8 py-6 border-b border-white/10 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-blue-500/5">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-50" />
                    <div className="relative flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight mb-1">Settings</h2>
                            <p className="text-sm text-gray-400">Manage your account and preferences</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2.5 hover:bg-white/10 rounded-xl transition-all text-gray-400 hover:text-white group"
                        >
                            <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 min-h-0">
                    {/* Modern Sidebar */}
                    <div className="w-56 border-r border-white/5 bg-white/[0.01] p-4 space-y-1">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all relative group",
                                activeTab === 'profile'
                                    ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white shadow-lg shadow-blue-500/10 border border-blue-500/30"
                                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                            )}
                        >
                            {activeTab === 'profile' && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-purple-400 rounded-r-full" />
                            )}
                            <User className="w-4 h-4" />
                            Profile
                        </button>
                        <button
                            onClick={() => setActiveTab('api')}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all relative group",
                                activeTab === 'api'
                                    ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white shadow-lg shadow-blue-500/10 border border-blue-500/30"
                                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                            )}
                        >
                            {activeTab === 'api' && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-purple-400 rounded-r-full" />
                            )}
                            <Key className="w-4 h-4" />
                            API Keys
                        </button>
                        <button
                            onClick={() => setActiveTab('map')}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all relative group",
                                activeTab === 'map'
                                    ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white shadow-lg shadow-blue-500/10 border border-blue-500/30"
                                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                            )}
                        >
                            {activeTab === 'map' && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-purple-400 rounded-r-full" />
                            )}
                            <Globe className="w-4 h-4" />
                            Map Settings
                        </button>
                        <button
                            onClick={() => setActiveTab('whats-new')}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all relative group",
                                activeTab === 'whats-new'
                                    ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white shadow-lg shadow-blue-500/10 border border-blue-500/30"
                                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                            )}
                        >
                            {activeTab === 'whats-new' && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-purple-400 rounded-r-full" />
                            )}
                            <Sparkles className="w-4 h-4 text-cyan-400" />
                            What's New
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 p-8 overflow-y-auto scrollbar-hide">
                        {/* PROFILE TAB */}
                        {activeTab === 'profile' && (
                            <div className="space-y-8 max-w-2xl">
                                <div>
                                    <h3 className="text-xl font-black text-white mb-2">Account Settings</h3>
                                    <p className="text-sm text-gray-400">Manage your profile and authentication methods</p>
                                </div>

                                {/* Email Section */}
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-xl">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                            <Mail className="w-5 h-5 text-blue-400" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-white">Email Address</h4>
                                            <p className="text-xs text-gray-500">Your account email</p>
                                        </div>
                                    </div>
                                    {!isEditingEmail ? (
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <input
                                                    type="email"
                                                    value={displayedEmail}
                                                    disabled
                                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-300 cursor-not-allowed"
                                                />
                                            </div>
                                            <Button
                                                variant="outline"
                                                onClick={() => setIsEditingEmail(true)}
                                                className="ml-4 border-white/10 hover:bg-white/10"
                                            >
                                                Edit
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <input
                                                type="email"
                                                value={newEmail}
                                                onChange={(e) => setNewEmail(e.target.value)}
                                                placeholder="Enter new email"
                                                className="w-full bg-black/40 border border-blue-500/50 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                            />
                                            <div className="flex gap-2">
                                                <Button
                                                    onClick={handleUpdateEmail}
                                                    disabled={emailLoading}
                                                    className="bg-blue-600 hover:bg-blue-500 text-white"
                                                >
                                                    {emailLoading ? (
                                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                                                    ) : (
                                                        <><Check className="w-4 h-4 mr-2" /> Save</>
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setIsEditingEmail(false)
                                                        setNewEmail(displayedEmail)
                                                    }}
                                                    disabled={emailLoading}
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Social Connections */}
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-xl">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                            <Shield className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-white">Sign-in Methods</h4>
                                            <p className="text-xs text-gray-500">Connect social accounts for easy login</p>
                                        </div>
                                    </div>

                                    {authInfoLoading ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                {hasGoogle && (
                                                    <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/30 flex items-center gap-2">
                                                        <GoogleIcon className="w-3 h-3" />
                                                        Google
                                                    </span>
                                                )}
                                                {hasX && (
                                                    <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-gray-200 border border-white/20 flex items-center gap-2">
                                                        <XIcon className="w-3 h-3" />
                                                        X (Twitter)
                                                    </span>
                                                )}
                                                {!authInfoLoading && authEnabled && !hasPassword && !hasGoogle && !hasX && (
                                                    <span className="text-xs text-gray-500">No sign-in methods connected</span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <Button
                                                    variant="outline"
                                                    disabled={!authEnabled || hasGoogle}
                                                    onClick={() => signIn('google', { callbackUrl: window.location.href })}
                                                    className={cn(
                                                        "justify-center h-12 border-2 transition-all font-semibold",
                                                        hasGoogle
                                                            ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-300 cursor-not-allowed"
                                                            : "bg-white hover:bg-gray-50 border-gray-300 text-gray-700 hover:border-gray-400"
                                                    )}
                                                >
                                                    {hasGoogle ? (
                                                        <><Check className="w-4 h-4 mr-2" /> Connected</>
                                                    ) : (
                                                        <><GoogleIcon className="mr-2" /> Connect Google</>
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    disabled={!authEnabled || hasX}
                                                    onClick={() => signIn('twitter', { callbackUrl: window.location.href })}
                                                    className={cn(
                                                        "justify-center h-12 border-2 transition-all font-semibold",
                                                        hasX
                                                            ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-300 cursor-not-allowed"
                                                            : "bg-black hover:bg-gray-900 border-gray-800 text-white hover:border-gray-700"
                                                    )}
                                                >
                                                    {hasX ? (
                                                        <><Check className="w-4 h-4 mr-2" /> Connected</>
                                                    ) : (
                                                        <><XIcon className="mr-2" /> Connect X</>
                                                    )}
                                                </Button>
                                            </div>
                                            {!authEnabled && (
                                                <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
                                                    <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5" />
                                                    <p className="text-xs text-amber-300/90">Auth is disabled in development mode</p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* API CONNECTIONS TAB */}
                        {activeTab === 'api' && (
                            <div className="space-y-8 max-w-2xl">
                                <div>
                                    <h3 className="text-xl font-black text-white mb-2">API Connections</h3>
                                    <p className="text-sm text-gray-400">Connect your trading accounts for direct execution</p>
                                </div>

                                {/* Polymarket */}
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 backdrop-blur-xl">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/30 to-blue-600/20 flex items-center justify-center border border-blue-500/30">
                                            <span className="text-lg font-black text-blue-400">PM</span>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-white">Polymarket</h4>
                                            <p className="text-xs text-gray-400">Polygon Wallet Proxy</p>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type={showSecrets.poly ? "text" : "password"}
                                            placeholder="0x..."
                                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50"
                                            value={keys.polymarket}
                                            onChange={e => setKeys(prev => ({ ...prev, polymarket: e.target.value }))}
                                        />
                                        <button
                                            onClick={() => toggleSecret('poly')}
                                            className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-300"
                                        >
                                            {showSecrets.poly ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Encrypted and stored securely</p>
                                </div>

                                {/* Kalshi */}
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 backdrop-blur-xl">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 flex items-center justify-center border border-emerald-500/30">
                                            <span className="text-lg font-black text-emerald-400">KL</span>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-white">Kalshi</h4>
                                            <p className="text-xs text-gray-400">Regulated Exchange API</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <input
                                            type="text"
                                            placeholder="Access Key ID"
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50"
                                            value={keys.kalshiId}
                                            onChange={e => setKeys(prev => ({ ...prev, kalshiId: e.target.value }))}
                                        />
                                        <div className="relative">
                                            <textarea
                                                placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 min-h-[120px] resize-none"
                                                value={keys.kalshiKey}
                                                onChange={e => setKeys(prev => ({ ...prev, kalshiKey: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    onClick={handleSaveKeys}
                                    disabled={isLoading}
                                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-3 rounded-xl shadow-lg"
                                >
                                    {isLoading ? (
                                        <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Saving...</>
                                    ) : (
                                        <><Save className="w-5 h-5 mr-2" /> Save API Keys</>
                                    )}
                                </Button>
                            </div>
                        )}

                        {/* MAP SETTINGS TAB */}
                        {activeTab === 'map' && (
                            <div className="space-y-6 max-w-2xl">
                                <div>
                                    <h3 className="text-xl font-black text-white mb-2">Map & Globe Configuration</h3>
                                    <p className="text-sm text-gray-400">Customize visualization and interaction settings</p>
                                </div>

                                {/* Auto Rotate */}
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-xl">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                                {autoRotate ? <Play className="w-5 h-5 text-blue-400" /> : <Pause className="w-5 h-5 text-gray-400" />}
                                            </div>
                                            <div>
                                                <label className="text-sm font-semibold text-white">Auto Rotate</label>
                                                <p className="text-xs text-gray-400">Enable automatic globe rotation</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onAutoRotateChange?.(!autoRotate)}
                                            className={cn(
                                                "relative inline-flex h-7 w-12 items-center rounded-full transition-colors shadow-inner",
                                                autoRotate ? "bg-blue-500" : "bg-gray-700"
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-lg",
                                                    autoRotate ? "translate-x-6" : "translate-x-1"
                                                )}
                                            />
                                        </button>
                                    </div>
                                </div>

                                {/* Rotation Speed */}
                                {autoRotate && (
                                    <div className="p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-xl">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                                <Gauge className="w-5 h-5 text-blue-400" />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-sm font-semibold text-white block mb-1">
                                                    Rotation Speed
                                                </label>
                                                <div className="flex items-center gap-4">
                                                    <input
                                                        type="range"
                                                        min="0.01"
                                                        max="0.5"
                                                        step="0.01"
                                                        value={rotationSpeed}
                                                        onChange={(e) => onRotationSpeedChange?.(parseFloat(e.target.value))}
                                                        className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                    />
                                                    <span className="text-sm font-semibold text-gray-300 w-16 text-right">
                                                        {Math.round(rotationSpeed * 100)}%
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                    <span>Slow</span>
                                                    <span>Fast</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Pause on Hover */}
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-xl">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                                <MousePointer2 className="w-5 h-5 text-blue-400" />
                                            </div>
                                            <div>
                                                <label className="text-sm font-semibold text-white">Pause on Hover</label>
                                                <p className="text-xs text-gray-400">Pause rotation when hovering</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onPauseOnHoverChange?.(!pauseOnHover)}
                                            className={cn(
                                                "relative inline-flex h-7 w-12 items-center rounded-full transition-colors shadow-inner",
                                                pauseOnHover ? "bg-blue-500" : "bg-gray-700",
                                                !autoRotate && "opacity-50 cursor-not-allowed"
                                            )}
                                            disabled={!autoRotate}
                                        >
                                            <span
                                                className={cn(
                                                    "inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-lg",
                                                    pauseOnHover ? "translate-x-6" : "translate-x-1"
                                                )}
                                            />
                                        </button>
                                    </div>
                                </div>

                                {/* Additional Map Settings */}
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-xl">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                            <Layers className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-white">Display Options</h4>
                                            <p className="text-xs text-gray-400">Customize map appearance</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-black/20">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-gray-400" />
                                                <span className="text-sm text-gray-300">Show Labels</span>
                                            </div>
                                            <button
                                                onClick={() => onShowLabelsChange?.(!showLabels)}
                                                className={cn(
                                                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                                    showLabels ? "bg-blue-500" : "bg-gray-700"
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                                        showLabels ? "translate-x-6" : "translate-x-1"
                                                    )}
                                                />
                                            </button>

                                        </div>
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-black/20">
                                            <div className="flex items-center gap-2">
                                                <Zap className="w-4 h-4 text-gray-400" />
                                                <span className="text-sm text-gray-300">Show Grid</span>
                                            </div>
                                            <button
                                                onClick={() => onShowGridChange?.(!showGrid)}
                                                className={cn(
                                                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                                    showGrid ? "bg-blue-500" : "bg-gray-700"
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                                        showGrid ? "translate-x-6" : "translate-x-1"
                                                    )}
                                                />
                                            </button>

                                        </div>
                                    </div>
                                </div>

                                {/* Zoom & Marker Settings */}
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-xl">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                            <Maximize2 className="w-5 h-5 text-amber-400" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-sm font-semibold text-white mb-1">Zoom Level</h4>
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="range"
                                                    min="0.5"
                                                    max="2.0"
                                                    step="0.1"
                                                    value={mapSettings.zoomLevel}
                                                    onChange={(e) => setMapSettings({ ...mapSettings, zoomLevel: parseFloat(e.target.value) })}
                                                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                                />
                                                <span className="text-sm font-semibold text-gray-300 w-16 text-right">
                                                    {mapSettings.zoomLevel.toFixed(1)}x
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 mt-4">
                                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                            <MapPin className="w-5 h-5 text-amber-400" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-sm font-semibold text-white mb-1">Marker Size</h4>
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="range"
                                                    min="0.5"
                                                    max="2.0"
                                                    step="0.1"
                                                    value={mapSettings.markerSize}
                                                    onChange={(e) => setMapSettings({ ...mapSettings, markerSize: parseFloat(e.target.value) })}
                                                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                                />
                                                <span className="text-sm font-semibold text-gray-300 w-16 text-right">
                                                    {mapSettings.markerSize.toFixed(1)}x
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* WHAT'S NEW TAB */}
                        {activeTab === 'whats-new' && (
                            <div className="space-y-6 max-w-2xl">
                                <div>
                                    <h3 className="text-xl font-black text-white mb-2">What's New in EdgePannel</h3>
                                    <p className="text-sm text-gray-400">Track latest features, visual upgrades, and platform releases</p>
                                </div>

                                {/* Premium Desktop App Download Banner */}
                                <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent border border-white/10 backdrop-blur-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
                                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                                        <div className="space-y-2 text-left">
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-bold text-cyan-400 tracking-wider uppercase">
                                                DESKTOP PLATFORM
                                            </div>
                                            <h4 className="text-lg font-black text-white">Get EdgePannel Desktop</h4>
                                            <p className="text-xs text-gray-400 max-w-md">
                                                Unlock hardware-accelerated 3D rendering, global custom hotkeys, multi-monitor widget dock layouts, and local-first memory cache.
                                            </p>
                                        </div>

                                        {/* Dynamic CTA Button */}
                                        <div className="flex flex-col items-center gap-2 flex-shrink-0">
                                            <a
                                                href={DOWNLOAD_LINKS[detectedOS]}
                                                className="bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-bold py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 hover:scale-[1.02] active:scale-[0.98] transition-all text-xs tracking-wide pointer-events-auto"
                                            >
                                                <Download className="w-4 h-4" />
                                                {DOWNLOAD_LABELS[detectedOS]}
                                            </a>
                                            
                                            {/* Manual Fallbacks */}
                                            <div className="text-[10px] text-gray-500 flex gap-2">
                                                <span>Or download for:</span>
                                                <a href={DOWNLOAD_LINKS.mac} className="text-gray-400 hover:text-white underline pointer-events-auto">macOS</a> •
                                                <a href={DOWNLOAD_LINKS.windows} className="text-gray-400 hover:text-white underline pointer-events-auto">Windows</a> •
                                                <a href={DOWNLOAD_LINKS.linux} className="text-gray-400 hover:text-white underline pointer-events-auto">Linux</a>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Release Notes Timeline */}
                                <div className="space-y-6 mt-4">
                                    <div className="relative pl-6 border-l border-white/10 space-y-8">
                                        
                                        {/* Release 1: Real-Time OSINT */}
                                        <div className="relative text-left">
                                            {/* Glowing Dot indicator */}
                                            <div className="absolute -left-[32px] top-1 w-4 h-4 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center">
                                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold font-mono text-cyan-400">v2.4.0</span>
                                                    <span className="text-[10px] text-gray-500">— MAY 2026</span>
                                                </div>
                                                <h4 className="text-sm font-bold text-white">Advanced Real-Time OSINT Telemetry Layers</h4>
                                                <p className="text-xs text-gray-400 leading-relaxed">
                                                    Integrated three new high-fidelity GIS overlays displaying real-time global datasets directly onto the map and 3D globe:
                                                </p>
                                                <ul className="text-xs text-gray-400 space-y-1 pl-4 list-disc">
                                                    <li><strong className="text-white">USNI Navy Fleet Tracker:</strong> Active global deployment positions and operational briefs for Carrier Strike Groups.</li>
                                                    <li><strong className="text-white">Celestrak Satellite Orbit Tracker:</strong> Real-time orbital propagation and trajectory rendering for visible spacecraft (ISS, Hubble, Tiangong).</li>
                                                    <li><strong className="text-white">GPS Jamming Radar:</strong> Geodesic signal denial vectors mapped over Baltic Sea, Levant, Crimea, and Red Sea corridors.</li>
                                                </ul>
                                            </div>
                                        </div>

                                        {/* Release 2: Dashboard fixes */}
                                        <div className="relative text-left">
                                            <div className="absolute -left-[32px] top-1 w-4 h-4 rounded-full bg-purple-500/20 border border-purple-400 flex items-center justify-center">
                                                <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold font-mono text-purple-400">v2.3.0</span>
                                                    <span className="text-[10px] text-gray-500">— APR 2026</span>
                                                </div>
                                                <h4 className="text-sm font-bold text-white">Dashboard Telemetry & GIS Integration Repairs</h4>
                                                <p className="text-xs text-gray-400 leading-relaxed">
                                                    Overhauled core dashboard integrations to resolve connection and display failures:
                                                </p>
                                                <ul className="text-xs text-gray-400 space-y-1 pl-4 list-disc">
                                                    <li><strong className="text-white">Fires & Operational Risk:</strong> Re-anchored to NASA's public keyless thermal anomalies GIS raster overlay.</li>
                                                    <li><strong className="text-white">Economic Indicators:</strong> Created a fail-safe offline local fallback service for historical GDP, Fed Funds rates, and M2 money supply parameters.</li>
                                                    <li><strong className="text-white">Sector Heatmap:</strong> Integrated an interactive stock sector yield Breakdown panel within hover popups and full details sidebar views.</li>
                                                </ul>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-4 border-t border-white/10 bg-white/[0.01] flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} className="text-gray-400 hover:text-white hover:bg-white/10">
                        {activeTab === 'map' ? 'Done' : 'Close'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
