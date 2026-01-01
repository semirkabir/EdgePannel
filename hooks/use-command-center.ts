'use client'

import { useState, useEffect, useCallback } from 'react'

export function useCommandCenter() {
    const [isOpen, setIsOpen] = useState(false)

    const toggle = useCallback(() => {
        setIsOpen(prev => !prev)
    }, [])

    const open = useCallback(() => setIsOpen(true), [])
    const close = useCallback(() => setIsOpen(false), [])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd+K or Ctrl+K to toggle
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                toggle()
            }

            // Escape to close
            if (e.key === 'Escape' && isOpen) {
                close()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [toggle, close, isOpen])

    return {
        isOpen,
        open,
        close,
        toggle
    }
}
