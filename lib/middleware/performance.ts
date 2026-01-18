/**
 * Performance Profiling Middleware
 *
 * Tracks and logs performance metrics:
 * - Request duration
 * - Redis operation latency
 * - Cache hit/miss rates
 * - Slow operations detection
 * - Performance anomalies
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, isRedisAvailable } from '@/lib/cache/redis-client'

// Performance thresholds
const SLOW_REQUEST_THRESHOLD_MS = 1000
const SLOW_REDIS_THRESHOLD_MS = 50

// In-memory performance metrics storage
interface PerformanceMetric {
  path: string
  method: string
  duration: number
  timestamp: number
  cacheHit?: boolean
  redisLatency?: number
  statusCode?: number
}

const performanceMetrics: PerformanceMetric[] = []
const MAX_METRICS = 1000 // Keep last 1000 metrics

// Endpoint-specific statistics
interface EndpointStats {
  path: string
  count: number
  totalDuration: number
  avgDuration: number
  minDuration: number
  maxDuration: number
  slowRequests: number
  cacheHitRate: number
  totalCacheHits: number
  totalCacheMisses: number
}

const endpointStats = new Map<string, EndpointStats>()

/**
 * Record a performance metric
 */
export function recordMetric(metric: PerformanceMetric): void {
  // Add to metrics array
  performanceMetrics.push(metric)

  // Trim if exceeds max
  if (performanceMetrics.length > MAX_METRICS) {
    performanceMetrics.shift()
  }

  // Update endpoint stats
  updateEndpointStats(metric)

  // Log slow requests
  if (metric.duration > SLOW_REQUEST_THRESHOLD_MS) {
    console.warn(`[Performance] Slow request: ${metric.method} ${metric.path} took ${metric.duration}ms`)
  }

  // Log slow Redis operations
  if (metric.redisLatency && metric.redisLatency > SLOW_REDIS_THRESHOLD_MS) {
    console.warn(`[Performance] Slow Redis operation for ${metric.path}: ${metric.redisLatency}ms`)
  }
}

/**
 * Update endpoint statistics
 */
function updateEndpointStats(metric: PerformanceMetric): void {
  const key = `${metric.method}:${metric.path}`
  let stats = endpointStats.get(key)

  if (!stats) {
    stats = {
      path: metric.path,
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      slowRequests: 0,
      cacheHitRate: 0,
      totalCacheHits: 0,
      totalCacheMisses: 0
    }
    endpointStats.set(key, stats)
  }

  // Update counts
  stats.count++
  stats.totalDuration += metric.duration

  // Update min/max
  stats.minDuration = Math.min(stats.minDuration, metric.duration)
  stats.maxDuration = Math.max(stats.maxDuration, metric.duration)

  // Update avg
  stats.avgDuration = stats.totalDuration / stats.count

  // Count slow requests
  if (metric.duration > SLOW_REQUEST_THRESHOLD_MS) {
    stats.slowRequests++
  }

  // Update cache stats
  if (metric.cacheHit !== undefined) {
    if (metric.cacheHit) {
      stats.totalCacheHits++
    } else {
      stats.totalCacheMisses++
    }

    const totalCache = stats.totalCacheHits + stats.totalCacheMisses
    stats.cacheHitRate = totalCache > 0 ? stats.totalCacheHits / totalCache : 0
  }
}

/**
 * Get all performance metrics
 */
export function getPerformanceMetrics(): PerformanceMetric[] {
  return [...performanceMetrics]
}

/**
 * Get endpoint statistics
 */
export function getEndpointStats(): EndpointStats[] {
  return Array.from(endpointStats.values())
}

/**
 * Get statistics for a specific endpoint
 */
export function getEndpointStat(method: string, path: string): EndpointStats | undefined {
  return endpointStats.get(`${method}:${path}`)
}

/**
 * Clear performance metrics
 */
export function clearPerformanceMetrics(): void {
  performanceMetrics.length = 0
  endpointStats.clear()
}

/**
 * Get slow operations
 */
export function getSlowOperations(limit = 20): PerformanceMetric[] {
  return performanceMetrics
    .filter(m => m.duration > SLOW_REQUEST_THRESHOLD_MS)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, limit)
}

/**
 * Get performance summary
 */
