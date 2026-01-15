import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { decrypt } from '@/lib/utils/encryption'
import { getUserId } from '@/lib/api/middleware'

export const dynamic = 'force-dynamic'

const DEFAULT_CHANNELS = ['ticker']
const ALLOWED_CHANNELS = new Set([
  'ticker',
  'orderbook_delta',
  'trade',
  'market_lifecycle_v2',
  'fill',
  'market_positions',
])
const MAX_TICKERS = 200
const KALSHI_WS_URL = 'wss://api.elections.kalshi.com/trade-api/ws/v2'

function parseCsv(value: string | null | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function formatSse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function GET(request: NextRequest) {
  try {
    let userId: string | null = null
    try {
      userId = await getUserId(request)
    } catch (error) {
      userId = null
    }
    const { searchParams } = new URL(request.url)

    const tickers = parseCsv(searchParams.get('tickers')).slice(0, MAX_TICKERS)
    const channels = parseCsv(searchParams.get('channels'))
    const filteredChannels = channels.filter(channel => ALLOWED_CHANNELS.has(channel))
    const requestedChannels = filteredChannels.length > 0 ? filteredChannels : DEFAULT_CHANNELS

    if (tickers.length === 0) {
      return NextResponse.json(
        { error: 'Missing tickers parameter' },
        { status: 400 }
      )
    }

    let accessKeyId: string | undefined
    let privateKey: string | undefined

    if (userId) {
      const keyRecord = await prisma.apiKey.findUnique({
        where: {
          userId_platform: {
            userId,
            platform: 'kalshi',
          },
        },
      })

      if (keyRecord?.encryptedKeyData) {
        accessKeyId = decrypt(keyRecord.encryptedKey)
        privateKey = decrypt(keyRecord.encryptedKeyData)
      }
    }

    if (!accessKeyId || !privateKey) {
      accessKeyId = process.env.KALSHI_SYSTEM_API_KEY_ID || process.env.KALSHI_API_KEY_ID
      privateKey = process.env.KALSHI_SYSTEM_PRIVATE_KEY || process.env.KALSHI_PRIVATE_KEY
    }

    if (!accessKeyId || !privateKey) {
      return NextResponse.json(
        { error: 'Kalshi API keys not configured' },
        { status: 401 }
      )
    }

    if (typeof WebSocket === 'undefined') {
      return NextResponse.json(
        { error: 'WebSocket not available in server runtime' },
        { status: 500 }
      )
    }

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      start(controller) {
        const ws = new WebSocket(KALSHI_WS_URL)
        let closed = false
        let pingInterval: ReturnType<typeof setInterval> | null = null

        const closeAll = () => {
          if (closed) return
          closed = true
          try {
            ws.close()
          } catch (error) {
            // Ignore cleanup errors
          }
          controller.close()
        }

        ws.onopen = () => {
          controller.enqueue(encoder.encode(formatSse({ type: 'connected' })))
          ws.send(JSON.stringify({
            id: 1,
            cmd: 'subscribe',
            params: {
              channels: requestedChannels,
              market_tickers: tickers,
            },
          }))
        }

        ws.onmessage = (event) => {
          if (closed) return
          try {
            const parsed = JSON.parse(event.data)
            controller.enqueue(encoder.encode(formatSse(parsed)))
          } catch (error) {
            controller.enqueue(encoder.encode(formatSse({ type: 'error', message: 'Invalid Kalshi message' })))
          }
        }

        ws.onerror = () => {
          if (closed) return
          controller.enqueue(encoder.encode(formatSse({ type: 'error', message: 'Kalshi WS error' })))
        }

        ws.onclose = () => {
          if (pingInterval) {
            clearInterval(pingInterval)
            pingInterval = null
          }
          closeAll()
        }

        pingInterval = setInterval(() => {
          if (closed) return
          controller.enqueue(encoder.encode(formatSse({ type: 'ping', ts: Date.now() })))
        }, 25000)

        request.signal.addEventListener('abort', () => {
          if (pingInterval) {
            clearInterval(pingInterval)
            pingInterval = null
          }
          closeAll()
        })
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('[Kalshi WS Proxy] Error:', error)
    return NextResponse.json(
      { error: 'Failed to connect to Kalshi stream', details: error?.message },
      { status: 500 }
    )
  }
}
