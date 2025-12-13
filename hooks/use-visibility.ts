'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Hook to detect if the page/tab is visible
 * Useful for pausing animations and expensive operations
 */
export function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible')
    }

    // Initial state
    setIsVisible(document.visibilityState === 'visible')

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return isVisible
}

/**
 * Hook to detect if an element is visible in the viewport
 * Uses IntersectionObserver for performance
 */
export function useElementVisibility(
  options: IntersectionObserverInit = {}
): [React.RefCallback<HTMLElement>, boolean] {
  const [isVisible, setIsVisible] = useState(false)
  const [element, setElement] = useState<HTMLElement | null>(null)

  const ref = useCallback((node: HTMLElement | null) => {
    setElement(node)
  }, [])

  useEffect(() => {
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      {
        threshold: 0.1,
        ...options,
      }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [element, options.threshold, options.root, options.rootMargin])

  return [ref, isVisible]
}

/**
 * Combined hook for checking if component should render/animate
 * Returns true only if both page is visible AND element is in viewport
 */
export function useShouldRender(): [React.RefCallback<HTMLElement>, boolean] {
  const isPageVisible = usePageVisibility()
  const [elementRef, isElementVisible] = useElementVisibility()

  return [elementRef, isPageVisible && isElementVisible]
}

/**
 * Hook to reduce frame rate when page is not visible
 * Returns a frameloop value for react-three-fiber
 */
export function useAdaptiveFrameLoop(): 'always' | 'demand' | 'never' {
  const isPageVisible = usePageVisibility()
  const [isWindowFocused, setIsWindowFocused] = useState(true)

  useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true)
    const handleBlur = () => setIsWindowFocused(false)

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  // Only animate when page is visible and window is focused
  if (!isPageVisible) return 'never'
  if (!isWindowFocused) return 'demand'
  return 'always'
}

/**
 * Hook to throttle a callback to run at most once per frame
 * Useful for expensive operations that don't need to run every render
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  const frameRef = useRef<number | null>(null)
  const callbackRef = useRef(callback)
  
  // Update callback ref when deps change
  useEffect(() => {
    callbackRef.current = callback
  }, deps)

  const throttledCallback = useCallback((...args: Parameters<T>) => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
    }
    
    frameRef.current = requestAnimationFrame(() => {
      callbackRef.current(...args)
      frameRef.current = null
    })
  }, []) as T

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [])

  return throttledCallback
}

/**
 * Hook to track if user prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return prefersReducedMotion
}




