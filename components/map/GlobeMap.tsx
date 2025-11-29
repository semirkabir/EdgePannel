'use client'

import { useEffect, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import { Market } from '@/types/market'
import { MarketMarker } from './MarketMarker'

interface GlobeMapProps {
  markets: Market[]
  onMarketClick?: (market: Market) => void
  selectedMarket?: Market | null
  zoomLevel?: 'world' | 'country' | 'region'
  selectedCountry?: string
}

export function GlobeMap({
  markets,
  onMarketClick,
  selectedMarket,
  zoomLevel = 'world',
  selectedCountry,
}: GlobeMapProps) {
  const globeRef = useRef<any>()
  const [globeData, setGlobeData] = useState<any[]>([])

  useEffect(() => {
    // Transform markets into globe markers
    const markers = markets
      .filter(m => m.location?.coordinates)
      .map(market => ({
        lat: market.location!.coordinates!.lat,
        lng: market.location!.coordinates!.lng,
        size: 0.5,
        color: market.platform === 'polymarket' ? '#3b82f6' : '#10b981',
        market,
      }))

    setGlobeData(markers)
  }, [markets])

  useEffect(() => {
    if (globeRef.current && selectedMarket?.location?.coordinates) {
      globeRef.current.pointOfView(
        {
          lat: selectedMarket.location.coordinates.lat,
          lng: selectedMarket.location.coordinates.lng,
          altitude: 2,
        },
        1000
      )
    }
  }, [selectedMarket])

  return (
    <div className="w-full h-full relative">
      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        pointsData={globeData}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointRadius="size"
        pointResolution={2}
        onPointClick={(point: any) => {
          if (onMarketClick && point.market) {
            onMarketClick(point.market)
          }
        }}
        pointLabel={(point: any) => {
          if (point.market) {
            return `
              <div style="
                background: rgba(15, 23, 42, 0.9);
                padding: 8px;
                border-radius: 4px;
                border: 1px solid rgba(148, 163, 184, 0.2);
                color: white;
                font-size: 12px;
                max-width: 200px;
              ">
                <strong>${point.market.title}</strong><br/>
                ${point.market.platform}<br/>
                ${point.market.price ? `${(point.market.price * 100).toFixed(1)}%` : 'N/A'}
              </div>
            `
          }
          return ''
        }}
        showAtmosphere={true}
        atmosphereColor="#3b82f6"
        atmosphereAltitude={0.15}
        backgroundColor="rgba(0,0,0,0)"
      />
    </div>
  )
}

