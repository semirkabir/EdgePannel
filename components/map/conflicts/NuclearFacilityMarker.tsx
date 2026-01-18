'use client';

import { NuclearFacility } from '@/types/conflicts';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Radiation, AlertTriangle, Activity, Factory, Box } from 'lucide-react';

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

interface NuclearFacilityMarkerProps {
    facility: NuclearFacility;
    radius: number;
    onClick?: (facility: NuclearFacility) => void;
}

const FACILITY_TYPE_ICONS: Record<string, React.ElementType> = {
    enrichment: Radiation,
    research: Activity,
    reactor: Factory,
    storage: Box,
    conversion: AlertTriangle,
};

const STATUS_COLORS: Record<string, { color: string; glow: string; pulse: boolean }> = {
    active: { color: '#ef4444', glow: 'rgba(239, 68, 68, 0.6)', pulse: true },
    suspended: { color: '#eab308', glow: 'rgba(234, 179, 8, 0.4)', pulse: false },
    construction: { color: '#f97316', glow: 'rgba(249, 115, 22, 0.4)', pulse: true },
    destroyed: { color: '#6b7280', glow: 'rgba(107, 114, 128, 0.3)', pulse: false },
    unknown: { color: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.4)', pulse: false },
};

export function NuclearFacilityMarker({
    facility,
    radius,
    onClick,
}: NuclearFacilityMarkerProps) {
    const position = latLngToVector3(facility.lat, facility.lng, radius);
    const Icon = FACILITY_TYPE_ICONS[facility.type] || Radiation;
    const statusConfig = STATUS_COLORS[facility.status] || STATUS_COLORS.unknown;

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
                onClick={() => onClick?.(facility)}
                title={facility.name}
            >
                {/* Glow effect */}
                <div
                    className={`absolute inset-0 rounded-full blur-md ${statusConfig.pulse ? 'animate-pulse' : ''}`}
                    style={{
                        backgroundColor: statusConfig.glow,
                        transform: 'scale(2)',
                    }}
                />

                {/* Main icon container */}
                <div
                    className="relative flex items-center justify-center w-8 h-8 rounded-full border-2 shadow-lg transition-transform group-hover:scale-125"
                    style={{
                        backgroundColor: '#0a0b0d',
                        borderColor: statusConfig.color,
                        boxShadow: `0 0 12px ${statusConfig.glow}`,
                    }}
                >
                    <Icon className="w-4 h-4" style={{ color: statusConfig.color }} />
                </div>

                {/* Hover tooltip */}
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-16 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                    <div className="bg-black/95 text-white text-[10px] px-3 py-2 rounded-lg border border-white/20 min-w-[140px] shadow-xl">
                        <div className="font-bold text-xs mb-1 truncate" style={{ color: statusConfig.color }}>
                            {facility.name}
                        </div>
                        <div className="flex items-center gap-2 text-gray-400 mb-0.5">
                            <span>Type:</span>
                            <span className="text-white capitalize">{facility.type}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400 mb-0.5">
                            <span>Status:</span>
                            <span className="text-white capitalize" style={{ color: statusConfig.color }}>
                                {facility.status}
                            </span>
                        </div>
                        {facility.enrichmentLevel && (
                            <div className="flex items-center gap-2 text-gray-400 mb-0.5">
                                <span>Enrichment:</span>
                                <span className="text-red-400 font-bold">{facility.enrichmentLevel}</span>
                            </div>
                        )}
                        {facility.centrifuges && (
                            <div className="flex items-center gap-2 text-gray-400 mb-0.5">
                                <span>Centrifuges:</span>
                                <span className="text-white">{facility.centrifuges.toLocaleString()}</span>
                            </div>
                        )}
                        {facility.iaeaAccess !== undefined && (
                            <div className="flex items-center gap-2 text-gray-400">
                                <span>IAEA Access:</span>
                                <span className={facility.iaeaAccess ? 'text-green-400' : 'text-red-400'}>
                                    {facility.iaeaAccess ? 'Yes' : 'No'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Html>
    );
}

export default NuclearFacilityMarker;
