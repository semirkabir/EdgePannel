'use client'

import { SessionProvider } from 'next-auth/react'
import { SWRConfig } from 'swr'
import { Toaster } from '@/components/ui/toaster'
import { ErrorBoundary } from '@/components/error-boundary'
import { toast } from '@/hooks/use-toast'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary>
      <SWRConfig
        value={{
          onError: (error, key) => {
            // Don't show toast for 401 errors (user might not be logged in)
            if (error?.status === 401) return
            
            // Show error toast for other errors
            toast.error(
              'Failed to load data',
              error?.message || 'Please check your connection and try again'
            )
          },
          onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
            // Never retry on 401/403
            if (error?.status === 401 || error?.status === 403) return
            
            // Only retry up to 3 times
            if (retryCount >= 3) return
            
            // Retry after 5 seconds
            setTimeout(() => revalidate({ retryCount }), 5000)
          },
        }}
      >
        <SessionProvider>
          {children}
          <Toaster />
        </SessionProvider>
      </SWRConfig>
    </ErrorBoundary>
  )
}

