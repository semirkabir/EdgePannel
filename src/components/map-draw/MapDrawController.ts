/**
 * MapDrawController — native map annotation & measurement toolkit.
 *
 * Renders all drawings through a single MapLibre GeoJSON source (fill / line /
 * vertex / label layers), so it composes with the interleaved deck.gl overlay
 * without a third-party draw dependency. Tools: Distance (polyline), Circle,
 * Range Rings, Sector, Polygon, Rectangle, Bearing.
 *
 * Drawings persist to localStorage and can be toggled, renamed, and deleted.
 * `getDrawnZones()` exposes the enclosed-area shapes for future consumers
 * (e.g. alert geofencing).
 */
import type maplibregl from 'maplibre-gl';
import { haversineKm, bearingDeg, destinationPoint, formatDistance, type DistanceUnit } from '@/utils/geo';

export type DrawTool =
  | 'distance'
  | 'circle'
  | 'rangeRings'
  | 'sector'
  | 'polygon'
  | 'rectangle'
  | 'bearing';

type LngLat = [number, number];

export interface Drawing {
  id: string;
  tool: DrawTool;
  name: string;
  color: string;
  points: LngLat[];
  radiusKm?: number;
  rings?: number;
  visible: boolean;
  createdAt: number;
}

const SRC = 'wm-draw-src';
const L_FILL = 'wm-draw-fill';
const L_LINE = 'wm-draw-line';
const L_VERTEX = 'wm-draw-vertex';
const L_LABEL = 'wm-draw-label';
const STORAGE_KEY = 'wm-map-drawings-v1';

const PALETTE = ['#22d3ee', '#f472b6', '#a3e635', '#fbbf24', '#c084fc', '#fb7185', '#38bdf8', '#34d399'];

const TOOL_LABEL: Record<DrawTool, string> = {
  distance: 'Distance',
  circle: 'Circle',
  rangeRings: 'Range Rings',
  sector: 'Sector',
  polygon: 'Polygon',
  rectangle: 'Rectangle',
  bearing: 'Bearing',
};

/** Tools whose committed shape encloses an area (usable as a geofence). */
const AREA_TOOLS: ReadonlySet<DrawTool> = new Set<DrawTool>(['circle', 'rangeRings', 'sector', 'polygon', 'rectangle']);

const SECTOR_HALF_ANGLE = 30; // ±30° → 60° wedge
const RING_COUNT = 3;
const ARC_STEPS = 72;

type Feature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;

export class MapDrawController {
  private map: maplibregl.Map;
  private container: HTMLElement | null = null;
  private toolbar: HTMLElement | null = null;
  private readout: HTMLElement | null = null;
  private listEl: HTMLElement | null = null;

  private drawings: Drawing[] = [];
  private active: DrawTool | null = null;
  private draft: LngLat[] = [];
  private hover: LngLat | null = null;
  private unit: DistanceUnit = 'km';
  private colorIdx = 0;
  private layersReady = false;

  private readonly onClick = (e: maplibregl.MapMouseEvent) => this.handleClick(e);
  private readonly onMove = (e: maplibregl.MapMouseEvent) => this.handleMove(e);
  private readonly onDblClick = (e: maplibregl.MapMouseEvent) => this.handleDblClick(e);
  private readonly onKey = (e: KeyboardEvent) => this.handleKey(e);

  constructor(map: maplibregl.Map) {
    this.map = map;
    this.drawings = this.load();
  }

  // ── lifecycle ──────────────────────────────────────────────────────────────

  mount(container: HTMLElement): void {
    this.container = container;
    this.ensureLayers();
    this.buildToolbar();
    this.render();
    document.addEventListener('keydown', this.onKey);
  }

  destroy(): void {
    this.deactivate();
    document.removeEventListener('keydown', this.onKey);
    this.toolbar?.remove();
    this.readout?.remove();
    const m = this.map;
    for (const id of [L_LABEL, L_VERTEX, L_LINE, L_FILL]) {
      if (m.getLayer(id)) m.removeLayer(id);
    }
    if (m.getSource(SRC)) m.removeSource(SRC);
    this.layersReady = false;
  }

