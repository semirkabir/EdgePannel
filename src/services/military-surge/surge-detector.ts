import type { MilitaryFlight } from '@/types';
import { MILITARY_BASES_EXPANDED } from '@/config/bases-expanded';
import {
  THEATERS,
  SURGE_THRESHOLD,
  BASELINE_WINDOW_HOURS,
  BASELINE_MIN_SAMPLES,
  TRANSPORT_CALLSIGN_PATTERNS,
  PROXIMITY_RADIUS_KM,
  CLEANUP_INTERVAL,
  MAX_HISTORY_HOURS,
} from './constants';
import type { MilitaryTheater, SurgeAlert, TheaterActivity } from './constants';

export const activityHistory = new Map<string, TheaterActivity[]>();
const activeSurges = new Map<string, SurgeAlert>();
let lastCleanup = Date.now();

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getTheaterForBase(baseId: string): MilitaryTheater | null {
  for (const theater of THEATERS) {
    if (theater.baseIds.includes(baseId)) {
      return theater;
    }
  }
  return null;
}

function findNearbyBases(lat: number, lon: number): { baseId: string; baseName: string; distance: number }[] {
  const nearby: { baseId: string; baseName: string; distance: number }[] = [];
  for (const base of MILITARY_BASES_EXPANDED) {
    const dist = distanceKm(lat, lon, base.lat, base.lon);
    if (dist <= PROXIMITY_RADIUS_KM) {
      nearby.push({ baseId: base.id, baseName: base.name, distance: dist });
    }
  }
  return nearby.sort((a, b) => a.distance - b.distance);
}

function isTransportFlight(flight: MilitaryFlight): boolean {
  if (flight.aircraftType === 'transport' || flight.aircraftType === 'tanker') {
    return true;
  }
  const callsign = flight.callsign.toUpperCase();
  return TRANSPORT_CALLSIGN_PATTERNS.some(p => p.test(callsign));
}

export function classifyFlight(flight: MilitaryFlight): 'transport' | 'fighter' | 'recon' | 'other' {
  if (isTransportFlight(flight)) return 'transport';
  if (flight.aircraftType === 'fighter') return 'fighter';
  if (flight.aircraftType === 'reconnaissance' || flight.aircraftType === 'awacs') return 'recon';
  return 'other';
}

function getTheaterForFlight(flight: MilitaryFlight): MilitaryTheater | null {
  const nearbyBases = findNearbyBases(flight.lat, flight.lon);
  for (const { baseId } of nearbyBases) {
    const theater = getTheaterForBase(baseId);
    if (theater) return theater;
  }
  for (const theater of THEATERS) {
    const dist = distanceKm(flight.lat, flight.lon, theater.centerLat, theater.centerLon);
    if (dist < 1500) return theater;
  }
  return null;
}

function calculateBaseline(theaterId: string): { transport: number; fighter: number; recon: number } {
  const history = activityHistory.get(theaterId) || [];
  const cutoff = Date.now() - BASELINE_WINDOW_HOURS * 60 * 60 * 1000;
  const relevant = history.filter(h => h.timestamp >= cutoff);

  if (relevant.length < BASELINE_MIN_SAMPLES) {
    return { transport: 3, fighter: 2, recon: 1 };
  }

  const avgTransport = relevant.reduce((sum, h) => sum + h.transportCount, 0) / relevant.length;
  const avgFighter = relevant.reduce((sum, h) => sum + h.fighterCount, 0) / relevant.length;
  const avgRecon = relevant.reduce((sum, h) => sum + h.reconCount, 0) / relevant.length;

  return {
    transport: Math.max(2, avgTransport),
    fighter: Math.max(1, avgFighter),
    recon: Math.max(1, avgRecon),
  };
}

function cleanupOldHistory(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const cutoff = now - MAX_HISTORY_HOURS * 60 * 60 * 1000;
  for (const [theaterId, history] of activityHistory) {
    const filtered = history.filter(h => h.timestamp >= cutoff);
    if (filtered.length === 0) {
      activityHistory.delete(theaterId);
    } else {
      activityHistory.set(theaterId, filtered);
    }
  }

  for (const [surgeId, surge] of activeSurges) {
    const age = now - surge.lastUpdated.getTime();
    if (age > 2 * 60 * 60 * 1000) {
      activeSurges.delete(surgeId);
    }
  }
}

