'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sphere, Html } from '@react-three/drei'
import { Market } from '@/types/market'
import * as THREE from 'three'
import { loadGeoJSON, parseCountries, CountryData } from '@/lib/geojson-loader'

// Convert lat/lng to 3D coordinates on sphere
function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

// Country borders using GeoJSON
function CountryBorders({ radius, onCountriesLoaded }: { radius: number, onCountriesLoaded?: (countries: CountryData[]) => void }) {
  const [countries, setCountries] = useState<CountryData[]>([])
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    loadGeoJSON().then(data => {
      const parsed = parseCountries(data)
      setCountries(parsed)
      if (onCountriesLoaded) onCountriesLoaded(parsed)
    })
  }, [onCountriesLoaded])

  return (
    <group ref={groupRef}>
      {countries.map((country, i) => {
        // We only render borders for now, using a simplified approach or just lines
        // For a true 3D line from GeoJSON, we'd need to parse the geometry coordinates
        // This is complex to do perfectly without a library like three-geojson-geometry
        // For this demo, we will try to use a simplified rendering if possible, 
        // or just rely on the fact that we have the data for labels.
        return null
      })}
      {/* Fallback to simplified borders for visual structure */}
      <SimplifiedBorders radius={radius} />
    </group>
  )
}

// Simplified borders (kept from original but renamed)
function SimplifiedBorders({ radius }: { radius: number }) {
  const bordersRef = useRef<THREE.Group>(null)
  const [borders, setBorders] = useState<THREE.Vector3[][]>([])

  useEffect(() => {
    // Create major country border lines (simplified representation)
    const majorBorders: THREE.Vector3[][] = []

    // USA-Canada border
    const usaCanada: THREE.Vector3[] = []
    for (let lng = -125; lng <= -67; lng += 2) {
      usaCanada.push(latLngToVector3(49, lng, radius))
    }
    if (usaCanada.length > 0) majorBorders.push(usaCanada)

    // USA-Mexico border
    const usaMexico: THREE.Vector3[] = []
    for (let lng = -117; lng <= -97; lng += 2) {
      usaMexico.push(latLngToVector3(32, lng, radius))
    }
    if (usaMexico.length > 0) majorBorders.push(usaMexico)

    // European borders (simplified)
    const europe: THREE.Vector3[] = []
    for (let lat = 35; lat <= 70; lat += 2) {
      europe.push(latLngToVector3(lat, 10, radius))
    }
    if (europe.length > 0) majorBorders.push(europe)

    setBorders(majorBorders)
  }, [radius])

  if (borders.length === 0) return null

  return (
    <group ref={bordersRef}>
      {borders.map((border, idx) => {
        const positions = new Float32Array(border.flatMap(v => [v.x, v.y, v.z]))
        return (
          <line key={idx}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={border.length}
                array={positions}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#ffffff" transparent opacity={1.0} linewidth={1.5} />
          </line>
        )
      })}
    </group>
  )
}

function CountryLabels({ radius }: { radius: number }) {
  // Manual list of major countries for labels to ensure they look good
  const countries = [
    { name: 'United States', lat: 37, lng: -95 },
    { name: 'Canada', lat: 56, lng: -106 },
    { name: 'Brazil', lat: -14, lng: -51 },
    { name: 'United Kingdom', lat: 55, lng: -3 },
    { name: 'France', lat: 46, lng: 2 },
    { name: 'Germany', lat: 51, lng: 10 },
    { name: 'Russia', lat: 61, lng: 105 },
    { name: 'China', lat: 35, lng: 104 },
    { name: 'India', lat: 20, lng: 78 },
    { name: 'Australia', lat: -25, lng: 133 },
    { name: 'Japan', lat: 36, lng: 138 },
    { name: 'South Africa', lat: -30, lng: 25 },
    { name: 'Egypt', lat: 26, lng: 30 },
    { name: 'Nigeria', lat: 9, lng: 8 },
  ]

  return (
    <group>
      {countries.map((country, i) => {
        const pos = latLngToVector3(country.lat, country.lng, radius)
        return (
          <Html key={i} position={[pos.x, pos.y, pos.z]} center distanceFactor={10} occlude>
            <div className="text-[9px] text-white font-sans font-semibold tracking-wide pointer-events-none select-none" style={{ 
              textShadow: '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.6), 1px 1px 2px rgba(0,0,0,0.9)',
              WebkitTextStroke: '0.5px rgba(0,0,0,0.8)'
            }}>
              {country.name}
            </div>
          </Html>
        )
      })}
    </group>
  )
}