  isOpen(): boolean {
    return !!this.toolbar && !this.toolbar.hidden;
  }

  toggleToolbar(): void {
    if (!this.toolbar) return;
    this.toolbar.hidden = !this.toolbar.hidden;
    if (this.toolbar.hidden) this.deactivate();
  }

  /** Enclosed-area drawings as GeoJSON polygons — for geofencing consumers. */
  getDrawnZones(): Array<{ id: string; name: string; geometry: GeoJSON.Polygon }> {
    const zones: Array<{ id: string; name: string; geometry: GeoJSON.Polygon }> = [];
    for (const d of this.drawings) {
      if (!AREA_TOOLS.has(d.tool)) continue;
      const rings = this.polygonRings(d);
      const outer = rings[rings.length - 1];
      if (outer) zones.push({ id: d.id, name: d.name, geometry: { type: 'Polygon', coordinates: [outer] } });
    }
    return zones;
  }

  // ── map layers ───────────────────────────────────────────────────────────────

  private ensureLayers(): void {
    if (this.layersReady) return;
    const m = this.map;
    if (!m.getSource(SRC)) {
      m.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }
    if (!m.getLayer(L_FILL)) {
      m.addLayer({
        id: L_FILL, type: 'fill', source: SRC,
        filter: ['==', ['get', 'role'], 'fill'],
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.1 },
      } as maplibregl.LayerSpecification);
    }
    if (!m.getLayer(L_LINE)) {
      m.addLayer({
        id: L_LINE, type: 'line', source: SRC,
        filter: ['==', ['get', 'role'], 'line'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['get', 'draft'], 1.5, 2],
          'line-opacity': ['case', ['get', 'draft'], 0.7, 0.95],
          'line-dasharray': ['case', ['get', 'draft'], ['literal', [2, 2]], ['literal', [1, 0]]],
        },
      } as maplibregl.LayerSpecification);
    }
    if (!m.getLayer(L_VERTEX)) {
      m.addLayer({
        id: L_VERTEX, type: 'circle', source: SRC,
        filter: ['==', ['get', 'role'], 'vertex'],
        paint: {
          'circle-radius': 4,
          'circle-color': '#ffffff',
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': 2,
        },
      } as maplibregl.LayerSpecification);
    }
    if (!m.getLayer(L_LABEL)) {
      m.addLayer({
        id: L_LABEL, type: 'symbol', source: SRC,
        filter: ['==', ['get', 'role'], 'label'],
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-font': ['Noto Sans Regular', 'Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-offset': [0, -0.8],
          'text-anchor': 'bottom',
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': 'rgba(0,0,0,0.85)',
          'text-halo-width': 1.4,
        },
      } as maplibregl.LayerSpecification);
    }
    this.layersReady = true;
  }

  // ── geometry ─────────────────────────────────────────────────────────────────

  private circleRing(center: LngLat, radiusKm: number): LngLat[] {
    const [lng, lat] = center;
    const ring: LngLat[] = [];
    for (let i = 0; i <= ARC_STEPS; i++) {
      ring.push(destinationPoint(lat, lng, (i / ARC_STEPS) * 360, radiusKm));
    }
    return ring;
  }

  private sectorRing(center: LngLat, radiusKm: number, bearing: number): LngLat[] {
    const [lng, lat] = center;
    const ring: LngLat[] = [center];
    const start = bearing - SECTOR_HALF_ANGLE;
    for (let i = 0; i <= ARC_STEPS; i++) {
      ring.push(destinationPoint(lat, lng, start + (i / ARC_STEPS) * (SECTOR_HALF_ANGLE * 2), radiusKm));
    }
    ring.push(center);
    return ring;
  }

  private rectRing(a: LngLat, b: LngLat): LngLat[] {
    const [x1, y1] = a; const [x2, y2] = b;
    return [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]];
  }

  /** Closed rings that define a drawing's enclosed area(s). */
  private polygonRings(d: Drawing): LngLat[][] {
    const p = d.points;
    const c = p[0];
    const e = p[1];
    switch (d.tool) {
      case 'circle':
        return c && d.radiusKm ? [this.circleRing(c, d.radiusKm)] : [];
      case 'rangeRings': {
        if (!c || !d.radiusKm) return [];
        const r = d.radiusKm;
        const n = d.rings ?? RING_COUNT;
        return Array.from({ length: n }, (_, i) => this.circleRing(c, (r * (i + 1)) / n));
      }
      case 'sector':
        return c && e && d.radiusKm
          ? [this.sectorRing(c, d.radiusKm, bearingDeg(c[1], c[0], e[1], e[0]))]
          : [];
      case 'rectangle':
        return c && e ? [this.rectRing(c, e)] : [];
      case 'polygon':
        return p.length >= 3 && c ? [[...p, c]] : [];
      default:
        return [];
    }
  }

  // ── feature building ───────────────────────────────────────────────────────

  private featuresFor(d: Drawing, draft = false): Feature[] {
    const out: Feature[] = [];
    const props = (extra: Record<string, unknown>) => ({ color: d.color, draft, ...extra });
    const line = (coords: LngLat[], extra: Record<string, unknown> = {}) =>
      out.push({ type: 'Feature', properties: props({ role: 'line', ...extra }), geometry: { type: 'LineString', coordinates: coords } });
    const fill = (ring: LngLat[]) =>
      out.push({ type: 'Feature', properties: props({ role: 'fill' }), geometry: { type: 'Polygon', coordinates: [ring] } });
    const label = (at: LngLat, text: string) =>
      out.push({ type: 'Feature', properties: props({ role: 'label', label: text }), geometry: { type: 'Point', coordinates: at } });
    const vertex = (at: LngLat) =>
      out.push({ type: 'Feature', properties: props({ role: 'vertex' }), geometry: { type: 'Point', coordinates: at } });

    const p = d.points;

    if (d.tool === 'distance') {
      if (p.length >= 2) {
        line(p);
        let total = 0;
        for (let i = 1; i < p.length; i++) {
          const p0 = p[i - 1]; const p1 = p[i];
          if (p0 && p1) total += haversineKm(p0[1], p0[0], p1[1], p1[0]);
        }
        const last = p[p.length - 1];
        if (last) label(last, formatDistance(total, this.unit));
      } else if (p.length === 1) {
        line(p);
      }
      p.forEach(vertex);
      return out;
    }

    if (d.tool === 'bearing') {
      const a = p[0]; const b = p[1];
      if (a && b) {
        line([a, b]);
        const brg = bearingDeg(a[1], a[0], b[1], b[0]);
        const dist = haversineKm(a[1], a[0], b[1], b[0]);
        label(b, `${brg.toFixed(0)}° · ${formatDistance(dist, this.unit)}`);
      } else if (a) {
        line([a]);
      }
      p.forEach(vertex);
      return out;
    }

    // area tools
    const rings = this.polygonRings(d);
    for (const ring of rings) { fill(ring); line(ring); }
    const c = p[0];
    const e = p[1];
    if (c) vertex(c);

    if (d.tool === 'circle' && c && d.radiusKm) {
      label(destinationPoint(c[1], c[0], 0, d.radiusKm), formatDistance(d.radiusKm, this.unit));
    } else if (d.tool === 'rangeRings' && c && d.radiusKm) {
      const n = d.rings ?? RING_COUNT;
      for (let i = 0; i < n; i++) {
        const r = (d.radiusKm * (i + 1)) / n;
        label(destinationPoint(c[1], c[0], 0, r), formatDistance(r, this.unit));
      }
    } else if (d.tool === 'sector' && c && e && d.radiusKm) {
      const brg = bearingDeg(c[1], c[0], e[1], e[0]);
      label(destinationPoint(c[1], c[0], brg, d.radiusKm), `${formatDistance(d.radiusKm, this.unit)} · ${brg.toFixed(0)}°`);
    } else if (d.tool === 'rectangle' && c && e) {
      const wKm = haversineKm(c[1], c[0], c[1], e[0]);
      const hKm = haversineKm(c[1], c[0], e[1], c[0]);
      label([(c[0] + e[0]) / 2, Math.max(c[1], e[1])], `${formatDistance(wKm, this.unit)} × ${formatDistance(hKm, this.unit)}`);
    }
    return out;
  }

  private render(): void {
    if (!this.layersReady) return;
    const features: Feature[] = [];
    for (const d of this.drawings) {
      if (d.visible) features.push(...this.featuresFor(d));
    }
    const draft = this.draftDrawing();
    if (draft) features.push(...this.featuresFor(draft, true));

    const src = this.map.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: 'FeatureCollection', features });
  }

  /** Synthesize a Drawing from the in-progress draft + hover point for live preview. */
  private draftDrawing(): Drawing | null {
    if (!this.active || this.draft.length === 0) return null;
    const pts = this.hover ? [...this.draft, this.hover] : [...this.draft];
    const base: Drawing = {
      id: 'draft', tool: this.active, name: 'draft', color: this.currentColor(),
      points: pts, visible: true, createdAt: 0,
    };
    if (this.active === 'circle' || this.active === 'rangeRings' || this.active === 'sector') {
      const a = pts[0]; const b = pts[1];
      if (!a || !b) return { ...base, points: a ? [a] : [] };
      base.radiusKm = haversineKm(a[1], a[0], b[1], b[0]);
      base.points = this.active === 'sector' ? [a, b] : [a];
      if (this.active === 'rangeRings') base.rings = RING_COUNT;
    }
    return base;
  }

  // ── interaction ──────────────────────────────────────────────────────────────

  private activate(tool: DrawTool): void {
    if (this.active === tool) { this.deactivate(); return; }
    this.deactivate();
    this.active = tool;
    this.draft = [];
    this.map.getCanvas().style.cursor = 'crosshair';
    this.map.on('click', this.onClick);
    this.map.on('mousemove', this.onMove);
    this.map.on('dblclick', this.onDblClick);
    this.map.doubleClickZoom.disable();
    this.syncToolButtons();
    this.showReadout('Click on the map to start');
  }

  private deactivate(): void {
    if (!this.active) { this.syncToolButtons(); return; }
    this.map.off('click', this.onClick);
    this.map.off('mousemove', this.onMove);
    this.map.off('dblclick', this.onDblClick);
    this.map.doubleClickZoom.enable();
    this.map.getCanvas().style.cursor = '';
    this.active = null;
    this.draft = [];
    this.hover = null;
    this.hideReadout();
    this.syncToolButtons();
    this.render();
  }

  private handleClick(e: maplibregl.MapMouseEvent): void {
    if (!this.active) return;
    const pt: LngLat = [e.lngLat.lng, e.lngLat.lat];
    this.draft.push(pt);
    const t = this.active;
    const twoPoint = t === 'circle' || t === 'rangeRings' || t === 'sector' || t === 'rectangle' || t === 'bearing';
    if (twoPoint && this.draft.length >= 2) {
      this.commit();
    } else {
      this.updateReadout();
      this.render();
    }
  }

  private handleMove(e: maplibregl.MapMouseEvent): void {
    if (!this.active || this.draft.length === 0) return;
    this.hover = [e.lngLat.lng, e.lngLat.lat];
    this.updateReadout();
    this.render();
  }

  private handleDblClick(e: maplibregl.MapMouseEvent): void {
    if (!this.active) return;
    e.preventDefault();
    if (this.active === 'polygon' || this.active === 'distance') {
      // Drop the duplicate point the dblclick's first click added, then commit.
      if (this.draft.length > 1) this.draft.pop();
      this.commit();
    }
  }

  private handleKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.active) {
      if (this.draft.length > 0) { this.draft = []; this.hover = null; this.render(); this.updateReadout(); }
      else this.deactivate();
    }
  }

  private commit(): void {
    if (!this.active) return;
    const t = this.active;
    const pts = [...this.draft];
    const minPts = t === 'polygon' ? 3 : 2;
    if (pts.length < minPts) { this.draft = []; this.render(); return; }

    const color = this.nextColor();
    const drawing: Drawing = {
      id: `d${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
      tool: t, name: this.nextName(t), color,
      points: pts, visible: true, createdAt: Date.now(),
    };
    if (t === 'circle' || t === 'rangeRings' || t === 'sector') {
      const a = pts[0]; const b = pts[1];
      if (!a || !b) { this.draft = []; this.render(); return; }
      drawing.radiusKm = haversineKm(a[1], a[0], b[1], b[0]);
      if (t !== 'sector') drawing.points = [a];
      if (t === 'rangeRings') drawing.rings = RING_COUNT;
    }

    this.drawings.push(drawing);
    this.save();
    this.draft = [];
    this.hover = null;
    this.render();
    this.renderList();
    this.updateReadout();
  }

  // ── persistence ──────────────────────────────────────────────────────────────

  private load(): Drawing[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(d => d && typeof d.id === 'string' && Array.isArray(d.points)) : [];
    } catch { return []; }
  }

  private save(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.drawings)); } catch { /* quota */ }
  }

  // ── naming / colour ──────────────────────────────────────────────────────────

  private nextName(tool: DrawTool): string {
    const n = this.drawings.filter(d => d.tool === tool).length + 1;
    return `${TOOL_LABEL[tool]} ${n}`;
  }

  private currentColor(): string {
    return PALETTE[this.colorIdx % PALETTE.length] ?? '#22d3ee';
  }

  private nextColor(): string {
    const c = this.currentColor();
    this.colorIdx++;
    return c;
  }

  // ── readout ──────────────────────────────────────────────────────────────────

  private showReadout(text: string): void {
    if (!this.container) return;
    if (!this.readout) {
      this.readout = document.createElement('div');
      this.readout.className = 'map-draw-readout';
      this.container.appendChild(this.readout);
    }
    this.readout.textContent = text;
    this.readout.hidden = false;
  }

  private hideReadout(): void {
    if (this.readout) this.readout.hidden = true;
  }

  private updateReadout(): void {
    if (!this.active) return;
    const t = this.active;
    if (this.draft.length === 0) { this.showReadout('Click on the map to start'); return; }

    const draft = this.draftDrawing();
    const hoverPts = this.hover ? [...this.draft, this.hover] : [...this.draft];
    const a = hoverPts[0];
    const b = hoverPts[1];

    if (t === 'circle' || t === 'rangeRings' || t === 'sector') {
      const r = draft?.radiusKm ?? 0;
      const brgTxt = t === 'sector' && a && b ? ` · ${bearingDeg(a[1], a[0], b[1], b[0]).toFixed(0)}°` : '';
      this.showReadout(`Radius: ${formatDistance(r, this.unit)}${brgTxt} — click to set`);
    } else if (t === 'bearing' && a && b) {
      const brg = bearingDeg(a[1], a[0], b[1], b[0]);
      const dist = haversineKm(a[1], a[0], b[1], b[0]);
      this.showReadout(`${brg.toFixed(0)}° · ${formatDistance(dist, this.unit)} — click to set`);
    } else if (t === 'distance') {
      let total = 0;
      for (let i = 1; i < hoverPts.length; i++) {
        const p0 = hoverPts[i - 1]; const p1 = hoverPts[i];
        if (p0 && p1) total += haversineKm(p0[1], p0[0], p1[1], p1[0]);
      }
      this.showReadout(`Total: ${formatDistance(total, this.unit)} · ${this.draft.length} pt — double-click to finish`);
    } else if (t === 'rectangle') {
      this.showReadout('Click opposite corner to set');
    } else if (t === 'polygon') {
      this.showReadout(`${this.draft.length} vertices — double-click to finish`);
    }
  }

  // ── toolbar / list UI ──────────────────────────────────────────────────────────

  private buildToolbar(): void {
    if (!this.container) return;
    const el = document.createElement('div');
    el.className = 'map-draw-toolbar map-tray';
    el.hidden = true;
    el.innerHTML = `
      <div class="map-tray-header">
        <span class="map-tray-title">Draw &amp; Measure</span>
        <select class="map-draw-unit" aria-label="Distance unit">
          <option value="km">km</option>
          <option value="mi">mi</option>
          <option value="nmi">nmi</option>
        </select>
      </div>
      <div class="map-draw-tools"></div>
      <div class="map-draw-list-head">
        <span>Drawings</span>
        <button type="button" class="map-draw-clear" hidden>Clear all</button>
      </div>
      <div class="map-draw-list"></div>
    `;
    const tools = el.querySelector<HTMLElement>('.map-draw-tools')!;
    (Object.keys(TOOL_LABEL) as DrawTool[]).forEach(tool => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'map-draw-tool';
      btn.dataset.tool = tool;
      btn.textContent = TOOL_LABEL[tool];
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => this.activate(tool));
      tools.appendChild(btn);
    });

    el.querySelector<HTMLSelectElement>('.map-draw-unit')!.addEventListener('change', (ev) => {
      this.unit = (ev.target as HTMLSelectElement).value as DistanceUnit;
      this.render();
      this.renderList();
      this.updateReadout();
    });
    el.querySelector<HTMLButtonElement>('.map-draw-clear')!.addEventListener('click', () => this.clearAll());

    this.container.appendChild(el);
    this.toolbar = el;
    this.listEl = el.querySelector<HTMLElement>('.map-draw-list');
    this.renderList();
  }

  private syncToolButtons(): void {
    this.toolbar?.querySelectorAll<HTMLButtonElement>('.map-draw-tool').forEach(btn => {
      const on = btn.dataset.tool === this.active;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
  }

  private renderList(): void {
    if (!this.listEl || !this.toolbar) return;
    const clearBtn = this.toolbar.querySelector<HTMLButtonElement>('.map-draw-clear');
    if (clearBtn) clearBtn.hidden = this.drawings.length === 0;

    if (this.drawings.length === 0) {
      this.listEl.innerHTML = `<div class="map-draw-empty">No drawings yet. Pick a tool above.</div>`;
      return;
    }
    this.listEl.replaceChildren();
    for (const d of this.drawings) {
      const row = document.createElement('div');
      row.className = 'map-draw-item';
      row.innerHTML = `
        <button type="button" class="map-draw-vis" aria-label="Toggle visibility" title="Toggle visibility">${d.visible ? '●' : '○'}</button>
        <span class="map-draw-swatch" style="background:${d.color}"></span>
        <span class="map-draw-name">${escapeText(d.name)}</span>
        <button type="button" class="map-draw-del" aria-label="Delete drawing" title="Delete">×</button>
      `;
      const swatch = row.querySelector<HTMLElement>('.map-draw-swatch')!;
      swatch.style.setProperty('--sw', d.color);
      row.querySelector<HTMLButtonElement>('.map-draw-vis')!.addEventListener('click', () => {
        d.visible = !d.visible; this.save(); this.render(); this.renderList();
      });
      row.querySelector<HTMLButtonElement>('.map-draw-del')!.addEventListener('click', () => {
        this.drawings = this.drawings.filter(x => x.id !== d.id); this.save(); this.render(); this.renderList();
      });
      const nameEl = row.querySelector<HTMLElement>('.map-draw-name')!;
      nameEl.title = 'Double-click to rename';
      nameEl.addEventListener('dblclick', () => this.renameDrawing(d, nameEl));
      this.listEl.appendChild(row);
    }
  }

  private renameDrawing(d: Drawing, nameEl: HTMLElement): void {
    const input = document.createElement('input');
    input.className = 'map-draw-rename';
    input.value = d.name;
    nameEl.replaceWith(input);
    input.focus();
    input.select();
    const finish = (commit: boolean) => {
      if (commit && input.value.trim()) { d.name = input.value.trim().slice(0, 40); this.save(); }
      this.renderList();
    };
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
      else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
    });
  }

  private clearAll(): void {
    if (this.drawings.length === 0) return;
    this.drawings = [];
    this.save();
    this.render();
    this.renderList();
  }
}

function escapeText(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
