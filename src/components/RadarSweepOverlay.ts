/**
 * RadarSweepOverlay — classic radar sweep display for live ADS-B aircraft.
 *
 * Self-contained Canvas 2D component (follows AviationCommandBar lifecycle
 * pattern). Subscribes to `registerAircraftCallback` from `live.ts` and
 * projects aircraft into polar coordinates relative to a centre point.
 *
 * Features (AeroRadar parity):
 *  - Rotating sweep line with fading afterglow sector
 *  - Aircraft blips that brighten when the sweep passes, then fade
 *  - Freshness-coded colours (live / stale / unknown) via `getAircraftFreshness`
 *  - Range rings with km labels
 *  - Cardinal heading labels (N / E / S / W)
 *  - Centre point derived from viewport bounds or manually set
 *  - Altitude-scaled blip sizes
 */

import { haversineKm, bearingDeg } from '@/utils/geo';
import {
  registerAircraftCallback,
  unregisterAircraftCallback,
  getAircraftViewportBounds,
  getAircraftFreshness,
  getAircraftLiveStatus,
} from '@/services/aviation';
import type { PositionSample } from '@/services/aviation';

export interface RadarSweepOptions {
  maxRangeKm?: number;
  sweepPeriodMs?: number;
  centreLat?: number;
  centreLon?: number;
}

const DEFAULT_MAX_RANGE_KM = 200;
const DEFAULT_SWEEP_PERIOD_MS = 4000;
const RING_COUNT = 4;
const BLIP_TTL_MS = 60_000;
const MAX_BLIPS = 500;

interface RadarBlip {
  icao24: string;
  callsign: string;
  lat: number;
  lon: number;
  altitudeFt: number;
  groundSpeedKts: number;
  trackDeg: number;
  onGround: boolean;
  distanceKm: number;
  bearingDeg: number;
  firstSeenMs: number;
  lastSeenMs: number;
}

export class RadarSweepOverlay {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private maxRangeKm: number;
  private sweepPeriodMs: number;
  private centreLat: number;
  private centreLon: number;

  private blips = new Map<string, RadarBlip>();
  private sweepAngle = 0;
  private lastFrameMs = 0;
  private visible = false;
  private destroyed = false;

  private readonly aircraftCallback = (positions: PositionSample[]): void => {
    const now = Date.now();
    for (const pos of positions) {
      if (!pos.icao24) continue;
      const dist = haversineKm(this.centreLat, this.centreLon, pos.lat, pos.lon);
      if (dist > this.maxRangeKm * 1.1) continue;

      const brng = bearingDeg(this.centreLat, this.centreLon, pos.lat, pos.lon);
      const existing = this.blips.get(pos.icao24);
      if (existing) {
        existing.lat = pos.lat;
        existing.lon = pos.lon;
        existing.altitudeFt = pos.altitudeFt;
        existing.groundSpeedKts = pos.groundSpeedKts;
        existing.trackDeg = pos.trackDeg;
        existing.onGround = pos.onGround;
        existing.distanceKm = dist;
        existing.bearingDeg = brng;
        existing.lastSeenMs = now;
      } else {
        this.blips.set(pos.icao24, {
          icao24: pos.icao24,
          callsign: pos.callsign,
          lat: pos.lat,
          lon: pos.lon,
          altitudeFt: pos.altitudeFt,
          groundSpeedKts: pos.groundSpeedKts,
          trackDeg: pos.trackDeg,
          onGround: pos.onGround,
          distanceKm: dist,
          bearingDeg: brng,
          firstSeenMs: now,
          lastSeenMs: now,
        });
      }
    }

    if (this.blips.size > MAX_BLIPS) {
      const sorted = Array.from(this.blips.entries()).sort((a, b) => a[1].lastSeenMs - b[1].lastSeenMs);
      const toRemove = this.blips.size - MAX_BLIPS;
      for (let i = 0; i < toRemove; i++) {
        const entry = sorted[i];
        if (!entry) break;
        this.blips.delete(entry[0]);
      }
    }
  };

  constructor(container: HTMLElement, options?: RadarSweepOptions) {
    this.container = container;
    this.maxRangeKm = options?.maxRangeKm ?? DEFAULT_MAX_RANGE_KM;
    this.sweepPeriodMs = options?.sweepPeriodMs ?? DEFAULT_SWEEP_PERIOD_MS;

    const bounds = getAircraftViewportBounds();
    if (bounds) {
      this.centreLat = (bounds.swLat + bounds.neLat) / 2;
      this.centreLon = (bounds.swLon + bounds.neLon) / 2;
    } else {
      this.centreLat = options?.centreLat ?? 0;
      this.centreLon = options?.centreLon ?? 0;
    }
  }

  public init(): void {
    if (this.canvas) return;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'radar-sweep-overlay';
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:500;';
    this.container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    this.resize();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
    }

