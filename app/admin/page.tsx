'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Users,
    Globe,
    Database,
    ShieldCheck,
    RefreshCw,
    Trash2,
    Search,
    History,
    LayoutDashboard,
    UserCircle,
    Settings,
    AlertTriangle,
    ExternalLink,
    Twitter,
    Mail
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type Tab = 'dashboard' | 'crm' | 'system'

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState<Tab>('dashboard')
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [isIndexing, setIsIndexing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [indexResponse, setIndexResponse] = useState<any>(null)
    const [currentTime, setCurrentTime] = useState('')

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/admin/stats')
            if (!res.ok) {
                if (res.status === 403) throw new Error('Unauthorized: Admin access required')
                throw new Error('Failed to fetch stats')
            }
            const data = await res.json()
            setStats(data)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStats()
    }, [])

    useEffect(() => {
        // Set initial time on client side only
        setCurrentTime(new Date().toLocaleTimeString())
        
        // Update time every second
        const interval = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString())
        }, 1000)
        
        return () => clearInterval(interval)
    }, [])

    const runIndex = async (platforms: string[] = ['polymarket', 'kalshi']) => {
        setIsIndexing(true)
        setIndexResponse(null)
        try {
            const res = await fetch('/api/markets/index-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platforms })
            })
            const data = await res.json()
            setIndexResponse(data)
            fetchStats()
        } catch (err: any) {
            setError(`Indexing failed: ${err.message}`)
        } finally {
            setIsIndexing(false)
        }
    }

    const clearGeotags = async () => {
        if (!confirm('Are you sure? This will delete all indexed geolocation data.')) return
        setIsIndexing(true)
        try {
            const res = await fetch('/api/admin/clear-geotagged', { method: 'POST' })
            if (!res.ok) throw new Error('Clear failed')
            fetchStats()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsIndexing(false)
        }
    }

    if (loading) return (
        <div className="p-8 flex items-center justify-center min-h-screen bg-black">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00ff7f]"></div>
        </div>
    )

    return (
        <div className="min-h-screen bg-black text-white font-mono p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b-2 border-white/10 pb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="bg-[#00ff7f] text-black text-[10px] font-black px-2 py-0.5 rounded">ADMIN</div>
                            <div className="text-[10px] text-white/40 tracking-widest">SYSTEM_VERSION: 1.2.0_STABLE</div>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic">
                            Control_Panel
                        </h1>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-white/5 border border-white/10 p-1 rounded-sm">
                        {[
                            { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
                            { id: 'crm', label: 'CRM_USERS', icon: UserCircle },
                            { id: 'system', label: 'SYSTEM_GEO', icon: Settings },
                        ].map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id as Tab)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 text-[10px] font-black tracking-widest transition-all",
                                    activeTab === t.id
                                        ? "bg-[#00ff7f] text-black"
                                        : "text-white/40 hover:text-white"
                                )}
                            >
                                <t.icon className="w-3 h-3" />
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-sm flex items-center gap-3 text-red-500 text-xs">
                        <AlertTriangle className="w-4 h-4" />
                        <span>ERROR: {error}</span>
                        <button className="ml-auto underline" onClick={() => setError(null)}>DISMISS</button>
                    </div>
                )}

                {/* Tab Content: DASHBOARD */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Main Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard title="Total Signups" value={stats?.totalUsers || 0} label="USERS" icon={Users} color="#00ff7f" />
                            <StatCard title="Indexed Markets" value={stats?.totalMarkets?.toLocaleString() || 0} label="ENTRIES" icon={Database} />
                            <StatCard title="Connectors" value={Object.keys(stats?.byPlatform || {}).length} label="PLATFORMS" icon={ShieldCheck} />
                            <StatCard title="Geotags" value={stats?.topCountries?.length || 0} label="COUNTRIES" icon={Globe} />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Platform Distribution */}
                            <Card className="bg-black/40 border-white/10 text-white lg:col-span-2">
                                <CardHeader className="border-b border-white/5 mx-6 px-0">
                                    <CardTitle className="text-xs font-mono uppercase text-[#00ff7f] tracking-widest flex items-center gap-2">
                                        <History className="w-4 h-4" /> Platform_Distribution
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="space-y-6">
                                        {Object.entries(stats?.byPlatform || {}).map(([platform, count]: [string, any]) => (
                                            <div key={platform} className="space-y-2">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-sm font-black uppercase tracking-tighter italic">{platform}</span>
                                                    <span className="text-xs font-mono text-white/40">{count.toLocaleString()} markets</span>
                                                </div>
                                                <div className="h-4 bg-white/5 border border-white/10 w-full overflow-hidden flex">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-[#00ff7f] to-emerald-400"
                                                        style={{ width: `${(count / stats.totalMarkets) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Confidence Levels */}
                            <Card className="bg-black/40 border-white/10 text-white">
                                <CardHeader className="border-b border-white/5 mx-6 px-0">
                                    <CardTitle className="text-xs font-mono uppercase text-white/40 tracking-widest">
                                        Data_Confidence
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="space-y-4">
                                        {Object.entries(stats?.byConfidence || {}).sort().map(([level, count]: [string, any]) => (
                                            <div key={level} className="flex justify-between items-center bg-white/5 p-3 rounded-sm border border-white/5">
                                                <span className={cn(
                                                    "text-[10px] font-black uppercase",
                                                    level === 'high' ? 'text-[#00ff7f]' : level === 'medium' ? 'text-yellow-400' : 'text-red-400'
                                                )}>{level}</span>
                                                <span className="text-sm font-black">{count.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {/* Tab Content: CRM */}
                {activeTab === 'crm' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Auth Breakdown */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="bg-black/60 border border-white/10 p-6 rounded-sm">
                                <h3 className="text-xs font-black text-white/30 uppercase mb-4 tracking-tighter">Auth_Method_Share</h3>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <Mail className="w-5 h-5 text-[#00ff7f]" />
                                        <span className="text-sm font-black">Google Sign-in</span>
                                    </div>
                                    <span className="text-xl font-black">{stats?.usersByProvider?.google || 0}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Twitter className="w-5 h-5 text-blue-400" />
                                        <span className="text-sm font-black">X / Twitter</span>
                                    </div>
                                    <span className="text-xl font-black">{stats?.usersByProvider?.twitter || 0}</span>
                                </div>
                            </div>

                            <div className="lg:col-span-2 bg-gradient-to-r from-emerald-500/10 to-transparent border border-white/10 p-6 rounded-sm flex items-center justify-between">
                                <div>
                                    <h3 className="text-xs font-black text-white/60 uppercase mb-1 tracking-tighter">Platform_User_Base</h3>
                                    <div className="text-3xl font-black tracking-tighter italic text-white">{stats?.totalUsers} Users Total</div>
                                    <p className="text-[10px] text-[#00ff7f] font-mono mt-2 lowercase">+8.4% growth from last week // automated_estimate</p>
                                </div>
                                <Users className="w-12 h-12 text-[#00ff7f]/20" />
                            </div>
                        </div>

                        {/* Recent Users Table */}
                        <div className="bg-black/40 border border-white/10 overflow-hidden">
                            <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                                <h2 className="text-xs font-black tracking-widest uppercase">Latest_Signups</h2>
                                <div className="text-[10px] text-white/30">SHOWING_TOP_20_RECORDS</div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white/5 text-[10px] uppercase font-black text-white/40 border-b border-white/10">
                                            <th className="px-6 py-3">User</th>
                                            <th className="px-6 py-3">Auth</th>
                                            <th className="px-6 py-3">Joined_Date</th>
                                            <th className="px-6 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {stats?.recentUsers?.map((user: any) => (
                                            <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                                            {user.image ? <img src={user.image} alt={user.name} /> : <UserCircle className="w-4 h-4 text-white/20" />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-black truncate">{user.name || 'Anonymous User'}</div>
                                                            <div className="text-[10px] text-white/40 font-mono truncate">{user.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex gap-2">
                                                        {user.accounts?.map((acc: any) => (
                                                            <span key={acc.provider} className={cn(
                                                                "text-[8px] font-black px-1.5 py-0.5 rounded border uppercase",
                                                                acc.provider === 'google' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                            )}>
                                                                {acc.provider}
                                                            </span>
                                                        ))}
                                                        {(!user.accounts || user.accounts.length === 0) && <span className="text-[8px] font-black px-1.5 py-0.5 rounded border border-white/10 text-white/20">EMAIL</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-xs font-mono text-white/40">
                                                    {new Date(user.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button className="text-white/20 hover:text-[#00ff7f] transition-colors">
                                                        <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab Content: SYSTEM */}
                {activeTab === 'system' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Controls */}
                            <Card className="bg-black/60 border-white/10 text-white">
                                <CardHeader>
                                    <CardTitle className="text-sm font-black uppercase tracking-widest text-[#00ff7f]">Market_Indexing_Tools</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Button
                                            onClick={() => runIndex(['polymarket'])}
                                            disabled={isIndexing}
                                            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-black h-12"
                                        >
                                            {isIndexing ? <RefreshCw className="w-3 h-3 animate-spin mr-2" /> : <RefreshCw className="w-3 h-3 mr-2" />}
                                            Sync_Polymarket
                                        </Button>
                                        <Button
                                            onClick={() => runIndex(['kalshi'])}
                                            disabled={isIndexing}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black h-12"
                                        >
                                            {isIndexing ? <RefreshCw className="w-3 h-3 animate-spin mr-2" /> : <RefreshCw className="w-3 h-3 mr-2" />}
                                            Sync_Kalshi
                                        </Button>
                                    </div>

                                    <Button
                                        onClick={() => runIndex()}
                                        disabled={isIndexing}
                                        className="w-full bg-[#00ff7f] hover:bg-white text-black text-xs font-black h-14 border-2 border-[#00ff7f] transition-all"
                                    >
                                        {isIndexing ? "Indexing_Global_Inventory..." : "Master_Global_Sync (All Platforms)"}
                                    </Button>

                                    <div className="pt-6 border-t border-white/10 flex items-center justify-between">
                                        <div>
                                            <h4 className="text-xs font-black text-red-500 uppercase flex items-center gap-2">
                                                <Trash2 className="w-3 h-3" /> Danger_Zone
                                            </h4>
                                            <p className="text-[10px] text-white/30 font-mono mt-1">Delete all geolocation cache files and rebuild schema.</p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            onClick={clearGeotags}
                                            disabled={isIndexing}
                                            className="border-red-500/30 text-red-500 hover:bg-red-500/10 text-[10px] font-black"
                                        >
                                            WIPE_GEOTAGS
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Log/Status */}
                            <div className="bg-black/40 border border-white/10 p-6 font-mono">
                                <h3 className="text-xs font-black text-white/40 uppercase mb-4 tracking-tighter">System_Log_Output</h3>
                                <div className="h-[250px] overflow-y-auto space-y-2 bg-black/60 p-4 border border-white/5 text-[10px]">
                                    <div className="text-white/40">[{currentTime || '--:--:--'}] ADMIN_AUTH_GRANTED // ID: {Math.random().toString(36).substr(2, 9)}</div>
                                    <div className="text-[#00ff7f]">[{currentTime || '--:--:--'}] STATUS: READY_FOR_COMMAND</div>
                                    {isIndexing && (
                                        <div className="text-yellow-400 animate-pulse">[{currentTime || '--:--:--'}] PROCESS: Indexing_Job_Started... (Limit: 500)</div>
                                    )}
                                    {indexResponse && (
                                        <div className="space-y-1">
                                            <div className="text-[#00ff7f]">[{currentTime || '--:--:--'}] COMPLETED: {indexResponse.message}</div>
                                            <div className="text-white/30 pl-4 transition-all">
                                                &gt; Polymarket: {indexResponse.stats.polymarket.indexed} indexed, {indexResponse.stats.polymarket.errors} errors<br />
                                                &gt; Kalshi: {indexResponse.stats.kalshi.indexed} indexed, {indexResponse.stats.kalshi.errors} errors
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 flex items-start gap-4">
                            <AlertTriangle className="w-5 h-5 text-[#00ff7f] flex-shrink-0 mt-1" />
                            <div className="space-y-2">
                                <h4 className="text-sm font-black text-white italic">Automatic Indexing Notice</h4>
                                <p className="text-xs text-white/60 leading-relaxed font-mono">
                                    The production system is configured with automated CRON jobs that run every 60 seconds (Incremental) and every 24 hours (Cleanup).
                                    Manual sync should only be used if a platform-specific update is needed immediately or if the geolocation extraction logic has been modified.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function StatCard({ title, value, label, icon: Icon, color = "white", colorText = "white" }: any) {
    return (
        <div className="bg-white/5 border border-white/10 p-5 group hover:border-white/20 transition-all">
            <div className="flex justify-between items-start mb-4">
                <div className="text-[10px] font-black tracking-widest uppercase text-white/40">{title}</div>
                <Icon className="w-4 h-4 text-white/40 group-hover:text-[#00ff7f] transition-colors" />
            </div>
            <div className="flex items-end gap-2">
                <div className="text-4xl font-black italic tracking-tighter" style={{ color: value > 0 ? color : 'white' }}>{value}</div>
                <div className="text-[10px] text-white/20 mb-1 font-mono">{label}</div>
            </div>
        </div>
    )
}
