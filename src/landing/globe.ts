/**
 * Hero globe — dependency-free canvas renderer.
 *
 * Orthographic projection of a precomputed land-dot grid, slow rotation,
 * animated great-circle "signal" arcs between hub cities, and endpoint pulses.
 * Loaded lazily so the landing page's first paint never waits on it.
 */

import { LAND_DOTS } from './land-dots';

const TILT_DEG = -16;
const ROTATE_DEG_PER_SEC = 2.2;
const DOT_COLOR = '61, 255, 162';
const ARC_COLOR = '61, 255, 162';
const MAX_ARCS = 4;

/** Hub endpoints for signal arcs: [lon, lat] of major cities/chokepoints. */
const HUBS: Array<[number, number]> = [
  [-74, 40.7], // New York
  [-118.2, 34], // Los Angeles
  [-0.1, 51.5], // London
  [2.35, 48.85], // Paris
  [13.4, 52.5], // Berlin
  [37.6, 55.75], // Moscow
  [28.98, 41.01], // Istanbul
  [55.3, 25.27], // Dubai
  [77.2, 28.6], // Delhi
  [103.8, 1.35], // Singapore
  [121.47, 31.23], // Shanghai
  [139.7, 35.68], // Tokyo
  [151.2, -33.87], // Sydney
  [-43.2, -22.9], // Rio
  [-99.13, 19.43], // Mexico City
  [31.23, 30.04], // Cairo
  [3.38, 6.52], // Lagos
  [-77.04, 38.9], // Washington DC
];

interface Arc {
  a: [number, number, number]; // unit vector start
  b: [number, number, number]; // unit vector end
  angle: number; // great-circle angle between a and b
  start: number; // ms timestamp
  duration: number;
}

