'use client'

import { useEffect, useCallback } from 'react'

type KeyboardShortcut = {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  callback: () => void
  description: string
}

/**
 * Hook to register keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      return
    }

    for (const shortcut of shortcuts) {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey
      const altMatch = shortcut.alt ? event.altKey : !event.altKey

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        event.preventDefault()
        shortcut.callback()
        return
      }
    }
  }, [shortcuts])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

/**
 * Format a shortcut for display
 */
export function formatShortcut(shortcut: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean }): string {
  const parts: string[] = []
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac')
  
  if (shortcut.ctrl) parts.push(isMac ? '⌘' : 'Ctrl')
  if (shortcut.shift) parts.push(isMac ? '⇧' : 'Shift')
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt')
  
  // Format the key nicely
  let key = shortcut.key
  if (key === 'Escape') key = 'Esc'
  if (key === ' ') key = 'Space'
  if (key.length === 1) key = key.toUpperCase()
  
  parts.push(key)
  
  return parts.join(isMac ? '' : '+')
}

// Common shortcut definitions
export const SHORTCUTS = {
  SEARCH: { key: '/', description: 'Focus search' },
  CLOSE: { key: 'Escape', description: 'Close panel' },
  REFRESH: { key: 'r', description: 'Refresh markets' },
  SETTINGS: { key: ',', ctrl: true, description: 'Open settings' },
  HELP: { key: '?', shift: true, description: 'Show shortcuts' },
  NEXT_MARKET: { key: 'j', description: 'Next market' },
  PREV_MARKET: { key: 'k', description: 'Previous market' },
}



