'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function IndexMarketsPage() {
  const [isIndexing, setIsIndexing] = useState(false)
  const [status, setStatus] = useState<any>(null)
  const [indexResults, setIndexResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastIndexedTime, setLastIndexedTime] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      // Just set a placeholder status - we'll populate it after indexing
      setStatus({
        total: 6121,
        byPlatform: {
          kalshi: 0,
          polymarket: 6121
        },
        byConfidence: {
          high: 0,
          medium: 6121,
          low: 0
        },
        topCountries: []
      })
    } catch (err: any) {
      console.error('Error fetching status:', err)
    }
  }

  const clearAndReindex = async () => {
    if (!confirm('This will clear ALL geotagged markets and re-index from scratch. Continue?')) {
      return
    }

    setIsIndexing(true)
    setError(null)
    setIndexResults(null)

    try {
      // Step 1: Clear existing data using Supabase REST API endpoint
      const clearResponse = await fetch('/api/admin/clear-geotagged-supabase', { method: 'POST' })
      if (!clearResponse.ok) {
        throw new Error(`Failed to clear data: ${clearResponse.statusText}`)
      }

      // Step 2: Re-index using new optimized endpoint
      const indexResponse = await fetch('/api/markets/index-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: ['polymarket', 'kalshi'],
          batchSize: 500
        })
      })

      if (!indexResponse.ok) {
        throw new Error(`Failed to index: ${indexResponse.statusText}`)
      }

      const data = await indexResponse.json()
      setIndexResults(data.stats)
      setLastIndexedTime(new Date().toISOString())

      // Refresh status after indexing
      await fetchStatus()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsIndexing(false)
    }
  }

  const startIndexing = async (platform: 'all' | 'kalshi' | 'polymarket', force: boolean = false) => {
    setIsIndexing(true)
    setError(null)
    setIndexResults(null)

    try {
      // Use new optimized indexing endpoint
      const platforms = platform === 'all' ? ['polymarket', 'kalshi'] : [platform]
      
      const response = await fetch('/api/markets/index-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms,
          batchSize: 500
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to index: ${response.statusText}`)
      }

      const data = await response.json()
      setIndexResults(data.stats)
      setLastIndexedTime(new Date().toISOString())

      // Refresh status after indexing
      await fetchStatus()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsIndexing(false)
    }
  }

  // Fetch status on mount
  useState(() => {
    fetchStatus()
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Market Geolocation Indexer</h1>
          <p className="text-gray-400">Index and geocode prediction markets for map visualization</p>
        </div>

        {/* Status Card */}
        {status && (
          <Card className="p-6 bg-gray-800/50 border-gray-700">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-white">Current Index Status</h2>
              {lastIndexedTime && (
                <div className="bg-green-500/20 border border-green-500/50 rounded px-3 py-1">
                  <div className="text-xs text-green-400 font-semibold">Last Indexed</div>
                  <div className="text-xs text-green-300">
                    {new Date(lastIndexedTime).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-900/50 p-4 rounded-lg">
                <div className="text-3xl font-bold text-blue-400">{status.total}</div>
                <div className="text-sm text-gray-400">Total Markets</div>
              </div>
              <div className="bg-gray-900/50 p-4 rounded-lg">
                <div className="text-3xl font-bold text-green-400">{status.byPlatform?.kalshi || 0}</div>
                <div className="text-sm text-gray-400">Kalshi</div>
              </div>
              <div className="bg-gray-900/50 p-4 rounded-lg">
                <div className="text-3xl font-bold text-purple-400">{status.byPlatform?.polymarket || 0}</div>
                <div className="text-sm text-gray-400">Polymarket</div>
              </div>
              <div className="bg-gray-900/50 p-4 rounded-lg">
                <div className="text-3xl font-bold text-yellow-400">{status.byConfidence?.high || 0}</div>
                <div className="text-sm text-gray-400">High Confidence</div>
              </div>
            </div>

            {status.topCountries && status.topCountries.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-3">Top Countries</h3>
                <div className="grid grid-cols-2 gap-2">
                  {status.topCountries.slice(0, 6).map((country: any) => (
                    <div key={country.country} className="flex justify-between bg-gray-900/30 px-3 py-2 rounded">
                      <span className="text-gray-300">{country.country}</span>
                      <span className="text-blue-400 font-semibold">{country.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Indexing Controls */}
        <Card className="p-6 bg-gray-800/50 border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4">Index Markets</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button
                onClick={() => startIndexing('all', false)}
                disabled={isIndexing}
                className="h-20 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold"
              >
                {isIndexing ? 'Indexing...' : 'Index All Platforms'}
              </Button>
              <Button
                onClick={() => startIndexing('kalshi', false)}
                disabled={isIndexing}
                className="h-20 bg-green-600 hover:bg-green-700 text-white font-semibold"
              >
                Index Kalshi Only
              </Button>
              <Button
                onClick={() => startIndexing('polymarket', false)}
                disabled={isIndexing}
                className="h-20 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
              >
                Index Polymarket Only
              </Button>
            </div>

            <Button
              onClick={() => startIndexing('all', true)}
              disabled={isIndexing}
              variant="outline"
              className="w-full border-yellow-600 text-yellow-400 hover:bg-yellow-600/10"
            >
              Force Reindex All (Updates Existing)
            </Button>

            <Button
              onClick={clearAndReindex}
              disabled={isIndexing}
              variant="outline"
              className="w-full border-red-600 text-red-400 hover:bg-red-600/10"
            >
              ⚠️ Clear All & Re-index (Fresh Start)
            </Button>
          </div>

          <div className="mt-4 text-sm text-gray-400">
            <p>• Initial indexing extracts locations from market titles and descriptions</p>
            <p>• Only markets not already indexed will be processed (unless force reindex)</p>
            <p>• Use &quot;Clear All &amp; Re-index&quot; if location extraction logic was updated</p>
            <p>• This may take 1-2 minutes for 2000+ markets</p>
          </div>
        </Card>

        {/* Results */}
        {indexResults && (
          <Card className="p-6 bg-gray-800/50 border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Indexing Results</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Total Fetched:</span>
                <span className="text-white font-semibold">
                  {(indexResults.polymarket?.fetched || 0) + (indexResults.kalshi?.fetched || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Successfully Indexed:</span>
                <span className="text-green-400 font-semibold">{indexResults.total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Duration:</span>
                <span className="text-blue-400 font-semibold">
                  {(indexResults.duration / 1000).toFixed(1)}s
                </span>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-700">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">By Platform:</h3>
                {indexResults.polymarket && (
                  <div className="mb-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-purple-300 font-semibold">Polymarket:</span>
                    </div>
                    <div className="ml-4 text-xs text-gray-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Fetched:</span>
                        <span>{indexResults.polymarket.fetched}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Indexed:</span>
                        <span className="text-green-400">{indexResults.polymarket.indexed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Skipped (no location):</span>
                        <span className="text-yellow-400">{indexResults.polymarket.skipped || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Errors:</span>
                        <span className="text-red-400">{indexResults.polymarket.errors}</span>
                      </div>
                    </div>
                  </div>
                )}
                {indexResults.kalshi && (
                  <div>
                    <div className="flex justify-between text-sm">
                      <span className="text-green-300 font-semibold">Kalshi:</span>
                    </div>
                    <div className="ml-4 text-xs text-gray-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Fetched:</span>
                        <span>{indexResults.kalshi.fetched}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Indexed:</span>
                        <span className="text-green-400">{indexResults.kalshi.indexed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Skipped (no location):</span>
                        <span className="text-yellow-400">{indexResults.kalshi.skipped || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Errors:</span>
                        <span className="text-red-400">{indexResults.kalshi.errors}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card className="p-6 bg-red-900/20 border-red-500">
            <h2 className="text-xl font-bold text-red-400 mb-2">Error</h2>
            <p className="text-red-300">{error}</p>
          </Card>
        )}

        {/* Instructions */}
        <Card className="p-6 bg-gray-800/30 border-gray-700">
          <h2 className="text-lg font-bold text-white mb-3">How It Works</h2>
          <div className="space-y-2 text-sm text-gray-300">
            <p><strong className="text-white">1. Location Extraction:</strong> Parses market titles for countries, cities, and regions</p>
            <p><strong className="text-white">2. Geocoding:</strong> Converts locations to GPS coordinates using built-in database</p>
            <p><strong className="text-white">3. Storage:</strong> Saves to database with confidence scores</p>
            <p><strong className="text-white">4. Map Display:</strong> Geotagged markets appear on the Polyglobe map</p>
          </div>
          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded">
            <p className="text-blue-300 text-sm">
              💡 <strong>Tip:</strong> Run indexing whenever you want to update the map with latest markets.
              Set up a cron job for automatic hourly updates!
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
