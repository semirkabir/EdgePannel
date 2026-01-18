'use client';

import { ControlZone, FrontLine } from '@/types/conflicts';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useMemo } from 'react';

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

// Calculate centroid of polygon
function getPolygonCentroid(polygon: Array<{ lat: number; lng: number }>): { lat: number; lng: number } {
    const n = polygon.length;
    const sum = polygon.reduce(
        (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
        { lat: 0, lng: 0 }
    );
    return { lat: sum.lat / n, lng: sum.lng / n };
}

interface ControlZoneLabelProps {
    zone: ControlZone;
    radius: number;
}

const CONTROL_COLORS: Record<string, { fill: string; border: string; text: string }> = {
    russia: { fill: 'rgba(185, 28, 28, 0.25)', border: '#dc2626', text: '#fee2e2' },
    ukraine: { fill: 'rgba(37, 99, 235, 0.25)', border: '#3b82f6', text: '#dbeafe' },
    contested: { fill: 'rgba(234, 179, 8, 0.3)', border: '#eab308', text: '#fef3c7' },
    israel: { fill: 'rgba(37, 99, 235, 0.25)', border: '#3b82f6', text: '#dbeafe' },
    hamas: { fill: 'rgba(34, 197, 94, 0.25)', border: '#22c55e', text: '#dcfce7' },
    hezbollah: { fill: 'rgba(249, 115, 22, 0.25)', border: '#f97316', text: '#ffedd5' },
};

function ControlZoneLabel({ zone, radius }: ControlZoneLabelProps) {
    const centroid = getPolygonCentroid(zone.polygon);
    const position = latLngToVector3(centroid.lat, centroid.lng, radius);
    const colors = CONTROL_COLORS[zone.controlledBy] || CONTROL_COLORS.contested;

    return (
        <Html
            position={[position.x, position.y, position.z]}
            center
            distanceFactor={10}
            zIndexRange={[50, 0]}
            style={{ pointerEvents: 'none', zIndex: 50 }}
        >
            <div
                className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide whitespace-nowrap border"
                style={{
                    backgroundColor: colors.fill,
                    borderColor: colors.border,
                    color: colors.text,
                    textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                }}
            >
                {zone.name}
            </div>
        </Html>
    );
}

interface FrontLineLabelProps {
    frontLine: FrontLine;
    radius: number;
}

function FrontLineLabel({ frontLine, radius }: FrontLineLabelProps) {
    // Get midpoint of frontline
    const midIdx = Math.floor(frontLine.points.length / 2);
    const midPoint = frontLine.points[midIdx];
    const position = latLngToVector3(midPoint.lat, midPoint.lng, radius);

    const typeColors: Record<string, string> = {
        contested: '#eab308',
        controlled: '#22c55e',
        disputed: '#f97316',
    };

    return (
        <Html
            position={[position.x, position.y, position.z]}
            center
            distanceFactor={10}
            zIndexRange={[60, 0]}
            style={{ pointerEvents: 'none', zIndex: 60 }}
        >
            <div className="flex flex-col items-center gap-0.5">
                <div
                    className="w-20 h-0.5 animate-pulse"
                    style={{ backgroundColor: typeColors[frontLine.type] || '#eab308' }}
                />
                {frontLine.name && (
                    <div
                        className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide"
                        style={{
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            color: typeColors[frontLine.type] || '#eab308',
                            border: `1px solid ${typeColors[frontLine.type] || '#eab308'}`,
                        }}
                    >
                        {frontLine.name}
                    </div>
                )}
            </div>
        </Html>
    );
}

interface ControlZoneLayerProps {
    controlZones?: ControlZone[];
    frontLines?: FrontLine[];
    radius: number;
    showLabels?: boolean;
}

export function ControlZoneLayer({
    controlZones = [],
    frontLines = [],
    radius,
    showLabels = true,
}: ControlZoneLayerProps) {
    // For 3D globe, we render labels at zone centers
    // Actual polygon rendering would require custom shaders or mesh generation
    // This simplified version shows markers at control zone centers

    const zoneCenters = useMemo(() => {
        return controlZones.map((zone) => {
            const centroid = getPolygonCentroid(zone.polygon);
            return { zone, centroid };
        });
    }, [controlZones]);

    return (
        <group>
            {/* Control zone labels */}
            {showLabels && controlZones.map((zone) => (
                <ControlZoneLabel key={zone.id} zone={zone} radius={radius + 0.02} />
            ))}

            {/* Front line labels */}
            {showLabels && frontLines.map((line) => (
                <FrontLineLabel key={line.id} frontLine={line} radius={radius + 0.03} />
            ))}

            {/* Control zone center markers */}
            {zoneCenters.map(({ zone, centroid }) => {
                const position = latLngToVector3(centroid.lat, centroid.lng, radius);
                const colors = CONTROL_COLORS[zone.controlledBy] || CONTROL_COLORS.contested;

                return (
                    <mesh key={`marker-${zone.id}`} position={[position.x, position.y, position.z]}>
                        <sphereGeometry args={[0.015, 8, 8]} />
                        <meshBasicMaterial
                            color={colors.border}
                            transparent
                            opacity={0.8}
                        />
                    </mesh>
                );
            })}
        </group>
    );
}

export default ControlZoneLayer;
