'use client'

/**
 * Redis Monitoring Dashboard
 *
 * Comprehensive Redis monitoring and management interface:
 * - Real-time connection health and performance metrics
 * - Memory usage and fragmentation monitoring
 * - Cache hit rate tracking
 * - Key statistics by namespace
 * - Slow query log viewer
 * - Management tools (clear cache, inspect keys)
 */

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Database, Gauge, Activity, Clock, Trash2, Search, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface RedisStats {
  connection: {
    available: boolean
    connected: boolean
    uptime: number | null
    connectedClients: number | null
  }
  memory: {
    usedMemory: number | null
    usedMemoryHuman: string | null
    usedMemoryPeak: number | null
    usedMemoryPeakHuman: string | null
    maxMemory: number | null
    maxMemoryHuman: string | null
    fragmentation: number | null
  }
  performance: {
    commandsProcessed: number | null
    instantaneousOpsPerSec: number | null
    latencyMs: number | null
    hitRate: number | null
    keyspaceHits: number | null
    keyspaceMisses: number | null
  }
  keyspace: {
    totalKeys: number
    namespaces: Array<{
      namespace: string
      keys: number
      expires: number
    }>
  }
  slowLog: Array<{
    id: number
    timestamp: number
    duration: number
    command: string[]
  }>
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function RedisMonitoringPage() {
  const [stats, setStats] = useState<RedisStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [inspectKey, setInspectKey] = useState('')
  const [inspectResult, setInspectResult] = useState<any>(null)
  const [searchPattern, setSearchPattern] = useState('*')
  const [searchResults, setSearchResults] = useState<any>(null)

  // Historical data for charts
  const [historyData, setHistoryData] = useState<Array<{
    timestamp: string
    opsPerSec: number
    latency: number
    hitRate: number
    memory: number
  }>>([])

  // Fetch Redis statistics
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/redis/stats')
      if (!res.ok) throw new Error('Failed to fetch stats')

      const data = await res.json()
      setStats(data)

      // Update history
      if (data.connection.connected) {
        const newEntry = {
          timestamp: new Date().toLocaleTimeString(),
          opsPerSec: data.performance.instantaneousOpsPerSec || 0,
          latency: data.performance.latencyMs || 0,
          hitRate: (data.performance.hitRate || 0) * 100,
          memory: data.memory.usedMemory || 0
        }

        setHistoryData(prev => {
          const updated = [...prev, newEntry]
          // Keep last 20 data points
          return updated.slice(-20)
        })
      }

      setLoading(false)
    } catch (error) {
      console.error('Error fetching Redis stats:', error)
      toast.error('Failed to fetch Redis statistics')
      setLoading(false)
    }
  }

  // Clear cache by namespace
  const handleClearCache = async (namespace: string) => {
    if (!confirm(`Are you sure you want to clear all "${namespace}" cache entries?`)) {
      return
    }

    try {
      const res = await fetch('/api/admin/redis/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear', namespace })
      })

      if (!res.ok) throw new Error('Failed to clear cache')

      const data = await res.json()
      toast.success(`Cleared ${data.cleared} keys from ${namespace}`)
      fetchStats()
    } catch (error) {
      console.error('Error clearing cache:', error)
      toast.error('Failed to clear cache')
    }
  }

  // Inspect key
  const handleInspectKey = async () => {
    if (!inspectKey.trim()) return

    try {
      const res = await fetch('/api/admin/redis/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'inspect', key: inspectKey })
      })

      if (!res.ok) throw new Error('Failed to inspect key')

      const data = await res.json()
      setInspectResult(data)
    } catch (error) {
      console.error('Error inspecting key:', error)
      toast.error('Failed to inspect key')
    }
  }

  // Search keys
  const handleSearchKeys = async () => {
    try {
      const res = await fetch('/api/admin/redis/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'keys', pattern: searchPattern, limit: 100 })
      })

      if (!res.ok) throw new Error('Failed to search keys')

      const data = await res.json()
      setSearchResults(data)
    } catch (error) {
      console.error('Error searching keys:', error)
      toast.error('Failed to search keys')
    }
  }

  // Delete key
  const handleDeleteKey = async (key: string) => {
    if (!confirm(`Delete key: ${key}?`)) return

    try {
      const res = await fetch('/api/admin/redis/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', key })
      })

      if (!res.ok) throw new Error('Failed to delete key')

      toast.success('Key deleted successfully')
      handleSearchKeys()
    } catch (error) {
      console.error('Error deleting key:', error)
      toast.error('Failed to delete key')
    }
  }

  // Auto-refresh effect
  useEffect(() => {
    fetchStats()

    if (autoRefresh) {
      const interval = setInterval(fetchStats, 5000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  // Format uptime
  const formatUptime = (seconds: number | null): string => {
    if (!seconds) return 'N/A'
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}d ${hours}h ${minutes}m`
  }

  // Format bytes
  const formatBytes = (bytes: number | null): string => {
    if (!bytes) return 'N/A'
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!stats?.connection.available) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Redis Unavailable
            </CardTitle>
            <CardDescription>
              Redis is not available. Check your connection settings.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Redis Monitoring</h1>
          <p className="text-muted-foreground">Real-time Redis metrics and management</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className="h-4 w-4 mr-2" />
            {autoRefresh ? 'Auto-Refresh On' : 'Auto-Refresh Off'}
          </Button>
          <Button variant="outline" onClick={fetchStats}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Connection Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={stats.connection.connected ? "default" : "destructive"}>
                {stats.connection.connected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Uptime</p>
              <p className="text-lg font-semibold">{formatUptime(stats.connection.uptime)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Connected Clients</p>
              <p className="text-lg font-semibold">{stats.connection.connectedClients || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Latency</p>
              <p className="text-lg font-semibold">{stats.performance.latencyMs?.toFixed(2) || 'N/A'} ms</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Gauge className="h-4 w-4" />
              Operations/sec
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.performance.instantaneousOpsPerSec || 0}</p>
            <p className="text-sm text-muted-foreground">Current throughput</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4" />
              Cache Hit Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{((stats.performance.hitRate || 0) * 100).toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground">
              {stats.performance.keyspaceHits || 0} hits / {stats.performance.keyspaceMisses || 0} misses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4" />
              Memory Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.memory.usedMemoryHuman || 'N/A'}</p>
            <p className="text-sm text-muted-foreground">
              Fragmentation: {stats.memory.fragmentation?.toFixed(2) || 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {historyData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Operations Per Second</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={historyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="opsPerSec" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Latency (ms)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={historyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="latency" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="keyspace" className="w-full">
        <TabsList>
          <TabsTrigger value="keyspace">Keyspace</TabsTrigger>
          <TabsTrigger value="slowlog">Slow Log</TabsTrigger>
          <TabsTrigger value="manage">Management</TabsTrigger>
        </TabsList>

        {/* Keyspace Tab */}
        <TabsContent value="keyspace" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Key Statistics by Namespace</CardTitle>
              <CardDescription>Total Keys: {stats.keyspace.totalKeys}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={stats.keyspace.namespaces}
                      dataKey="keys"
                      nameKey="namespace"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {stats.keyspace.namespaces.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>

                <div className="space-y-2">
                  {stats.keyspace.namespaces.map((ns, index) => (
                    <div key={ns.namespace} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="font-medium">{ns.namespace}</span>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <span>{ns.keys} keys</span>
                        <span className="text-muted-foreground">{ns.expires} with TTL</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleClearCache(ns.namespace)}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Slow Log Tab */}
        <TabsContent value="slowlog" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Slow Query Log</CardTitle>
              <CardDescription>Recent slow operations (execution time &gt; threshold)</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.slowLog.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No slow queries recorded</p>
              ) : (
                <div className="space-y-2">
                  {stats.slowLog.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex-1">
                        <code className="text-sm">{entry.command.join(' ')}</code>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(entry.timestamp * 1000).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={entry.duration > 10000 ? "destructive" : "secondary"}>
                        {(entry.duration / 1000).toFixed(2)} ms
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Management Tab */}
        <TabsContent value="manage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Key Inspector</CardTitle>
              <CardDescription>Inspect individual key values and metadata</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter key name..."
                  value={inspectKey}
                  onChange={(e) => setInspectKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInspectKey()}
                />
                <Button onClick={handleInspectKey}>
                  <Search className="h-4 w-4 mr-2" />
                  Inspect
                </Button>
              </div>

              {inspectResult && (
                <div className="p-4 bg-muted rounded-lg">
                  <pre className="text-sm overflow-auto">
                    {JSON.stringify(inspectResult, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Key Browser</CardTitle>
              <CardDescription>Search and browse Redis keys</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Pattern (e.g., cache:*)"
                  value={searchPattern}
                  onChange={(e) => setSearchPattern(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchKeys()}
                />
                <Button onClick={handleSearchKeys}>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>

              {searchResults && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Showing {searchResults.showing} of {searchResults.total} keys
                  </p>
                  <div className="space-y-2 max-h-96 overflow-auto">
                    {searchResults.keys.map((key: any) => (
                      <div key={key.key} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono truncate">{key.key}</p>
                          <p className="text-xs text-muted-foreground">
                            {key.type} | TTL: {key.ttl || 'none'} | Size: {key.size}B
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteKey(key.key)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
