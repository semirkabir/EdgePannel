import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useRef } from 'react'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export interface UserPreferences {
    rotationSpeed: number
    autoRotate: boolean
    pauseOnHover: boolean
    viewMode: 'globe' | 'map' | 'insights' | 'agent' | 'financials' | 'hub'
    showLabels: boolean
    showGrid: boolean
    [key: string]: any
}

const defaultPreferences: UserPreferences = {
    rotationSpeed: 0.05,
    autoRotate: true,
    pauseOnHover: false,
    viewMode: 'globe',
    showLabels: true,
    showGrid: false
}


export function useUserSettings() {
    const { data: session, status } = useSession()

    const { data, error, mutate, isLoading } = useSWR(
        status === 'authenticated' ? '/api/user/preferences' : null,
        fetcher,
        {
            revalidateOnFocus: false,
            shouldRetryOnError: false
        }
    )

    const preferences: UserPreferences = data?.preferences || defaultPreferences
    const preferencesRef = useRef<UserPreferences>(preferences)
    const pendingPrefsRef = useRef<UserPreferences | null>(null)
    const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        preferencesRef.current = preferences
    }, [preferences])

    useEffect(() => {
        return () => {
            if (flushTimerRef.current) {
                clearTimeout(flushTimerRef.current)
                flushTimerRef.current = null
            }
        }
    }, [])

    const flushPending = useCallback(async () => {
        if (status !== 'authenticated') {
            pendingPrefsRef.current = null
            return
        }

        const pending = pendingPrefsRef.current
        if (!pending) return

        pendingPrefsRef.current = null

        try {
            const response = await fetch('/api/user/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preferences: pending })
            })

            if (!response.ok) throw new Error('Failed to update preferences')

            // Final sync
            mutate()
        } catch (error) {
            console.error('Error updating settings:', error)
            // Revert on error
            mutate()
        }
    }, [status, mutate])

    const updatePreferences = async (newPrefs: Partial<UserPreferences>) => {
        if (status !== 'authenticated') return
        const basePrefs = pendingPrefsRef.current || preferencesRef.current || defaultPreferences
        const updatedPrefs = { ...basePrefs, ...newPrefs }
        pendingPrefsRef.current = updatedPrefs

        // Optimistic update
        mutate({ preferences: updatedPrefs }, false)

        if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current)
        }

        flushTimerRef.current = setTimeout(() => {
            flushTimerRef.current = null
            void flushPending()
        }, 500)
    }

    return {
        preferences,
        updatePreferences,
        isLoading: status === 'loading' || isLoading,
        isAuthenticated: status === 'authenticated'
    }
}
