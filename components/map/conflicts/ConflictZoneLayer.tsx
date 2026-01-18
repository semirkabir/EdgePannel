'use client';

import { useState, useEffect, useCallback } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useLayerStore } from '@/lib/store/layer-store';
import {
    ConflictZone,
    ConflictAsset,
    ConflictEvent,
    ConflictRegion,
    OSINTResponse,
    NuclearFacility,
    NavalGroup,
    ControlZone,
    FrontLine,
    AlertLevel
} from '@/types/conflicts';
import { NuclearFacilityMarker } from './NuclearFacilityMarker';
import { NavalGroupMarker } from './NavalGroupMarker';
import { ControlZoneLayer } from './ControlZoneLayer';
import { AlertLevelBadge } from './AlertLevelBadge';

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

// Enhanced asset icons with more variety
const ASSET_ICONS: Record<string, { icon: string; color: string }> = {
    warship: { icon: '🚢', color: '#ef4444' },
    carrier: { icon: '⚓', color: '#dc2626' },
    destroyer: { icon: '🚢', color: '#dc2626' },
    frigate: { icon: '🚢', color: '#f97316' },
    submarine: { icon: '🔱', color: '#6b7280' },
    patrol_boat: { icon: '⛵', color: '#f97316' },
    aircraft: { icon: '✈️', color: '#f97316' },
    drone: { icon: '🎯', color: '#8b5cf6' },
    troops: { icon: '⚔️', color: '#dc2626' },
    missile: { icon: '🚀', color: '#b91c1c' },
    missile_launcher: { icon: '🚀', color: '#b91c1c' },
    radar: { icon: '📡', color: '#3b82f6' },
    sam_site: { icon: '🛡️', color: '#22c55e' },
    protest: { icon: '📢', color: '#eab308' },
    strike: { icon: '💥', color: '#ef4444' },
    explosion: { icon: '💥', color: '#ef4444' },
    checkpoint: { icon: '🏛️', color: '#3b82f6' },
    naval_zone: { icon: '🌊', color: '#0ea5e9' },
    nuclear: { icon: '☢️', color: '#eab308' },
    base: { icon: '🏰', color: '#6b7280' },
    airbase: { icon: '🛫', color: '#3b82f6' },
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
                {/* Nationality badge */}
                {asset.nationality && (
                    <div
                        className="absolute -top-1 -right-1 px-1 py-0.5 rounded text-[7px] font-bold"
                        style={{
                            backgroundColor: iconConfig.color,
                            color: 'white',
                        }}
                    >
                        {asset.nationality}
                    </div>
                )}
                {/* Label on hover */}
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-6 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    <div className="bg-black/90 text-white text-[9px] px-2 py-0.5 rounded border border-white/20">
                        {asset.label || asset.type}
                        {asset.class && <span className="text-gray-400 ml-1">({asset.class})</span>}
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

interface RegionAlertBadgeProps {
    region: ConflictRegion;
    alertLevel: AlertLevel;
    centerLat: number;
    centerLng: number;
    radius: number;
}

function RegionAlertBadge({ region, alertLevel, centerLat, centerLng, radius }: RegionAlertBadgeProps) {
    const position = latLngToVector3(centerLat, centerLng, radius + 0.1);

    const regionNames: Record<ConflictRegion, string> = {
        ukraine: 'Ukraine',
        iran: 'Iran',
        venezuela: 'Venezuela',
        taiwan: 'Taiwan',
        israel: 'Israel',
    };

    return (
        <Html
            position={[position.x, position.y, position.z]}
            center
            distanceFactor={12}
            zIndexRange={[200, 0]}
            style={{ pointerEvents: 'auto', zIndex: 200 }}
        >
            <AlertLevelBadge
                level={alertLevel}
                regionName={regionNames[region]}
                size="sm"
                className="shadow-lg"
            />
        </Html>
    );
}

interface ConflictZoneLayerProps {
    radius: number;
    onAssetClick?: (asset: ConflictAsset) => void;
    onEventClick?: (event: ConflictEvent) => void;
    onNavalGroupClick?: (group: NavalGroup) => void;
    onNuclearFacilityClick?: (facility: NuclearFacility) => void;
}

export function ConflictZoneLayer({
    radius,
    onAssetClick,
    onEventClick,
    onNavalGroupClick,
    onNuclearFacilityClick,
}: ConflictZoneLayerProps) {
    const isActive = useLayerStore((s) => s.isLayerActive('CONFLICTS'));
    const [zones, setZones] = useState<ConflictZone[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchAllZones = useCallback(async () => {
        if (!isActive) return;

        setIsLoading(true);
        setError(null);

        const regions: ConflictRegion[] = ['ukraine', 'iran', 'venezuela', 'taiwan', 'israel'];

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
            console.log('[ConflictLayer] Fetched zones:', validZones.length, validZones.map(z => ({
                id: z.id,
                assets: z.assets.length,
                navalGroups: z.navalGroups?.length || 0,
                nuclearFacilities: z.nuclearFacilities?.length || 0,
                controlZones: z.controlZones?.length || 0,
            })));
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
            {/* Render each zone */}
            {zones.map((zone) => (
                <group key={zone.id}>
                    {/* Alert level badge at region center */}
                    {zone.alertLevel && (
                        <RegionAlertBadge
                            region={zone.id}
                            alertLevel={zone.alertLevel}
                            centerLat={zone.centerLat}
                            centerLng={zone.centerLng}
                            radius={radius}
                        />
                    )}

                    {/* Control zones and frontlines (Ukraine, Israel) */}
                    {(zone.controlZones || zone.frontLines) && (
                        <ControlZoneLayer
                            controlZones={zone.controlZones}
                            frontLines={zone.frontLines}
                            radius={radius}
                            showLabels={true}
                        />
                    )}

                    {/* Naval groups (Taiwan, Venezuela, Israel) */}
                    {zone.navalGroups?.map((group) => (
                        <NavalGroupMarker
                            key={group.id}
                            group={group}
                            radius={radius + 0.06}
                            onClick={onNavalGroupClick}
                        />
                    ))}

                    {/* Nuclear facilities (Iran) */}
                    {zone.nuclearFacilities?.map((facility) => (
                        <NuclearFacilityMarker
                            key={facility.id}
                            facility={facility}
                            radius={radius + 0.06}
                            onClick={onNuclearFacilityClick}
                        />
                    ))}

                    {/* Standard assets (all regions) */}
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
