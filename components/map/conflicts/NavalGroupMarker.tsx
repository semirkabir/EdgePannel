'use client';

import { NavalGroup, ConflictAsset } from '@/types/conflicts';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Ship, Anchor, Plane, Navigation, Target } from 'lucide-react';

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

interface NavalGroupMarkerProps {
    group: NavalGroup;
    radius: number;
    onClick?: (group: NavalGroup) => void;
}

const NATIONALITY_COLORS: Record<string, { primary: string; secondary: string }> = {
    US: { primary: '#3b82f6', secondary: '#1d4ed8' },
    CN: { primary: '#ef4444', secondary: '#dc2626' },
    RU: { primary: '#ef4444', secondary: '#b91c1c' },
    TW: { primary: '#22c55e', secondary: '#16a34a' },
    VE: { primary: '#eab308', secondary: '#ca8a04' },
    IL: { primary: '#3b82f6', secondary: '#2563eb' },
    IR: { primary: '#f97316', secondary: '#ea580c' },
    DEFAULT: { primary: '#6b7280', secondary: '#4b5563' },
};

const FORMATION_ICONS: Record<string, { icon: React.ElementType; label: string }> = {
    patrol: { icon: Ship, label: 'Patrol' },
    blockade: { icon: Anchor, label: 'Blockade' },
    exercise: { icon: Target, label: 'Exercise' },
    transit: { icon: Navigation, label: 'Transit' },
    carrier_strike_group: { icon: Plane, label: 'CSG' },
    amphibious_ready_group: { icon: Ship, label: 'ARG' },
};

export function NavalGroupMarker({
    group,
    radius,
    onClick,
}: NavalGroupMarkerProps) {
    const position = latLngToVector3(group.centerLat, group.centerLng, radius);
    const colors = NATIONALITY_COLORS[group.nationality] || NATIONALITY_COLORS.DEFAULT;
    const formation = FORMATION_ICONS[group.formation] || FORMATION_ICONS.patrol;
    const FormationIcon = formation.icon;

    const vesselCount = group.vessels.length;

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
                onClick={() => onClick?.(group)}
                title={group.name}
            >
                {/* Direction indicator arrow */}
                {group.heading !== undefined && (
                    <div
                        className="absolute left-1/2 top-1/2 w-12 h-0.5 origin-left opacity-60"
                        style={{
                            backgroundColor: colors.primary,
                            transform: `translate(-50%, -50%) rotate(${-group.heading + 90}deg)`,
                        }}
                    >
                        <div
                            className="absolute right-0 w-0 h-0 border-l-4 border-t-2 border-b-2 border-l-current border-t-transparent border-b-transparent"
                            style={{ color: colors.primary, transform: 'translateX(2px) translateY(-3px)' }}
                        />
                    </div>
                )}

                {/* Main group icon */}
                <div
                    className="relative flex items-center justify-center w-10 h-10 rounded-lg border-2 shadow-lg transition-transform group-hover:scale-110"
                    style={{
                        backgroundColor: '#0a0b0d',
                        borderColor: colors.primary,
                        boxShadow: `0 0 16px ${colors.primary}40`,
                    }}
                >
                    <FormationIcon className="w-5 h-5" style={{ color: colors.primary }} />

                    {/* Vessel count badge */}
                    <div
                        className="absolute -top-2 -right-2 flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold border"
                        style={{
                            backgroundColor: colors.primary,
                            borderColor: colors.secondary,
                            color: 'white',
                        }}
                    >
                        {vesselCount}
                    </div>
                </div>

                {/* Nationality flag indicator */}
                <div
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase"
                    style={{
                        backgroundColor: colors.primary,
                        color: 'white',
                    }}
                >
                    {group.nationality}
                </div>

                {/* Hover tooltip */}
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-20 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                    <div className="bg-black/95 text-white text-[10px] px-3 py-2 rounded-lg border border-white/20 min-w-[160px] shadow-xl">
                        <div className="font-bold text-xs mb-1.5" style={{ color: colors.primary }}>
                            {group.name}
                        </div>
                        <div className="flex items-center gap-2 text-gray-400 mb-0.5">
                            <span>Formation:</span>
                            <span className="text-white capitalize">{formation.label}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400 mb-0.5">
                            <span>Vessels:</span>
                            <span className="text-white">{vesselCount}</span>
                        </div>
                        {group.estimatedStrength && (
                            <div className="flex items-center gap-2 text-gray-400 mb-0.5">
                                <span>Strength:</span>
                                <span className="text-white">{group.estimatedStrength}</span>
                            </div>
                        )}
                        {group.heading !== undefined && (
                            <div className="flex items-center gap-2 text-gray-400">
                                <span>Heading:</span>
                                <span className="text-white">{group.heading}°</span>
                            </div>
                        )}

                        {/* Vessel list */}
                        {group.vessels.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-white/10">
                                <div className="text-gray-500 text-[9px] uppercase mb-1">Vessels</div>
                                {group.vessels.slice(0, 4).map((vessel) => (
                                    <div key={vessel.id} className="flex items-center gap-1 text-[9px] text-gray-300">
                                        <Ship className="w-2.5 h-2.5" style={{ color: colors.primary }} />
                                        <span>{vessel.label || vessel.type}</span>
                                    </div>
                                ))}
                                {group.vessels.length > 4 && (
                                    <div className="text-gray-500 text-[9px]">
                                        +{group.vessels.length - 4} more vessels
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Html>
    );
}

export default NavalGroupMarker;
