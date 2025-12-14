'use client'

import { useState, useEffect } from 'react'
import { X, User, Key, Save, Loader2, Shield, Eye, EyeOff, Globe, Gauge, MousePointer2, Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

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
}

export function SettingsModal({
    isOpen,
    onClose,
    rotationSpeed = 0.05,
    onRotationSpeedChange,
    pauseOnHover = false,
    onPauseOnHoverChange,
    autoRotate = true,
    onAutoRotateChange
}: SettingsModalProps) {
    const [activeTab, setActiveTab] = useState<'profile' | 'api' | 'map'>('profile')
    const [isLoading, setIsLoading] = useState(false)
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})

    // API Key States
    const [keys, setKeys] = useState({
        polymarket: '',
        kalshiId: '',
        kalshiKey: ''
    })

    // Load existing configuration on mount
    useEffect(() => {
        if (isOpen) {
            // TODO: Fetch existing keys (masked) from API
            // fetch('/api/user/settings/keys')...
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

            // Show success toast?
            console.log('Keys saved successfully')
        } catch (error) {
            console.error('Error saving keys:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const toggleSecret = (field: string) => {
        setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }))
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-[#0e0f11] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                    <h2 className="text-lg font-bold text-white tracking-tight">Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 function hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-1 min-h-0">
                    {/* Sidebar */}
                    <div className="w-48 border-r border-white/5 bg-white/[0.02] p-4 space-y-2">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                                activeTab === 'profile'
                                    ? "bg-blue-500/10 text-blue-400"
                                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                            )}
                        >
                            <User className="w-4 h-4" />
                            Profile
                        </button>
                        <button
                            onClick={() => setActiveTab('api')}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                                activeTab === 'api'
                                    ? "bg-blue-500/10 text-blue-400"
                                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                            )}
                        >
                            <Key className="w-4 h-4" />
                            Connections
                        </button>
                        <button
                            onClick={() => setActiveTab('map')}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                                activeTab === 'map'
                                    ? "bg-blue-500/10 text-blue-400"
                                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                            )}
                        >
                            <Globe className="w-4 h-4" />
                            Map Settings
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">

                        {/* PROFILE TAB */}
                        {activeTab === 'profile' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-base font-semibold text-white mb-1">User Profile</h3>
                                    <p className="text-sm text-gray-500">Manage your account information and security.</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="grid gap-2">
                                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Email Address</label>
                                        <input
                                            type="email"
                                            value="user@example.com"
                                            disabled
                                            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-400 cursor-not-allowed"
                                        />
                                        <p className="text-[10px] text-gray-600">Email cannot be changed directly.</p>
                                    </div>

                                    <div className="grid gap-2">
                                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Username</label>
                                        <input
                                            type="text"
                                            defaultValue="SimulatedUser"
                                            className="bg-[#0e0f11] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-blue-500 outline-none transition-colors"
                                        />
                                    </div>

                                    <div className="pt-4 border-t border-white/5">
                                        <Button variant="outline" className="text-red-400 hover:text-red-300 border-red-500/20 hover:bg-red-500/10 w-full justify-start">
                                            <Shield className="w-4 h-4 mr-2" />
                                            Reset Password
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* API CONNECTIONS TAB */}
                        {activeTab === 'api' && (
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-base font-semibold text-white mb-1">API Connections</h3>
                                    <p className="text-sm text-gray-500">Connect your trading accounts to enable direct execution.</p>
                                </div>

                                {/* Polymarket */}
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">PM</div>
                                        <div>
                                            <h4 className="font-medium text-white text-sm">Polymarket</h4>
                                            <p className="text-xs text-gray-500">Polygon Wallet Proxy</p>
                                        </div>
                                    </div>

                                    <div className="grid gap-2 relative">
                                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Proxy Wallet Private Key</label>
                                        <div className="relative">
                                            <input
                                                type={showSecrets.poly ? "text" : "password"}
                                                placeholder="0x..."
                                                className="w-full bg-[#0e0f11] border border-white/10 rounded-lg pl-4 pr-10 py-2.5 text-sm text-white font-mono focus:border-blue-500 outline-none transition-colors"
                                                value={keys.polymarket}
                                                onChange={e => setKeys(prev => ({ ...prev, polymarket: e.target.value }))}
                                            />
                                            <button
                                                onClick={() => toggleSecret('poly')}
                                                className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300"
                                            >
                                                {showSecrets.poly ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-gray-500">Your key is encrypted and stored securely. Used only for trade execution.</p>
                                    </div>
                                </div>

                                {/* Kalshi */}
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400 font-bold text-xs">KL</div>
                                        <div>
                                            <h4 className="font-medium text-white text-sm">Kalshi</h4>
                                            <p className="text-xs text-gray-500">Regulated Exchange API</p>
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Access Key ID</label>
                                        <input
                                            type="text"
                                            placeholder="KK..."
                                            className="w-full bg-[#0e0f11] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white font-mono focus:border-green-500 outline-none transition-colors"
                                            value={keys.kalshiId}
                                            onChange={e => setKeys(prev => ({ ...prev, kalshiId: e.target.value }))}
                                        />
                                    </div>

                                    <div className="grid gap-2 relative">
                                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Private Key (PEM)</label>
                                        <div className="relative">
                                            <textarea
                                                placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                                                className="w-full bg-[#0e0f11] border border-white/10 rounded-lg pl-4 pr-10 py-2.5 text-xs text-white font-mono focus:border-green-500 outline-none transition-colors min-h-[100px]"
                                                value={keys.kalshiKey}
                                                onChange={e => setKeys(prev => ({ ...prev, kalshiKey: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                </div>

                            </div>
                        )}

                        {/* MAP SETTINGS TAB */}
                        {activeTab === 'map' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-base font-semibold text-white mb-1">Map Configuration</h3>
                                    <p className="text-sm text-gray-500">Customize how the globe behaves and interacts.</p>
                                </div>

                                {/* Auto Rotate Toggle */}
                                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                            {autoRotate ? (
                                                <Play className="w-5 h-5 text-blue-400" />
                                            ) : (
                                                <Pause className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-white">Auto Rotate</label>
                                            <p className="text-xs text-gray-400">Enable automatic globe rotation</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onAutoRotateChange?.(!autoRotate)}
                                        className={cn(
                                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                            autoRotate ? "bg-blue-500" : "bg-gray-700"
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                                autoRotate ? "translate-x-6" : "translate-x-1"
                                            )}
                                        />
                                    </button>
                                </div>

                                {/* Rotation Speed */}
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                            <Gauge className="w-5 h-5 text-blue-400" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-sm font-medium text-white block mb-1">
                                                Rotation Speed
                                            </label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="range"
                                                    min="0.01"
                                                    max="0.5"
                                                    step="0.01"
                                                    value={rotationSpeed}
                                                    onChange={(e) => onRotationSpeedChange?.(parseFloat(e.target.value))}
                                                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                    disabled={!autoRotate}
                                                />
                                                <span className="text-sm text-gray-300 w-12 text-right">
                                                    {(rotationSpeed * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                                                <span>Slow</span>
                                                <span>Fast</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Pause on Hover */}
                                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                            <MousePointer2 className="w-5 h-5 text-blue-400" />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-white">Pause on Hover</label>
                                            <p className="text-xs text-gray-400">Pause rotation when hovering over globe</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onPauseOnHoverChange?.(!pauseOnHover)}
                                        className={cn(
                                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                            pauseOnHover ? "bg-blue-500" : "bg-gray-700"
                                        )}
                                        disabled={!autoRotate}
                                    >
                                        <span
                                            className={cn(
                                                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                                pauseOnHover ? "translate-x-6" : "translate-x-1"
                                            )}
                                        />
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/5 bg-white/5 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} className="text-gray-400 hover:text-white hover:bg-white/10">
                        {activeTab === 'map' ? 'Done' : 'Cancel'}
                    </Button>
                    {(activeTab === 'profile' || activeTab === 'api') && (
                        <Button
                            onClick={handleSaveKeys}
                            disabled={isLoading}
                            className="bg-blue-600 hover:bg-blue-500 text-white min-w-[100px]"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Save Changes
                        </Button>
                    )}
                </div>

            </div>
        </div>
    )
}