export function analyzeFlightsForSurge(flights: MilitaryFlight[]): SurgeAlert[] {
  cleanupOldHistory();

  const theaterFlights = new Map<string, MilitaryFlight[]>();
  for (const flight of flights) {
    const theater = getTheaterForFlight(flight);
    if (!theater) continue;
    const existing = theaterFlights.get(theater.id) || [];
    existing.push(flight);
    theaterFlights.set(theater.id, existing);
  }

  const now = Date.now();
  const newAlerts: SurgeAlert[] = [];

  for (const [theaterId, theaterFlightList] of theaterFlights) {
    const theater = THEATERS.find(t => t.id === theaterId);
    if (!theater) continue;

    let transportCount = 0;
    let fighterCount = 0;
    let reconCount = 0;
    const aircraftTypes = new Map<string, number>();
    const nearbyBasesSet = new Set<string>();

    for (const flight of theaterFlightList) {
      const classification = classifyFlight(flight);
      if (classification === 'transport') transportCount++;
      else if (classification === 'fighter') fighterCount++;
      else if (classification === 'recon') reconCount++;

      const typeKey = flight.aircraftModel || flight.aircraftType || 'unknown';
      aircraftTypes.set(typeKey, (aircraftTypes.get(typeKey) || 0) + 1);

      const nearby = findNearbyBases(flight.lat, flight.lon);
      for (const { baseName } of nearby.slice(0, 3)) {
        nearbyBasesSet.add(baseName);
      }
    }

    const activity: TheaterActivity = {
      theaterId,
      timestamp: now,
      transportCount,
      fighterCount,
      reconCount,
      totalMilitary: theaterFlightList.length,
      flightIds: theaterFlightList.map(f => f.id),
    };

    const history = activityHistory.get(theaterId) || [];
    history.push(activity);
    if (history.length > 200) history.shift();
    activityHistory.set(theaterId, history);

    const baseline = calculateBaseline(theaterId);

    if (transportCount >= baseline.transport * SURGE_THRESHOLD && transportCount >= 5) {
      const surgeId = `airlift-${theaterId}`;
      const surgeMultiple = transportCount / baseline.transport;

      const existing = activeSurges.get(surgeId);
      if (existing) {
        existing.currentCount = transportCount;
        existing.surgeMultiple = surgeMultiple;
        existing.aircraftTypes = aircraftTypes;
        existing.nearbyBases = Array.from(nearbyBasesSet);
        existing.lastUpdated = new Date();
      } else {
        const alert: SurgeAlert = {
          id: surgeId,
          theater,
          type: 'airlift',
          currentCount: transportCount,
          baselineCount: Math.round(baseline.transport),
          surgeMultiple,
          aircraftTypes,
          nearbyBases: Array.from(nearbyBasesSet),
          firstDetected: new Date(),
          lastUpdated: new Date(),
        };
        activeSurges.set(surgeId, alert);
        newAlerts.push(alert);
      }
    }

    if (fighterCount >= baseline.fighter * SURGE_THRESHOLD && fighterCount >= 4) {
      const surgeId = `fighter-${theaterId}`;
      const surgeMultiple = fighterCount / baseline.fighter;

      if (!activeSurges.has(surgeId)) {
        const alert: SurgeAlert = {
          id: surgeId,
          theater,
          type: 'fighter',
          currentCount: fighterCount,
          baselineCount: Math.round(baseline.fighter),
          surgeMultiple,
          aircraftTypes,
          nearbyBases: Array.from(nearbyBasesSet),
          firstDetected: new Date(),
          lastUpdated: new Date(),
        };
        activeSurges.set(surgeId, alert);
        newAlerts.push(alert);
      }
    }
  }

  return newAlerts;
}

export function getActiveSurges(): SurgeAlert[] {
  return Array.from(activeSurges.values());
}

export function getTheaterActivity(theaterId: string): TheaterActivity[] {
  return activityHistory.get(theaterId) || [];
}
