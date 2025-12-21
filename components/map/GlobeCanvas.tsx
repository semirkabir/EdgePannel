'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, AdaptiveDpr, AdaptiveEvents } from '@react-three/drei'
import { GlobeScene } from './GlobeScene'
import { Market } from '@/types/market'

interface GlobeCanvasProps {
  markets: Market[]
  breakingNews?: Market[]
  livePredictions?: Market[]
  selectedMarket?: Market | null
  onMarketClick?: (market: Market) => void
  isAnimating?: boolean
  overlay?: React.ReactNode
}

export function GlobeCanvas({
  markets,
  breakingNews,
  livePredictions,
  selectedMarket,
  onMarketClick,
  isAnimating = true,
  overlay,
}: GlobeCanvasProps) {
  // Determine frameloop mode based on visibility
  const frameloop = useMemo(() => {
    return isAnimating ? 'always' : 'demand'
  }, [isAnimating])

  // Mount DOM overlays as a sibling *before* the canvas element.
  // We also apply the positioning/layout classes on the inserted root so
  // the overlay content (e.g. LiveTradesPanel's Card) sits at the expected
  // DOM level and avoids extra wrappers.
  const overlayRootRef = useRef<HTMLElement | null>(null)
  const [overlayRoot, setOverlayRoot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    return () => {
      if (overlayRootRef.current?.parentElement) {
        overlayRootRef.current.parentElement.removeChild(overlayRootRef.current)
      }
      overlayRootRef.current = null
      setOverlayRoot(null)
    }
  }, [])

  return (
    <>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          // Limit pixel ratio for performance
          pixelRatio: Math.min(window.devicePixelRatio, 2),
        }}
        frameloop={frameloop}
        // Performance optimizations
        dpr={[1, 2]} // Adaptive DPR between 1 and 2
        performance={{ min: 0.5 }} // Allow frame rate to drop to 30fps
        onCreated={({ gl }) => {
          // Create a stable DOM node inserted immediately before the canvas
          // so overlays appear "above" but don't require z-index hacks.
          if (!overlay || overlayRootRef.current) return

          const canvas = gl.domElement
          const parent = canvas.parentElement
          if (!parent) return

          const el = document.createElement('div')
          // Matches the preview DOM structure:
          // parent -> (this absolute overlay container) -> <Card ...>, then <canvas>
          el.className = 'absolute top-20 left-4 z-10 w-80 flex flex-col gap-2'
          parent.insertBefore(el, canvas)

          overlayRootRef.current = el
          setOverlayRoot(el)
        }}
      >
        {/* Adaptive performance helpers */}
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />

        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 3, 5]} intensity={1.2} castShadow />
        <directionalLight position={[-5, -3, -5]} intensity={0.4} color="#87ceeb" />
        <pointLight position={[0, 10, 0]} intensity={0.5} color="#ffffff" />

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={3}
          maxDistance={8}
          autoRotate={false}
          // Damping for smoother controls
          enableDamping
          dampingFactor={0.05}
        />

        <GlobeScene
          markets={markets}
          breakingNews={breakingNews}
          livePredictions={livePredictions}
          selectedMarket={selectedMarket}
          onMarketClick={onMarketClick}
          isAnimating={isAnimating}
        />
      </Canvas>

      {overlay && overlayRoot ? createPortal(overlay, overlayRoot) : null}
    </>
  )
}
