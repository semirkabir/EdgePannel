/**
 * Deep-space backdrop behind the MapLibre globe.
 *
 * MapLibre blends its sky quad out entirely once the globe transition completes
 * (`u_sky_blend` = `projectionTransition` = 1), and the atmosphere pass is
 * alpha-blended, so the "space" around the planet is genuinely transparent —
 * whatever sits behind the map canvas IS the void. That used to be a single
 * static `night-sky.png`: a uniform, dead field of identical white dots.
 *
 * This canvas replaces it with four cheap 2D passes, drawn back to front:
 *
 *   1. nebula      — slow-drifting navy/teal gradient blobs, so the void has
 *                    colour and depth instead of flat black
 *   2. grid plane  — a perspective dot grid receding to a horizon beneath the
 *                    globe, reading as a holographic projection surface
 *   3. starfield   — three depth layers that shift by different amounts with the
 *                    pointer (parallax), with clustered placement, mixed sizes
 *                    and a few blue/amber stars so it never reads as a tiling
 *   4. atmosphere  — a blue-cyan Fresnel-style rim glow sized to the globe's
 *                    screen silhouette. Because this canvas is BEHIND the map,
 *                    the planet masks the inner half of the gradient and only
 *                    the halo spills past the limb — exactly the wanted shape,
 *                    and it means the inner radius never has to be pixel-exact.
 *
 * Everything is in CSS-pixel space and `pointer-events: none`; the map itself is
 * untouched. The host supplies the globe's screen silhouette per frame (see
 * `GlobeFraming`) because only the map knows the live camera.
 */

/** Globe silhouette in CSS pixels, relative to the backdrop canvas. */
export interface GlobeSilhouette {
  cx: number;
  cy: number;
  radius: number;
  /**
   * How much to trust this circle, 0..1. Tilting the camera walks the sphere's
   * centre off the screen centre, so the host ramps this down as pitch grows
   * rather than cutting out — the halo and grid plane dissolve instead of
   * popping when the camera auto-flattens back to world view.
   */
  opacity: number;
}

export interface GlobeFraming {
  /**
   * The globe's screen circle, or `null` when it can't be measured at all. The
   * halo and grid plane are suppressed in that case; the starfield still draws.
   */
  silhouette: GlobeSilhouette | null;
}

export interface GlobeBackdropOptions {
  /**
   * Framing probe, called once per drawn frame. Return `null` to skip the whole
   * backdrop (flat map, or zoomed in far enough that space is no longer visible).
   */
  getFraming: () => GlobeFraming | null;
}

/** Star tints: mostly white, a little blue-white, a few faint blue/amber. */
const STAR_TINTS = ['255,255,255', '214,230,255', '150,190,255', '255,212,160'];
const TINT_WEIGHTS = [0.62, 0.24, 0.08, 0.06];

/** Parallax shift, in CSS px, applied to the nearest star layer at full deflection. */
const MAX_PARALLAX_PX = 26;

/** Depth of each star layer: parallax multiplier, size range, alpha range. */
const STAR_LAYERS = [
  { depth: 0.16, minR: 0.45, maxR: 0.95, minA: 0.20, maxA: 0.50, per1Mpx: 340, twinkle: false },
  { depth: 0.45, minR: 0.75, maxR: 1.45, minA: 0.32, maxA: 0.72, per1Mpx: 120, twinkle: false },
  { depth: 1.00, minR: 1.15, maxR: 2.30, minA: 0.45, maxA: 1.00, per1Mpx: 34, twinkle: true },
] as const;

/** Generate a comfortable surplus once, then use a viewport-sized prefix. */
const LAYOUT_MPX = 4;

interface Star {
  /** Normalised position, 0..1 across the canvas. */
  nx: number;
  ny: number;
  /** Radius in CSS px. */
  r: number;
  /** Base alpha. */
  a: number;
  /** Index into STAR_TINTS. */
  tint: number;
  /** Twinkle phase (rad) and rate (rad/s); rate 0 holds a constant alpha. */
  phase: number;
  rate: number;
  /**
   * Stable 0..1 draw rank. The layers are generated once for a generous canvas
   * and thinned per viewport by keeping `rank <= ratio` — a prefix of the array
   * can't be used for that, because the array is sorted by fill style and a
   * prefix would come out all one colour.
   */
  rank: number;
  /** Cached `rgba(...)` for the non-twinkling layers. */
  style: string;
}

