'use client'

import { useMemo } from 'react'
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
}

export function GlobeCanvas({
  markets,
  breakingNews,
  livePredictions,
  selectedMarket,
  onMarketClick,
  isAnimating = true,
}: GlobeCanvasProps) {
  // Determine frameloop mode based on visibility
  const frameloop = useMemo(() => {
    return isAnimating ? 'always' : 'demand'
  }, [isAnimating])

  return (
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
    >
      {/* Adaptive performance helpers */}
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
      
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-5, -3, -5]} intensity={0.4} color="#87ceeb" />
      <pointLight position={[0, 10, 0]} intensity={0.5} color="#ffffff" />
      
      <OrbitControls
        enablePan={false}
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
  )
}
