'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'

interface ApiKeysForWebSocket {
  hasKalshi: boolean
  kalshiAccessKeyId?: string
  kalshiPrivateKey?: string
}

// This hook fetches a token/endpoint for WebSocket connection
// In production, you'd want a secure endpoint that provides WebSocket connection details
// For now, we'll use a simplified approach
const fetcher = async (url: string): Promise<ApiKeysForWebSocket> => {
  const res = await fetch(url)
  if (!res.ok) {
    return { hasKalshi: false }
  }
  return res.json()
}

export function useApiKeysForWebSocket() {
  // For security, we don't expose decrypted keys to the client
  // Instead, we check if keys exist and let the server handle WebSocket auth
  // Or use a WebSocket proxy server
  const { data } = useSWR<ApiKeysForWebSocket>(
    '/api/ws/credentials',
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 0,
    }
  )

  return {
    hasKalshi: data?.hasKalshi ?? false,
    // Keys should not be exposed to client - use server-side WebSocket proxy instead
  }
}