interface Nebula {
  nx: number;
  ny: number;
  /** Radius as a fraction of the canvas's larger dimension. */
  nr: number;
  rgb: string;
  alpha: number;
  /** Drift amplitude (fraction of canvas) and angular rate (rad/s). */
  ax: number;
  ay: number;
  rate: number;
  phase: number;
}

/** Deep navy through dark teal, with one faint violet for variation. */
const NEBULAE: Nebula[] = [
  { nx: 0.26, ny: 0.30, nr: 0.62, rgb: '28,56,124', alpha: 0.20, ax: 0.020, ay: 0.012, rate: 0.031, phase: 0.0 },
  { nx: 0.74, ny: 0.62, nr: 0.55, rgb: '14,78,88', alpha: 0.17, ax: 0.016, ay: 0.018, rate: 0.024, phase: 1.9 },
  { nx: 0.58, ny: 0.14, nr: 0.40, rgb: '54,38,108', alpha: 0.11, ax: 0.012, ay: 0.010, rate: 0.040, phase: 3.4 },
  { nx: 0.12, ny: 0.84, nr: 0.46, rgb: '16,64,96', alpha: 0.13, ax: 0.014, ay: 0.011, rate: 0.028, phase: 5.1 },
];

/** Mulberry32 — a stable seeded PRNG, so the field is identical every session. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickTint(rand: number): number {
  let acc = 0;
  for (let i = 0; i < TINT_WEIGHTS.length; i++) {
    acc += TINT_WEIGHTS[i] as number;
    if (rand < acc) return i;
  }
  return 0;
}

/**
 * Build one depth layer. Roughly a third of the stars are pulled towards a
 * handful of cluster centres: an evenly-random field still reads as machine-made
 * (that "too uniform" look), whereas real sky is patchy.
 */
function buildLayer(spec: (typeof STAR_LAYERS)[number], seed: number): Star[] {
  const rng = makeRng(seed);
  const count = Math.round(spec.per1Mpx * LAYOUT_MPX);
  const clusterCount = Math.max(3, Math.round(count / 60));
  const clusters: Array<[number, number]> = [];
  for (let i = 0; i < clusterCount; i++) clusters.push([rng(), rng()]);

  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    let nx: number;
    let ny: number;
    if (rng() < 0.45 && clusters.length > 0) {
      const c = clusters[Math.floor(rng() * clusters.length)] as [number, number];
      // Two uniforms summed approximate a bell curve — enough for visual scatter.
      const spread = 0.075;
      nx = c[0] + (rng() + rng() - 1) * spread;
      ny = c[1] + (rng() + rng() - 1) * spread;
      if (nx < 0 || nx > 1 || ny < 0 || ny > 1) { nx = rng(); ny = rng(); }
    } else {
      nx = rng();
      ny = rng();
    }

    // Bias sizes small: a few bright anchors read better than many fat dots.
    const sizeT = Math.pow(rng(), 2.2);
    const tint = pickTint(rng());
    const r = spec.minR + (spec.maxR - spec.minR) * sizeT;
    const a = spec.minA + (spec.maxA - spec.minA) * (0.35 + 0.65 * sizeT);
    stars.push({
      nx,
      ny,
      r,
      a,
      tint,
      phase: rng() * Math.PI * 2,
      rate: spec.twinkle ? 0.5 + rng() * 1.4 : 0,
      rank: rng(),
      style: `rgba(${STAR_TINTS[tint]},${a.toFixed(3)})`,
    });
  }

  // Non-twinkling layers keep a constant fillStyle per star, so grouping by
  // style collapses hundreds of context writes into a handful per frame.
  if (!spec.twinkle) stars.sort((p, q) => (p.style < q.style ? -1 : p.style > q.style ? 1 : 0));
  return stars;
}

