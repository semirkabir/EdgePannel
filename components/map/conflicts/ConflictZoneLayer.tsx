'use client';

import { useState, useEffect, useCallback } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useLayerStore } from '@/lib/store/layer-store';
import { ConflictZone, ConflictAsset, ConflictEvent, ConflictRegion, OSINTResponse } from '@/types/conflicts';

// Convert lat/lng to 3D coordinates on sphere
function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);

    return new THREE.Vector3(
        -radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
    );
}

// 2D Asset Icons
const ASSET_ICONS: Record<string, { icon: string; color: string }> = {
    warship: { icon: '🚢', color: '#ef4444' },
    aircraft: { icon: '✈️', color: '#f97316' },
    troops: { icon: '⚔️', color: '#dc2626' },
    missile: { icon: '🎯', color: '#b91c1c' },
    protest: { icon: '📢', color: '#eab308' },
    strike: { icon: '💥', color: '#ef4444' },
    explosion: { icon: '💥', color: '#ef4444' },
    checkpoint: { icon: '🏛️', color: '#3b82f6' },
    naval_zone: { icon: '🌊', color: '#0ea5e9' },
};

interface AssetMarkerProps {
    asset: ConflictAsset;
    radius: number;
    onClick?: (asset: ConflictAsset) => void;
}

function AssetMarker({ asset, radius, onClick }: AssetMarkerProps) {
    const position = latLngToVector3(asset.lat, asset.lng, radius);
    const iconConfig = ASSET_ICONS[asset.type] || { icon: '📍', color: '#6b7280' };

    return (
        <Html
            position={[position.x, position.y, position.z]}
            center
            distanceFactor={8}
            zIndexRange={[100, 0]}
            style={{ pointerEvents: 'auto', zIndex: 100 }}
        >
            <div
                className="relative cursor-pointer group"
                onClick={() => onClick?.(asset)}
                title={asset.label || asset.type}
            >
                {/* Glow effect */}
                <div
                    className="absolute inset-0 rounded-full blur-sm animate-pulse"
                    style={{
                        backgroundColor: iconConfig.color,
                        opacity: 0.4,
                        transform: 'scale(1.5)',
                    }}
                />
                {/* Icon container */}
                <div
                    className="relative flex items-center justify-center w-6 h-6 rounded-full border-2 shadow-lg transition-transform group-hover:scale-125"
                    style={{
                        backgroundColor: '#0a0b0d',
                        borderColor: iconConfig.color,
                        boxShadow: `0 0 8px ${iconConfig.color}`,
                    }}
                >
                    <span className="text-xs">{iconConfig.icon}</span>
                </div>
                {/* Label on hover */}
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-6 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    <div className="bg-black/90 text-white text-[9px] px-2 py-0.5 rounded border border-white/20">
                        {asset.label || asset.type}
                    </div>
                </div>
            </div>
        </Html>
    );
}

interface EventMarkerProps {
    event: ConflictEvent;
    radius: number;
    onClick?: (event: ConflictEvent) => void;
}

function EventMarker({ event, radius, onClick }: EventMarkerProps) {
    const position = latLngToVector3(event.lat, event.lng, radius);

    const severityColors: Record<string, string> = {
        critical: '#dc2626',
        high: '#f97316',
        medium: '#eab308',
        low: '#22c55e',
    };

    const color = severityColors[event.severity] || '#6b7280';

    return (
        <Html
            position={[position.x, position.y, position.z]}
            center
            distanceFactor={8}
            zIndexRange={[100, 0]}
            style={{ pointerEvents: 'auto', zIndex: 100 }}
        >
            <div
                className="relative cursor-pointer group"
                onClick={() => onClick?.(event)}
                title={event.title}
            >
                {/* Pulsing ring for events */}
                <div
                    className="absolute inset-0 rounded-full animate-ping"
                    style={{
                        backgroundColor: color,
                        opacity: 0.3,
                    }}
                />
                {/* Event dot */}
                <div
                    className="relative w-3 h-3 rounded-full border shadow-lg"
                    style={{
                        backgroundColor: color,
                        borderColor: '#fff',
                        boxShadow: `0 0 6px ${color}`,
                    }}
                />
                {/* Hover tooltip */}
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-8 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                    <div className="bg-black/95 text-white text-[9px] px-2 py-1 rounded border border-white/20 max-w-[150px]">
                        <div className="font-bold truncate">{event.title}</div>
                        <div className="text-gray-400">{event.source}</div>
                    </div>
                </div>
            </div>
        </Html>
    );
}

interface ConflictZoneLayerProps {
    radius: number;
    onAssetClick?: (asset: ConflictAsset) => void;
    onEventClick?: (event: ConflictEvent) => void;
}

export function ConflictZoneLayer({ radius, onAssetClick, onEventClick }: ConflictZoneLayerProps) {
    const isActive = useLayerStore((s) => s.isLayerActive('CONFLICTS'));
    const [zones, setZones] = useState<ConflictZone[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchAllZones = useCallback(async () => {
        if (!isActive) return;

        setIsLoading(true);
        setError(null);

        const regions: ConflictRegion[] = ['ukraine', 'iran', 'venezuela', 'taiwan'];

        try {
            const results = await Promise.all(
                regions.map(async (region) => {
                    try {
                        const res = await fetch(`/api/conflicts/osint?region=${region}`);
                        if (!res.ok) throw new Error(`Failed to fetch ${region}`);
                        const data: OSINTResponse = await res.json();
                        return data.zone;
                    } catch (e) {
                        console.error(`[ConflictLayer] Error fetching ${region}:`, e);
                        return null;
                    }
                })
            );

            const validZones = results.filter((z): z is ConflictZone => z !== null);
            console.log('[ConflictLayer] Fetched zones:', validZones.length, validZones.map(z => ({ id: z.id, assets: z.assets.length })));
            setZones(validZones);
        } catch (e) {
            setError('Failed to fetch conflict data');
            console.error('[ConflictLayer] Error:', e);
        } finally {
            setIsLoading(false);
        }
    }, [isActive]);

    // Initial fetch
    useEffect(() => {
        console.log('[ConflictLayer] isActive changed:', isActive);
        if (isActive) {
            console.log('[ConflictLayer] Fetching zones...');
            fetchAllZones();
        }
    }, [isActive, fetchAllZones]);

    // Polling every 60 seconds
    useEffect(() => {
        if (!isActive) return;

        const interval = setInterval(fetchAllZones, 60000);
        return () => clearInterval(interval);
    }, [isActive, fetchAllZones]);

    if (!isActive) return null;

    return (
        <group>
            {/* Render assets for each zone */}
            {zones.map((zone) => (
                <group key={zone.id}>
                    {/* Assets (ships, troops, etc.) */}
                    {zone.assets.map((asset) => (
                        <AssetMarker
                            key={asset.id}
                            asset={asset}
                            radius={radius + 0.06}
                            onClick={onAssetClick}
                        />
                    ))}

                    {/* Recent events */}
                    {zone.recentEvents.slice(0, 5).map((event) => (
                        <EventMarker
                            key={event.id}
                            event={event}
                            radius={radius + 0.05}
                            onClick={onEventClick}
                        />
                    ))}
                </group>
            ))}

            {/* Loading indicator */}
            {isLoading && zones.length === 0 && (
                <Html center>
                    <div className="text-xs text-gray-400 bg-black/80 px-2 py-1 rounded">
                        Loading conflict data...
                    </div>
                </Html>
            )}
        </group>
    );
}
