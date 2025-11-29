'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { GlobeScene } from './GlobeScene'
import { Market } from '@/types/market'

interface GlobeCanvasProps {
  markets: Market[]
  breakingNews?: Market[]
  livePredictions?: Market[]
  selectedMarket?: Market | null
  onMarketClick?: (market: Market) => void
}

export function GlobeCanvas({
  markets,
  breakingNews,
  livePredictions,
  selectedMarket,
  onMarketClick,
}: GlobeCanvasProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
    >
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
      />
      
      <GlobeScene
        markets={markets}
        breakingNews={breakingNews}
        livePredictions={livePredictions}
        selectedMarket={selectedMarket}
        onMarketClick={onMarketClick}
      />
    </Canvas>
  )
}
