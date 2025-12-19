import useSWR from 'swr'
import { useSession } from 'next-auth/react'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export interface UserPreferences {
    rotationSpeed: number
    autoRotate: boolean
    pauseOnHover: boolean
    viewMode: 'globe' | 'map' | 'insights' | 'agent'
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

    const updatePreferences = async (newPrefs: Partial<UserPreferences>) => {
        if (status !== 'authenticated') return

        const updatedPrefs = { ...preferences, ...newPrefs }

        // Optimistic update
        mutate({ preferences: updatedPrefs }, false)

        try {
            const response = await fetch('/api/user/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preferences: updatedPrefs })
            })

            if (!response.ok) throw new Error('Failed to update preferences')

            // Final sync
            mutate()
        } catch (error) {
            console.error('Error updating settings:', error)
            // Revert on error
            mutate()
        }
    }

    return {
        preferences,
        updatePreferences,
        isLoading: status === 'loading' || isLoading,
        isAuthenticated: status === 'authenticated'
    }
}