export class GlobeBackdrop {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly layers: Star[][];
  private readonly getFraming: () => GlobeFraming | null;

  private width = 0;
  private height = 0;
  private dpr = 1;
  private active = false;
  private raf = 0;
  private lastDrawMs = 0;
  private startMs = 0;

  /** Pointer deflection, -1..1, and the eased value actually drawn. */
  private targetX = 0;
  private targetY = 0;
  private parallaxX = 0;
  private parallaxY = 0;

  private reducedMotion = false;
  /** Last framing drawn, so the reduced-motion path can skip idle repaints. */
  private lastFrameKey = '';

  private readonly onPointerMove: (e: PointerEvent) => void;
  private readonly onMotionPrefChange: () => void;
  private readonly motionQuery: MediaQueryList | null;
  private readonly resizeObserver: ResizeObserver | null;

  constructor(container: HTMLElement, options: GlobeBackdropOptions) {
    this.getFraming = options.getFraming;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'globe-backdrop';
    this.canvas.setAttribute('aria-hidden', 'true');
    // First child, so the map wrapper (also positioned) paints over it.
    container.insertBefore(this.canvas, container.firstChild);

    this.ctx = this.canvas.getContext('2d', { alpha: true });
    this.layers = STAR_LAYERS.map((spec, i) => buildLayer(spec, 0x51ab1e + i * 7919));

    this.motionQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    this.reducedMotion = this.motionQuery?.matches ?? false;
    this.onMotionPrefChange = () => {
      this.reducedMotion = this.motionQuery?.matches ?? false;
      this.lastFrameKey = '';
    };
    this.motionQuery?.addEventListener('change', this.onMotionPrefChange);

    this.onPointerMove = (e: PointerEvent) => {
      if (!this.active || this.reducedMotion) return;
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      this.targetX = (e.clientX / w) * 2 - 1;
      this.targetY = (e.clientY / h) * 2 - 1;
    };
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });

    this.resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => this.resize())
      : null;
    this.resizeObserver?.observe(container);

    this.resize();
  }

  /** Show/hide the backdrop and start/stop its render loop. */
  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.canvas.style.display = active ? 'block' : 'none';
    if (active) {
      this.lastFrameKey = '';
      this.startMs = performance.now();
      this.resize();
      this.loop(this.startMs);
    } else {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const w = Math.round(rect?.width ?? 0);
    const h = Math.round(rect?.height ?? 0);
    if (w <= 0 || h <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === this.width && h === this.height && dpr === this.dpr) return;
    this.width = w;
    this.height = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.lastFrameKey = '';
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.active = false;
    window.removeEventListener('pointermove', this.onPointerMove);
    this.motionQuery?.removeEventListener('change', this.onMotionPrefChange);
    this.resizeObserver?.disconnect();
    this.canvas.remove();
  }

  private loop = (now: number): void => {
    if (!this.active) return;
    this.raf = requestAnimationFrame(this.loop);
    // 30fps is indistinguishable for a starfield and leaves the frame budget to
    // the WebGL globe compositing on top of it.
    if (now - this.lastDrawMs < 32) return;
    this.lastDrawMs = now;
    this.draw(now);
  };

  private draw(now: number): void {
    const ctx = this.ctx;
    if (!ctx || this.width <= 0 || this.height <= 0) return;

    const framing = this.getFraming();
    const w = this.width;
    const h = this.height;

    if (!framing) {
      if (this.lastFrameKey !== 'off') {
        this.lastFrameKey = 'off';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
      return;
    }

    if (this.reducedMotion) {
      this.parallaxX = 0;
      this.parallaxY = 0;
      const sil = framing.silhouette;
      const key = sil
        ? `${Math.round(sil.cx)}:${Math.round(sil.cy)}:${Math.round(sil.radius)}:${sil.opacity.toFixed(2)}`
        : 'flat';
      if (key === this.lastFrameKey) return;
      this.lastFrameKey = key;
    } else {
      this.lastFrameKey = '';
      this.parallaxX += (this.targetX - this.parallaxX) * 0.06;
      this.parallaxY += (this.targetY - this.parallaxY) * 0.06;
    }

    const t = (now - this.startMs) / 1000;
    const sil = framing.silhouette;
    // Once the planet covers the viewport there is no visible void left to
    // decorate — fade out rather than drawing a starfield behind an opaque map.
    const coverage = sil ? sil.radius / (0.5 * Math.hypot(w, h)) : 0;
    const fade = sil ? Math.min(1, Math.max(0, (1.06 - coverage) / 0.22)) : 1;
    if (fade <= 0.001) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = fade;

    this.drawNebulae(ctx, w, h, t);
    if (sil && sil.opacity > 0.01) {
      ctx.globalAlpha = fade * sil.opacity;
      this.drawGridPlane(ctx, w, h, sil);
      ctx.globalAlpha = fade;
    }
    this.drawStars(ctx, w, h, t);
    if (sil && sil.opacity > 0.01) {
      ctx.globalAlpha = fade * sil.opacity;
      this.drawAtmosphere(ctx, w, h, sil);
    }

    ctx.globalAlpha = 1;
  }

  /** Faint colour behind the void, so the black is never flat. */
  private drawNebulae(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    const span = Math.max(w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (const n of NEBULAE) {
      // The deepest parallax band: the clouds sit "furthest away" of anything here.
      const px = this.parallaxX * MAX_PARALLAX_PX * 0.08;
      const py = this.parallaxY * MAX_PARALLAX_PX * 0.08;
      const cx = (n.nx + Math.sin(t * n.rate + n.phase) * n.ax) * w + px;
      const cy = (n.ny + Math.cos(t * n.rate * 0.83 + n.phase) * n.ay) * h + py;
      const r = n.nr * span;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(${n.rgb},${n.alpha.toFixed(3)})`);
      g.addColorStop(0.45, `rgba(${n.rgb},${(n.alpha * 0.42).toFixed(3)})`);
      g.addColorStop(1, `rgba(${n.rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * A dot grid on the "floor" the globe hangs above. Rows are spaced by a
   * true perspective divide (`u = u0 / (1 + m·step)`) rather than a linear
   * squeeze, so the convergence towards the horizon looks right, and both the
   * row spacing and the column fan derive from the same `u` — one parameter
   * drives the whole plane.
   */
  private drawGridPlane(ctx: CanvasRenderingContext2D, w: number, h: number, sil: GlobeSilhouette): void {
    // Horizon just below the globe's centre: the grid then emerges from behind
    // the planet on both sides instead of starting below it, disconnected.
    const horizonY = sil.cy + sil.radius * 0.10;
    const u0 = h - horizonY;
    if (u0 <= 24) return;

    const step = 0.16;
    const rows = 34;
    // Column pitch as a fraction of the camera height; sets how wide the fan opens.
    const spread = 0.145;
    const halfCols = Math.ceil(w / (u0 * spread)) + 1;
    const rgb = '86,196,220';

    for (let m = 0; m < rows; m++) {
      const u = u0 / (1 + m * step);
      const y = horizonY + u;
      if (y > h + 4) continue;
      const depth = u / u0;
      // Fade with distance, and hold the nearest row back a little so the bottom
      // edge of the screen doesn't turn into a bright band.
      const rowAlpha = 0.46 * Math.pow(depth, 0.5) * (1 - Math.pow(1 - depth, 8));
      if (rowAlpha < 0.004) continue;
      const dotR = Math.max(0.55, 1.6 * depth);
      const pitch = u * spread;
      for (let n = -halfCols; n <= halfCols; n++) {
        const x = sil.cx + n * pitch;
        if (x < -4 || x > w + 4) continue;
        // Fade towards the sides so the plane dissolves instead of ending.
        const lateral = 1 - Math.min(1, Math.abs(x - sil.cx) / (w * 0.95));
        const a = rowAlpha * (0.18 + 0.82 * lateral);
        if (a < 0.004) continue;
        ctx.fillStyle = `rgba(${rgb},${a.toFixed(3)})`;
        ctx.fillRect(x - dotR, y - dotR, dotR * 2, dotR * 2);
      }
    }
  }

  private drawStars(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    // Keep the on-screen density constant as the panel resizes.
    const ratio = Math.min(1, Math.max(0.05, (w * h) / 1e6 / LAYOUT_MPX));
    for (let i = 0; i < this.layers.length; i++) {
      const spec = STAR_LAYERS[i] as (typeof STAR_LAYERS)[number];
      const stars = this.layers[i] as Star[];
      const shift = MAX_PARALLAX_PX * spec.depth;
      const ox = -this.parallaxX * shift;
      const oy = -this.parallaxY * shift;

      if (!spec.twinkle) {
        // Pre-sorted by style, so fillStyle is written a handful of times.
        let style = '';
        for (const star of stars) {
          if (star.rank > ratio) continue;
          if (star.style !== style) {
            style = star.style;
            ctx.fillStyle = style;
          }
          const x = star.nx * w + ox;
          const y = star.ny * h + oy;
          ctx.fillRect(x - star.r, y - star.r, star.r * 2, star.r * 2);
        }
        continue;
      }

      for (const star of stars) {
        if (star.rank > ratio) continue;
        const twinkle = 0.72 + 0.28 * Math.sin(t * star.rate + star.phase);
        const a = star.a * twinkle;
        const x = star.nx * w + ox;
        const y = star.ny * h + oy;
        ctx.fillStyle = `rgba(${STAR_TINTS[star.tint]},${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, star.r, 0, Math.PI * 2);
        ctx.fill();
        // Only the genuinely bright ones get a halo — that contrast is what
        // makes this layer read as nearer than the flat far-field dots, and it
        // keeps the per-frame gradient count down to a dozen or so.
        if (star.r > 1.5) {
          const glowR = star.r * 3.6;
          const glow = ctx.createRadialGradient(x, y, star.r * 0.5, x, y, glowR);
          glow.addColorStop(0, `rgba(${STAR_TINTS[star.tint]},${(a * 0.28).toFixed(3)})`);
          glow.addColorStop(1, `rgba(${STAR_TINTS[star.tint]},0)`);
          ctx.fillStyle = glow;
          ctx.fillRect(x - glowR, y - glowR, glowR * 2, glowR * 2);
        }
      }
    }
  }

  /**
   * Fresnel-style limb glow. Drawn behind the map, so the globe masks everything
   * inside its silhouette and only the rim survives — the inner stop sits just
   * *inside* the radius on purpose, hiding the gradient's own seam under the planet.
   */
  private drawAtmosphere(ctx: CanvasRenderingContext2D, w: number, h: number, sil: GlobeSilhouette): void {
    const { cx, cy, radius } = sil;
    if (!(radius > 4)) return;

    /** Fill only the part of the gradient's bounding box that is on-screen. */
    const fillDisc = (r: number): void => {
      const x0 = Math.max(0, cx - r);
      const y0 = Math.max(0, cy - r);
      const x1 = Math.min(w, cx + r);
      const y1 = Math.min(h, cy + r);
      if (x1 > x0 && y1 > y0) ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    };

    ctx.globalCompositeOperation = 'lighter';

    const outer = radius * 1.8;
    const bloom = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, outer);
    bloom.addColorStop(0, 'rgba(58,142,224,0.085)');
    bloom.addColorStop(0.45, 'rgba(46,110,190,0.038)');
    bloom.addColorStop(1, 'rgba(30,74,150,0)');
    ctx.fillStyle = bloom;
    fillDisc(outer);

    const rim = radius * 1.24;
    const halo = ctx.createRadialGradient(cx, cy, radius * 0.965, cx, cy, rim);
    halo.addColorStop(0, 'rgba(104,204,255,0.38)');
    halo.addColorStop(0.16, 'rgba(72,172,246,0.21)');
    halo.addColorStop(0.52, 'rgba(46,120,200,0.065)');
    halo.addColorStop(1, 'rgba(30,80,160,0)');
    ctx.fillStyle = halo;
    fillDisc(rim);

    ctx.globalCompositeOperation = 'source-over';
  }
}