export function getPerformanceSummary(): {
  totalRequests: number
  avgDuration: number
  slowRequests: number
  cacheHitRate: number
  topSlowEndpoints: Array<{ path: string; avgDuration: number }>
} {
  const stats = Array.from(endpointStats.values())

  const totalRequests = stats.reduce((sum, s) => sum + s.count, 0)
  const totalDuration = stats.reduce((sum, s) => sum + s.totalDuration, 0)
  const avgDuration = totalRequests > 0 ? totalDuration / totalRequests : 0

  const slowRequests = stats.reduce((sum, s) => sum + s.slowRequests, 0)

  const totalCacheHits = stats.reduce((sum, s) => sum + s.totalCacheHits, 0)
  const totalCacheMisses = stats.reduce((sum, s) => sum + s.totalCacheMisses, 0)
  const totalCache = totalCacheHits + totalCacheMisses
  const cacheHitRate = totalCache > 0 ? totalCacheHits / totalCache : 0

  const topSlowEndpoints = stats
    .sort((a, b) => b.avgDuration - a.avgDuration)
    .slice(0, 10)
    .map(s => ({ path: s.path, avgDuration: s.avgDuration }))

  return {
    totalRequests,
    avgDuration,
    slowRequests,
    cacheHitRate,
    topSlowEndpoints
  }
}

/**
 * Performance profiling middleware
 */
export async function performanceMiddleware(
  req: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const startTime = performance.now()
  const path = req.nextUrl.pathname
  const method = req.method

  // Measure Redis latency if available
  let redisLatency: number | undefined
  if (isRedisAvailable()) {
    const redis = getRedisClient()
    if (redis) {
      const redisStart = performance.now()
      try {
        await redis.ping()
        redisLatency = performance.now() - redisStart
      } catch (error) {
        console.error('[Performance] Redis ping failed:', error)
      }
    }
  }

  // Execute handler
  const response = await handler()

  // Calculate duration
  const duration = performance.now() - startTime

  // Record metric
  recordMetric({
    path,
    method,
    duration,
    timestamp: Date.now(),
    redisLatency,
    statusCode: response.status
  })

  // Add performance headers
  response.headers.set('X-Response-Time', `${duration.toFixed(2)}ms`)
  if (redisLatency) {
    response.headers.set('X-Redis-Latency', `${redisLatency.toFixed(2)}ms`)
  }

  return response
}

/**
 * Measure Redis operation performance
 */
export async function measureRedisOperation<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now()

  try {
    const result = await fn()
    const duration = performance.now() - start

    if (duration > SLOW_REDIS_THRESHOLD_MS) {
      console.warn(`[Performance] Slow Redis ${operation}: ${duration.toFixed(2)}ms`)
    }

    return result
  } catch (error) {
    const duration = performance.now() - start
    console.error(`[Performance] Failed Redis ${operation} after ${duration.toFixed(2)}ms:`, error)
    throw error
  }
}

/**
 * Track cache hit/miss
 */
export function trackCacheOperation(path: string, hit: boolean): void {
  const recentMetric = performanceMetrics[performanceMetrics.length - 1]

  if (recentMetric && recentMetric.path === path) {
    recentMetric.cacheHit = hit
    updateEndpointStats(recentMetric)
  }
}

/**
 * Generate performance recommendations
 */
export function generateRecommendations(): Array<{
  endpoint: string
  issue: string
  recommendation: string
  priority: 'high' | 'medium' | 'low'
}> {
  const recommendations: Array<{
    endpoint: string
    issue: string
    recommendation: string
    priority: 'high' | 'medium' | 'low'
  }> = []

  const stats = Array.from(endpointStats.values())

  for (const stat of stats) {
    // Slow average response time
    if (stat.avgDuration > 500) {
      recommendations.push({
        endpoint: stat.path,
        issue: `Average response time: ${stat.avgDuration.toFixed(0)}ms`,
        recommendation: stat.cacheHitRate < 0.5
          ? 'Consider increasing cache TTL or adding caching'
          : 'Optimize database queries or add pagination',
        priority: stat.avgDuration > 1000 ? 'high' : 'medium'
      })
    }

    // Low cache hit rate
    if (stat.totalCacheHits + stat.totalCacheMisses > 10 && stat.cacheHitRate < 0.3) {
      recommendations.push({
        endpoint: stat.path,
        issue: `Low cache hit rate: ${(stat.cacheHitRate * 100).toFixed(1)}%`,
        recommendation: 'Increase cache TTL or review cache key strategy',
        priority: 'medium'
      })
    }

    // High percentage of slow requests
    const slowPercentage = stat.slowRequests / stat.count
    if (slowPercentage > 0.1) {
      recommendations.push({
        endpoint: stat.path,
        issue: `${(slowPercentage * 100).toFixed(1)}% of requests are slow`,
        recommendation: 'Review query performance and add indexes',
        priority: slowPercentage > 0.3 ? 'high' : 'medium'
      })
    }
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}