// Market marker component
function MarketMarker({
  market,
  position,
  isSelected,
  isBreaking,
  isLive,
  onClick
}: {
  market: Market
  position: THREE.Vector3
  isSelected: boolean
  isBreaking: boolean
  isLive: boolean
  onClick: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const color = market.platform === 'polymarket' ? '#3b82f6' : '#10b981'

  useFrame((state) => {
    if (meshRef.current) {
      // Subtle pulsing animation
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1
      meshRef.current.scale.setScalar(scale)
    }
  })

  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onPointerOver={(e: any) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default'
        }}
      >
        <sphereGeometry args={[isSelected ? 0.08 : 0.05, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.8 : 0.4}
        />
      </mesh>
      {(isBreaking || isLive) && (
        <mesh position={[0, 0, 0]}>
          <ringGeometry args={[0.06, 0.08, 16]} />
          <meshStandardMaterial
            color={isBreaking ? '#ef4444' : '#3b82f6'}
            emissive={isBreaking ? '#ef4444' : '#3b82f6'}
            emissiveIntensity={0.5}
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {/* Label on hover or select */}
      {isSelected && (
        <Html position={[0, 0.1, 0]} center distanceFactor={10}>
          <div className="bg-black/80 text-white text-[8px] px-2 py-1 rounded border border-white/20 whitespace-nowrap backdrop-blur-sm">
            {market.title.slice(0, 20)}...
          </div>
        </Html>
      )}
    </group>
  )
}

// Animated connection arc
function ConnectionArc({
  start,
  end,
  color = '#3b82f6',
  radius = 2
}: {
  start: THREE.Vector3
  end: THREE.Vector3
  color?: string
  radius?: number
}) {
  const curveRef = useRef<THREE.CatmullRomCurve3 | null>(null)
  const [points, setPoints] = useState<THREE.Vector3[]>([])

  useEffect(() => {
    // Create a curved path between two points on the sphere
    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
    const distance = start.distanceTo(end)
    const height = distance * 0.4
    midPoint.normalize().multiplyScalar(radius + height)

    const curve = new THREE.CatmullRomCurve3([start, midPoint, end])
    const curvePoints = curve.getPoints(50)
    setPoints(curvePoints)
    curveRef.current = curve
  }, [start, end, radius])

  const lineRef = useRef<THREE.Line>(null)

  useFrame((state) => {
    if (lineRef.current && points.length > 0) {
      // Animate the line by showing a moving segment
      const offset = (state.clock.elapsedTime * 0.3) % 1
      const segmentLength = 0.2
      const startIdx = Math.floor(offset * points.length)
      const endIdx = Math.min(startIdx + Math.floor(segmentLength * points.length), points.length)

      const visiblePoints = points.slice(startIdx, endIdx)
      if (visiblePoints.length > 0) {
        const positions = new Float32Array(visiblePoints.length * 3)
        visiblePoints.forEach((point, i) => {
          positions[i * 3] = point.x
          positions[i * 3 + 1] = point.y
          positions[i * 3 + 2] = point.z
        })

        const geometry = lineRef.current.geometry
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setDrawRange(0, visiblePoints.length)
      }
    }
  })

  if (points.length === 0) return null

  return (
    <line ref={lineRef as any}>
      <bufferGeometry />
      <lineBasicMaterial
        color={color}
        transparent
        opacity={0.5}
        linewidth={2}
      />
    </line>
  )
}

// Globe scene component
export function GlobeScene({
  markets,
  breakingNews,
  livePredictions,
  selectedMarket,
  onMarketClick,
  isAnimating = true
}: {
  markets: Market[]
  breakingNews?: Market[]
  livePredictions?: Market[]
  selectedMarket?: Market | null
  onMarketClick?: (market: Market) => void
  isAnimating?: boolean
}) {
  const globeRef = useRef<THREE.Group>(null)
  const radius = 2
  const [textures, setTextures] = useState<{
    earthTexture?: THREE.Texture
    normalMap?: THREE.Texture
  }>({})

  // Load Earth textures with optimized loading
  useEffect(() => {
    // Import dynamically to avoid SSR issues
    import('@/lib/globe-textures').then(({
      createProceduralEarthTexture,
      createProceduralNormalMap,
      loadEarthTexture
    }) => {
      // Immediately set procedural textures for fast initial render
      const proceduralEarth = createProceduralEarthTexture()
      const proceduralNormal = createProceduralNormalMap()

      setTextures({
        earthTexture: proceduralEarth,
        normalMap: proceduralNormal,
      })

      // Try to load higher quality texture in background
      loadEarthTexture().then((texture) => {
        setTextures(prev => ({ ...prev, earthTexture: texture }))
      }).catch(() => {
        // Keep using procedural texture
      })
    })
  }, [])

  // Auto-rotate globe (only when animating)
  useFrame((state) => {
    if (globeRef.current && isAnimating) {
      globeRef.current.rotation.y += 0.0005
    }
  })

  // Get markets with valid coordinates
  const validMarkets = useMemo(() => {
    return markets.filter(m => m.location?.coordinates)
  }, [markets])

  // Create connection arcs between breaking news markets
  const connections = useMemo(() => {
    const breaking = breakingNews?.filter(m => m.location?.coordinates) || []
    const connections: Array<{ start: THREE.Vector3; end: THREE.Vector3 }> = []

    // Connect breaking news markets in a network
    for (let i = 0; i < breaking.length; i++) {
      for (let j = i + 1; j < Math.min(i + 3, breaking.length); j++) {
        const m1 = breaking[i]
        const m2 = breaking[j]
        if (m1.location?.coordinates && m2.location?.coordinates) {
          const start = latLngToVector3(
            m1.location.coordinates.lat,
            m1.location.coordinates.lng,
            radius
          )
          const end = latLngToVector3(
            m2.location.coordinates.lat,
            m2.location.coordinates.lng,
            radius
          )
          connections.push({ start, end })
        }
      }
    }

    return connections
  }, [breakingNews, radius])

  return (
    <group ref={globeRef}>
      {/* Main Earth sphere with texture */}
      <Sphere args={[radius, 128, 64]}>
        <meshStandardMaterial
          map={textures.earthTexture}
          normalMap={textures.normalMap}
          normalScale={new THREE.Vector2(1, 1)}
          roughness={0.8}
          metalness={0.2}
          emissive="#000000"
          emissiveIntensity={0}
        />
      </Sphere>

      {/* Country borders and labels */}
      <CountryBorders radius={radius + 0.01} />
      <CountryLabels radius={radius + 0.02} />

      {/* Atmospheric glow effect */}
      <Sphere args={[radius + 0.02, 64, 32]}>
        <meshBasicMaterial
          color="#3b82f6"
          transparent
          opacity={0.1}
          side={THREE.BackSide}
        />
      </Sphere>

      {/* Wireframe grid overlay for futuristic look */}
      <Sphere args={[radius + 0.015, 32, 16]}>
        <meshBasicMaterial
          color="#3b82f6"
          wireframe
          transparent
          opacity={0.05}
        />
      </Sphere>

      {/* Connection arcs */}
      {connections.map((conn, idx) => (
        <ConnectionArc
          key={idx}
          start={conn.start}
          end={conn.end}
          color="#3b82f6"
        />
      ))}

      {/* Market markers */}
      {validMarkets.map((market) => {
        if (!market.location?.coordinates) return null

        const position = latLngToVector3(
          market.location.coordinates.lat,
          market.location.coordinates.lng,
          radius + 0.05
        )

        return (
          <MarketMarker
            key={market.id}
            market={market}
            position={position}
            isSelected={selectedMarket?.id === market.id}
            isBreaking={breakingNews?.some(b => b.id === market.id) || false}
            isLive={livePredictions?.some(l => l.id === market.id) || false}
            onClick={() => onMarketClick?.(market)}
          />
        )
      })}
    </group>
  )
}
