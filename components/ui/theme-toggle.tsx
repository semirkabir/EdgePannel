'use client'

import { useTheme } from '@/hooks/use-theme'
import { Button } from '@/components/ui/button'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils/cn'

interface ThemeToggleProps {
  variant?: 'icon' | 'dropdown'
  size?: 'sm' | 'default'
}

export function ThemeToggle({ variant = 'icon', size = 'default' }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme, mounted } = useTheme()
  const [showDropdown, setShowDropdown] = useState(false)

  if (!mounted) {
    return (
      <Button variant="ghost" size={size === 'sm' ? 'icon' : 'default'} className="h-9 w-9">
        <div className="h-5 w-5" />
      </Button>
    )
  }

  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className={cn(
          "relative overflow-hidden",
          size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'
        )}
        title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
      >
        <Sun className={cn(
          "h-5 w-5 absolute transition-all duration-300",
          resolvedTheme === 'dark' 
            ? "rotate-90 scale-0 opacity-0" 
            : "rotate-0 scale-100 opacity-100"
        )} />
        <Moon className={cn(
          "h-5 w-5 absolute transition-all duration-300",
          resolvedTheme === 'dark' 
            ? "rotate-0 scale-100 opacity-100" 
            : "-rotate-90 scale-0 opacity-0"
        )} />
        <span className="sr-only">Toggle theme</span>
      </Button>
    )
  }

  // Dropdown variant
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size={size === 'sm' ? 'icon' : 'default'}
        onClick={() => setShowDropdown(!showDropdown)}
        className={cn(
          size === 'sm' ? 'h-8 w-8' : 'h-9 gap-2'
        )}
      >
        {resolvedTheme === 'dark' ? (
          <Moon className="h-5 w-5" />
        ) : (
          <Sun className="h-5 w-5" />
        )}
        {size !== 'sm' && <span>Theme</span>}
      </Button>

      {showDropdown && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDropdown(false)} 
          />
          <div className="absolute right-0 top-full mt-1 z-50 w-36 bg-background border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-1">
              <button
                onClick={() => {
                  setTheme('light')
                  setShowDropdown(false)
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors",
                  theme === 'light' && "bg-accent"
                )}
              >
                <Sun className="h-4 w-4" />
                Light
              </button>
              <button
                onClick={() => {
                  setTheme('dark')
                  setShowDropdown(false)
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors",
                  theme === 'dark' && "bg-accent"
                )}
              >
                <Moon className="h-4 w-4" />
                Dark
              </button>
              <button
                onClick={() => {
                  setTheme('system')
                  setShowDropdown(false)
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors",
                  theme === 'system' && "bg-accent"
                )}
              >
                <Monitor className="h-4 w-4" />
                System
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}



