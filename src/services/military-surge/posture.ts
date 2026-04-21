import type { MilitaryFlight } from '@/types';
import { getCountryScore } from '../country-instability';
import {
  POSTURE_THEATERS,
  TARGET_NATION_CODES,
} from './constants';
import type { TheaterPostureSummary } from './constants';
import { activityHistory } from './surge-detector';

export function getTheaterPostureSummaries(flights: MilitaryFlight[]): TheaterPostureSummary[] {
  const summaries: TheaterPostureSummary[] = [];

  for (const theater of POSTURE_THEATERS) {
    const theaterFlights = flights.filter(
      (f) =>
        f.lat >= theater.bounds.south &&
        f.lat <= theater.bounds.north &&
        f.lon >= theater.bounds.west &&
        f.lon <= theater.bounds.east
    );

    const byType = {
      fighters: theaterFlights.filter((f) => f.aircraftType === 'fighter').length,
      tankers: theaterFlights.filter((f) => f.aircraftType === 'tanker').length,
      awacs: theaterFlights.filter((f) => f.aircraftType === 'awacs').length,
      reconnaissance: theaterFlights.filter((f) => f.aircraftType === 'reconnaissance').length,
      transport: theaterFlights.filter((f) => f.aircraftType === 'transport').length,
      bombers: theaterFlights.filter((f) => f.aircraftType === 'bomber').length,
      drones: theaterFlights.filter((f) => f.aircraftType === 'drone').length,
    };

    const total = Object.values(byType).reduce((a, b) => a + b, 0);

    const byOperator: Record<string, number> = {};
    for (const f of theaterFlights) {
      byOperator[f.operator] = (byOperator[f.operator] || 0) + 1;
    }

    const postureLevel: 'normal' | 'elevated' | 'critical' =
      total >= theater.thresholds.critical
        ? 'critical'
        : total >= theater.thresholds.elevated
          ? 'elevated'
          : 'normal';

    const strikeCapable =
      byType.tankers >= theater.strikeIndicators.minTankers &&
      byType.awacs >= theater.strikeIndicators.minAwacs &&
      byType.fighters >= theater.strikeIndicators.minFighters;

    const history = activityHistory.get(theater.id) || [];
    const recent = history.slice(-6);
    const older = history.slice(-12, -6);
    const recentAvg =
      recent.length > 0 ? recent.reduce((a, b) => a + b.totalMilitary, 0) / recent.length : total;
    const olderAvg =
      older.length > 0 ? older.reduce((a, b) => a + b.totalMilitary, 0) / older.length : total;
    const changePercent = olderAvg > 0 ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100) : 0;
    const trend: 'increasing' | 'stable' | 'decreasing' =
      changePercent > 10 ? 'increasing' : changePercent < -10 ? 'decreasing' : 'stable';

    const parts: string[] = [];
    if (byType.fighters > 0) parts.push(`${byType.fighters} fighters`);
    if (byType.tankers > 0) parts.push(`${byType.tankers} tankers`);
    if (byType.awacs > 0) parts.push(`${byType.awacs} AWACS`);
    if (byType.reconnaissance > 0) parts.push(`${byType.reconnaissance} recon`);
    const summary = parts.join(', ') || 'No military aircraft';

    const headline =
      postureLevel === 'critical'
        ? `Critical military buildup - ${theater.name}`
        : postureLevel === 'elevated'
          ? `Elevated military activity - ${theater.name}`
          : `Normal activity - ${theater.name}`;

    summaries.push({
      theaterId: theater.id,
      theaterName: theater.name,
      shortName: theater.shortName,
      targetNation: theater.targetNation,
      fighters: byType.fighters,
      tankers: byType.tankers,
      awacs: byType.awacs,
      reconnaissance: byType.reconnaissance,
      transport: byType.transport,
      bombers: byType.bombers,
      drones: byType.drones,
      totalAircraft: total,
      destroyers: 0,
      frigates: 0,
      carriers: 0,
      submarines: 0,
      patrol: 0,
      auxiliaryVessels: 0,
      totalVessels: 0,
      byOperator,
      postureLevel,
      strikeCapable,
      trend,
      changePercent,
      summary,
      headline,
      centerLat: (theater.bounds.north + theater.bounds.south) / 2,
      centerLon: (theater.bounds.east + theater.bounds.west) / 2,
      bounds: theater.bounds,
    });
  }

  return summaries;
}

export function recalcPostureWithVessels(postures: TheaterPostureSummary[]): void {
  for (const p of postures) {
    const theater = POSTURE_THEATERS.find((t) => t.id === p.theaterId);
    if (!theater) continue;

    const airLevel: 0 | 1 | 2 =
      p.totalAircraft >= theater.thresholds.critical ? 2
        : p.totalAircraft >= theater.thresholds.elevated ? 1 : 0;

    const navalLevel: 0 | 1 | 2 =
      p.totalVessels >= theater.navalThresholds.critical ? 2
        : p.totalVessels >= theater.navalThresholds.elevated ? 1 : 0;

    let ciiLevel: 0 | 1 | 2 = 0;
    if (theater.targetNation) {
      const code = TARGET_NATION_CODES[theater.targetNation];
      if (code) {
        const cii = getCountryScore(code);
        if (cii !== null) {
          ciiLevel = cii >= 85 ? 2 : cii >= 70 ? 1 : 0;
        }
      }
    }

    const combined = Math.max(airLevel, navalLevel, ciiLevel) as 0 | 1 | 2;
    p.postureLevel = combined === 2 ? 'critical' : combined === 1 ? 'elevated' : 'normal';

    const parts: string[] = [];
    if (p.totalAircraft > 0) parts.push(`${p.totalAircraft} aircraft`);
    if (p.totalVessels > 0) parts.push(`${p.totalVessels} vessels`);
    const assetSummary = parts.join(' + ') || 'No assets';

    p.headline =
      p.postureLevel === 'critical'
        ? `Critical military buildup - ${p.theaterName} (${assetSummary})`
        : p.postureLevel === 'elevated'
          ? `Elevated military activity - ${p.theaterName} (${assetSummary})`
          : `Normal activity - ${p.theaterName}`;
  }
}

export function getCriticalPostures(flights: MilitaryFlight[]): TheaterPostureSummary[] {
  return getTheaterPostureSummaries(flights).filter(
    (p) => p.postureLevel === 'critical' || (p.postureLevel === 'elevated' && p.strikeCapable)
  );
}
