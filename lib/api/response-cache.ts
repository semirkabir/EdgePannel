type CacheEntry<T> = {
  value: T
  expiresAt: number
}

type CacheOptions = {
  ttlMs: number
  allowStaleOnError?: boolean
  cacheNull?: boolean
}

interface RedisClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, mode?: string, duration?: number): Promise<string | null>
}

const memoryCache = new Map<string, CacheEntry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()
const DEFAULT_TTL_MS = 15_000

let redisPromise: Promise<RedisClient | null> | null = null

async function getRedisClient(): Promise<RedisClient | null> {
  if (!process.env.REDIS_URL) return null
  if (!redisPromise) {
    redisPromise = import('ioredis')
      .then(mod => new mod.default(process.env.REDIS_URL as string) as unknown as RedisClient)
      .catch(() => null)
  }
  return redisPromise
}

function isFresh(entry: CacheEntry<unknown>, now: number): boolean {
  return entry.expiresAt > now
}

async function readCache<T>(
  key: string,
  options: { allowStale?: boolean } = {}
): Promise<CacheEntry<T> | null> {
  const allowStale = options.allowStale === true
  const now = Date.now()
  const memory = memoryCache.get(key)
  if (memory) {
    if (isFresh(memory, now)) {
      return memory as CacheEntry<T>
    }
    if (allowStale) {
      return memory as CacheEntry<T>
    }
    memoryCache.delete(key)
  }

  const redis = await getRedisClient()
  if (!redis) return null

  const raw = await redis.get(key)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as CacheEntry<T>
    if (!parsed || typeof parsed.expiresAt !== 'number') return null
    if (isFresh(parsed, now)) {
      memoryCache.set(key, parsed as CacheEntry<unknown>)
      return parsed
    }
    if (allowStale) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

async function writeCache<T>(key: string, value: T, ttlMs: number): Promise<void> {
  const expiresAt = Date.now() + ttlMs
  const entry: CacheEntry<T> = { value, expiresAt }

  memoryCache.set(key, entry as CacheEntry<unknown>)

  const redis = await getRedisClient()
  if (!redis) return

  const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000))
  try {
    await redis.set(key, JSON.stringify(entry), 'EX', ttlSeconds)
  } catch {
    // Ignore redis write errors; memory cache still works.
  }
}

export function buildCacheKey(prefix: string, parts: Array<string | number | boolean | null | undefined>): string {
  const normalized = parts.map(part => encodeURIComponent(String(part ?? '')))
  return [prefix, ...normalized].join(':')
}

export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions
): Promise<T> {
  const ttlMs = options.ttlMs || DEFAULT_TTL_MS
  const allowStaleOnError = options.allowStaleOnError !== false
  const cacheNull = options.cacheNull === true

  const existingPromise = inflight.get(key)
  if (existingPromise) {
    return existingPromise as Promise<T>
  }

  const promise = (async () => {
    const cached = await readCache<T>(key)
    const stale = allowStaleOnError ? await readCache<T>(key, { allowStale: true }) : null
    if (cached) {
      return cached.value
    }

    try {
      const value = await fetcher()
      if (value !== null && value !== undefined) {
        await writeCache(key, value, ttlMs)
      } else if (cacheNull) {
        await writeCache(key, value, ttlMs)
      }
      return value
    } catch (error) {
      if (allowStaleOnError && stale) {
        return stale.value
      }
      throw error
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, promise)
  return promise
}

export async function cachedJson<T>(
  key: string,
  url: string,
  init: RequestInit | undefined,
  options: CacheOptions
): Promise<T> {
  return cachedFetch<T>(
    key,
    async () => {
      const response = await fetch(url, {
        ...init,
        cache: 'no-store',
      })
      if (!response.ok) {
        const error = new Error(`Upstream error: ${response.status} ${response.statusText}`)
        ;(error as any).status = response.status
        ;(error as any).body = await response.text().catch(() => '')
        throw error
      }
      return response.json() as Promise<T>
    },
    options
  )
}

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of memoryCache.entries()) {
    if (!isFresh(entry, now)) {
      memoryCache.delete(key)
    }
  }
}, DEFAULT_TTL_MS)