function toVec(lon: number, lat: number): [number, number, number] {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

/** Spherical linear interpolation between two unit vectors. */
function slerp(
  a: [number, number, number],
  b: [number, number, number],
  angle: number,
  t: number
): [number, number, number] {
  const sinA = Math.sin(angle);
  if (sinA < 1e-6) return a;
  const w1 = Math.sin((1 - t) * angle) / sinA;
  const w2 = Math.sin(t * angle) / sinA;
  return [
    w1 * a[0] + w2 * b[0],
    w1 * a[1] + w2 * b[1],
    w1 * a[2] + w2 * b[2],
  ];
}

class GlobeRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly dotLon: Float32Array;
  private readonly dotCosLat: Float32Array;
  private readonly dotSinLat: Float32Array;
  private sinTilt = Math.sin((TILT_DEG * Math.PI) / 180);
  private cosTilt = Math.cos((TILT_DEG * Math.PI) / 180);
  /** Camera dolly: radius multiplier. 1 = the framed orbital view. */
  private zoom = 1;
  /** Globe centre as a fraction of canvas height. Pushed past 1 to drop the
   *  planet below the frame so only the upper limb reads as a horizon. */
  private centerYFrac = 0.5;
  private arcs: Arc[] = [];
  private raf = 0;
  private lastFrame = 0;
  private rotation = 0;
  private size = 0;
  private running = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d unavailable');
    this.ctx = ctx;

    const n = LAND_DOTS.length / 2;
    this.dotLon = new Float32Array(n);
    this.dotCosLat = new Float32Array(n);
    this.dotSinLat = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const lon = ((LAND_DOTS[i * 2] ?? 0) * Math.PI) / 180;
      const lat = ((LAND_DOTS[i * 2 + 1] ?? 0) * Math.PI) / 180;
      this.dotLon[i] = lon;
      this.dotCosLat[i] = Math.cos(lat);
      this.dotSinLat[i] = Math.sin(lat);
    }

    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const px = Math.round(Math.min(rect.width, rect.height) * dpr);
    if (px > 0 && px !== this.size) {
      this.size = px;
      this.canvas.width = Math.round(rect.width * dpr);
      this.canvas.height = Math.round(rect.height * dpr);
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    const loop = (now: number): void => {
      if (!this.running) return;
      const dt = Math.min(now - this.lastFrame, 100);
      this.lastFrame = now;
      this.rotation += (ROTATE_DEG_PER_SEC * Math.PI / 180) * (dt / 1000);
      this.spawnArcs(now);
      this.draw(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /**
   * Drive the descent from orbit. `t` is scroll progress through the hero,
   * 0 (framed orbital view) to 1 (down at the horizon, planet filling frame).
   *
   * Three things move together, which is what sells it as a camera rather than
   * a CSS scale: the globe grows, its centre drops below the frame so only the
   * upper limb reads as a horizon, and the tilt flattens toward level as if the
   * viewer were losing altitude. Scroll supplies the pacing, so the easing here
   * is gentle — a strong ease would fight the wheel.
   */
  setCamera(t: number): void {
    const p = Math.min(1, Math.max(0, t));
    // easeInOutCubic — soft at both ends so the top of the page is calm and
    // the hand-off to the dashboard settles instead of slamming.
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

    this.zoom = 1 + e * 1.6;
    // Lands at 1.05, not further: the planet needs to stay just below the frame
    // so a sliver of limb still curves behind the dashboard at the bottom of the
    // descent. Pushing it to 1.22 dropped the horizon out of shot entirely and
    // the landing read as empty space rather than as having arrived somewhere.
    this.centerYFrac = 0.5 + e * 0.55;
    const tilt = TILT_DEG * (1 - e * 0.85);
    this.sinTilt = Math.sin((tilt * Math.PI) / 180);
    this.cosTilt = Math.cos((tilt * Math.PI) / 180);

    // Paused (offscreen/hidden) renderers still need the new framing drawn,
    // otherwise scrubbing back up leaves a stale frame behind the content.
    if (!this.running) this.draw(performance.now());
  }

  /** Render one frame without animation (reduced-motion fallback). */
  renderStatic(): void {
    this.rotation = (-20 * Math.PI) / 180;
    this.draw(performance.now());
  }

  private spawnArcs(now: number): void {
    this.arcs = this.arcs.filter((a) => now - a.start < a.duration + 1400);
    while (this.arcs.length < MAX_ARCS) {
      const i = Math.floor(Math.random() * HUBS.length);
      let j = Math.floor(Math.random() * HUBS.length);
      if (j === i) j = (j + 1) % HUBS.length;
      const hubA = HUBS[i] ?? [0, 0];
      const hubB = HUBS[j] ?? [0, 0];
      const a = toVec(hubA[0], hubA[1]);
      const b = toVec(hubB[0], hubB[1]);
      const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      this.arcs.push({
        a,
        b,
        angle: Math.acos(Math.max(-1, Math.min(1, dot))),
        start: now + Math.random() * 900,
        duration: 2400 + Math.random() * 1600,
      });
    }
  }

  /** Project a unit vector; returns [x, y, zFacing] in canvas pixels. */
  private project(
    v: [number, number, number],
    cx: number,
    cy: number,
    r: number,
    altitude = 0
  ): [number, number, number] {
    // Rotate around polar axis, then tilt toward viewer.
    const cosR = Math.cos(this.rotation);
    const sinR = Math.sin(this.rotation);
    const x = v[0] * cosR - v[1] * sinR;
    const y = v[0] * sinR + v[1] * cosR;
    const z = v[2];
    const y2 = y;
    const z2 = z * this.cosTilt - x * this.sinTilt;
    const x2 = z * this.sinTilt + x * this.cosTilt;
    const scale = r * (1 + altitude);
    return [cx + y2 * scale, cy - z2 * scale, x2];
  }

  private draw(now: number): void {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h * this.centerYFrac;
    const r = Math.min(w, h) * 0.36 * this.zoom;

    ctx.clearRect(0, 0, w, h);

    // Atmosphere + limb
    const glow = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r * 1.45);
    glow.addColorStop(0, `rgba(${DOT_COLOR}, 0.05)`);
    glow.addColorStop(0.62, `rgba(${DOT_COLOR}, 0.028)`);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${DOT_COLOR}, 0.14)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Land dots
    const dotR = Math.max(this.size * 0.0022, 1);
    const cosR = Math.cos(this.rotation);
    const sinR = Math.sin(this.rotation);
    for (let i = 0; i < this.dotLon.length; i++) {
      const lon = this.dotLon[i] as number;
      const cosLat = this.dotCosLat[i] as number;
      const sinLat = this.dotSinLat[i] as number;
      // Inline projection of (cosLat cosLon, cosLat sinLon, sinLat)
      const vx = cosLat * Math.cos(lon);
      const vy = cosLat * Math.sin(lon);
      const x = vx * cosR - vy * sinR;
      const y = vx * sinR + vy * cosR;
      const facing = sinLat * this.sinTilt + x * this.cosTilt;
      if (facing <= 0.02) continue;
      const sx = cx + y * r;
      const sy = cy - (sinLat * this.cosTilt - x * this.sinTilt) * r;
      const alpha = 0.12 + facing * 0.5;
      ctx.fillStyle = `rgba(${DOT_COLOR}, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Signal arcs
    for (const arc of this.arcs) {
      const t = (now - arc.start) / arc.duration;
      if (t <= 0) continue;
      const head = Math.min(t, 1);
      const tail = Math.max(0, t - 0.35);
      if (tail >= 1) {
        this.drawPulse(arc.b, cx, cy, r, (now - (arc.start + arc.duration)) / 1400);
        continue;
      }
      ctx.beginPath();
      let started = false;
      const steps = 44;
      for (let s = 0; s <= steps; s++) {
        const p = tail + ((head - tail) * s) / steps;
        const v = slerp(arc.a, arc.b, arc.angle, p);
        const altitude = Math.sin(p * Math.PI) * 0.18;
        const [x, y, facing] = this.project(v, cx, cy, r, altitude);
        if (facing < -0.12) {
          started = false;
          continue;
        }
        if (started) ctx.lineTo(x, y);
        else {
          ctx.moveTo(x, y);
          started = true;
        }
      }
      ctx.strokeStyle = `rgba(${ARC_COLOR}, ${(0.6 * (1 - tail)).toFixed(3)})`;
      ctx.lineWidth = Math.max(this.size * 0.0016, 1);
      ctx.stroke();

      // Arc head dot
      const headVec = slerp(arc.a, arc.b, arc.angle, head);
      const [hx, hy, hFacing] = this.project(headVec, cx, cy, r, Math.sin(head * Math.PI) * 0.18);
      if (hFacing > -0.12) {
        ctx.fillStyle = `rgba(${ARC_COLOR}, 0.95)`;
        ctx.beginPath();
        ctx.arc(hx, hy, Math.max(this.size * 0.0022, 1.4), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawPulse(
    v: [number, number, number],
    cx: number,
    cy: number,
    r: number,
    t: number
  ): void {
    if (t < 0 || t > 1) return;
    const [x, y, facing] = this.project(v, cx, cy, r);
    if (facing <= 0.02) return;
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(x, y, (2 + t * 14) * Math.max(this.size / 900, 0.7), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${ARC_COLOR}, ${(0.5 * (1 - t)).toFixed(3)})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

/** Handle returned to the page so scroll can drive the camera. */
export interface GlobeHandle {
  setCamera(t: number): void;
}

export function startGlobe(canvas: HTMLCanvasElement): GlobeHandle {
  const globe = new GlobeRenderer(canvas);

  const onResize = (): void => globe.resize();
  window.addEventListener('resize', onResize, { passive: true });

  // Pause when the tab is hidden or the hero scrolls out of view.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) globe.stop();
    else globe.start();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) globe.start();
        else globe.stop();
      }
    }).observe(canvas);
  } else {
    globe.start();
  }

  return { setCamera: (t) => globe.setCamera(t) };
}

export function drawStaticGlobe(canvas: HTMLCanvasElement): void {
  const globe = new GlobeRenderer(canvas);
  globe.renderStatic();
  window.addEventListener(
    'resize',
    () => {
      globe.resize();
      globe.renderStatic();
    },
    { passive: true }
  );
}