    registerAircraftCallback(this.aircraftCallback);
    this.visible = true;
    this.lastFrameMs = performance.now();
    this.animate();
  }

  public destroy(): void {
    this.destroyed = true;
    unregisterAircraftCallback(this.aircraftCallback);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
    this.blips.clear();
  }

  public show(): void {
    if (this.canvas) this.canvas.style.display = '';
    this.visible = true;
    if (this.animFrameId === null && !this.destroyed) {
      this.lastFrameMs = performance.now();
      this.animate();
    }
  }

  public hide(): void {
    if (this.canvas) this.canvas.style.display = 'none';
    this.visible = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public setCentre(lat: number, lon: number): void {
    this.centreLat = lat;
    this.centreLon = lon;
    this.blips.clear();
  }

  public setMaxRangeKm(km: number): void {
    this.maxRangeKm = Math.max(10, Math.min(2000, km));
  }

  public isVisible(): boolean {
    return this.visible;
  }

  private resize(): void {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  private animate = (): void => {
    if (this.destroyed || !this.visible || !this.ctx || !this.canvas) return;

    const now = performance.now();
    const dt = now - this.lastFrameMs;
    this.lastFrameMs = now;

    this.sweepAngle = (this.sweepAngle + (360 * dt) / this.sweepPeriodMs) % 360;

    this.draw();
    this.animFrameId = requestAnimationFrame(this.animate);
  };

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;

    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) / 2 - 30;

    ctx.clearRect(0, 0, w, h);

    // Background disk
    ctx.fillStyle = 'rgba(0, 12, 6, 0.82)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Range rings
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= RING_COUNT; i++) {
      const r = (radius * i) / RING_COUNT;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      const km = Math.round((this.maxRangeKm * i) / RING_COUNT);
      ctx.fillStyle = 'rgba(0, 255, 100, 0.35)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${km}km`, cx + 4, cy - r + 12);
    }

    // Cross hairs
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.12)';
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.stroke();

    // Cardinal labels
    ctx.fillStyle = 'rgba(0, 255, 100, 0.6)';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy - radius - 14);
    ctx.fillText('S', cx, cy + radius + 14);
    ctx.fillText('E', cx + radius + 14, cy);
    ctx.fillText('W', cx - radius - 14, cy);

    // Sweep afterglow sector (fading wedge behind the sweep line)
    const sweepRad = (this.sweepAngle * Math.PI) / 180;
    const afterglowArc = 50 * (Math.PI / 180);
    const createConic = (ctx as unknown as { createConicGradient?: (startAngle: number, x: number, y: number) => CanvasGradient });
    const gradient = createConic.createConicGradient
      ? createConic.createConicGradient(sweepRad, cx, cy)
      : null;

    if (gradient) {
      gradient.addColorStop(0, 'rgba(0, 255, 100, 0.25)');
      gradient.addColorStop(afterglowArc / (Math.PI * 2), 'rgba(0, 255, 100, 0)');
      gradient.addColorStop(1, 'rgba(0, 255, 100, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      for (let i = 0; i < 20; i++) {
        const frac = i / 20;
        const startAngle = sweepRad - afterglowArc * frac;
        const endAngle = sweepRad - afterglowArc * (frac + 1 / 20);
        ctx.fillStyle = `rgba(0, 255, 100, ${0.22 * (1 - frac)})`;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, endAngle, startAngle);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Sweep line
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(sweepRad) * radius, cy - Math.cos(sweepRad) * radius);
    ctx.stroke();

    // Blips
    const now = Date.now();
    const prunedBlips: RadarBlip[] = [];
    for (const blip of this.blips.values()) {
      if (now - blip.lastSeenMs > BLIP_TTL_MS) continue;
      prunedBlips.push(blip);
    }

    for (const blip of prunedBlips) {
      const blngRad = (blip.bearingDeg * Math.PI) / 180;
      const distFrac = Math.min(1, blip.distanceKm / this.maxRangeKm);
      const px = cx + Math.sin(blngRad) * distFrac * radius;
      const py = cy - Math.cos(blngRad) * distFrac * radius;

      // Angular distance from sweep — blips brighten when sweep passes
      let angDelta = Math.abs(this.sweepAngle - blip.bearingDeg);
      if (angDelta > 180) angDelta = 360 - angDelta;
      const sweepGlow = Math.max(0, 1 - angDelta / 60);

      // Freshness colour
      const fresh = getAircraftFreshness(blip.icao24);
      let baseR = 0, baseG = 255, baseB = 100;
      if (fresh.status === 'stale') { baseR = 255; baseG = 170; baseB = 0; }
      else if (fresh.status === 'unknown') { baseR = 120; baseG = 120; baseB = 120; }

      // On-ground aircraft slightly dimmer
      const dim = blip.onGround ? 0.55 : 1;

      const alpha = (0.35 + sweepGlow * 0.65) * dim;
      const blipSize = blip.onGround
        ? 2
        : Math.max(2.5, Math.min(5, 2.5 + (blip.altitudeFt / 10000)));

      // Glow halo
      if (sweepGlow > 0.1) {
        ctx.fillStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${sweepGlow * 0.3 * dim})`;
        ctx.beginPath();
        ctx.arc(px, py, blipSize + 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Blip dot
      ctx.fillStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, blipSize, 0, Math.PI * 2);
      ctx.fill();

      // Velocity vector (heading indicator) for airborne aircraft
      if (!blip.onGround && blip.groundSpeedKts > 10) {
        const headingRad = (blip.trackDeg * Math.PI) / 180;
        const vlen = 6 + Math.min(8, blip.groundSpeedKts / 50);
        ctx.strokeStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${alpha * 0.7})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.sin(headingRad) * vlen, py - Math.cos(headingRad) * vlen);
        ctx.stroke();
      }

      // Callsign label for close-to-sweep or bright blips
      if (sweepGlow > 0.3 && blip.callsign) {
        ctx.fillStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${sweepGlow * 0.8})`;
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(blip.callsign.trim(), px + blipSize + 3, py);
      }
    }

    // Status text (top-left)
    const status = getAircraftLiveStatus();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    ctx.fillStyle = status.connected ? 'rgba(0, 255, 100, 0.7)' : 'rgba(255, 100, 100, 0.7)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${timeStr}  ${status.connected ? 'LIVE' : 'NO DATA'}  ${status.aircraft} TRK`, 12, 12);

    // Centre info (bottom-left)
    ctx.fillStyle = 'rgba(0, 255, 100, 0.45)';
    ctx.fillText(`CTR ${this.centreLat.toFixed(2)}° ${this.centreLon.toFixed(2)}°  R ${this.maxRangeKm}km`, 12, h - 22);
  }
}
