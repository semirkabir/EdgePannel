import type { SatelliteData } from '@/types';
import { getSatellitePosition } from '@/services/satellite-orbit';
import { row, textSection } from '../types';
import type { EntityRenderer, EntityRenderContext } from '../types';

type SatellitePanelData = SatelliteData & {
  position?: { lat: number; lon: number; alt: number };
  lat?: number;
  lon?: number;
  alt?: number;
};

function titleCase(value: string | undefined): string {
  if (!value) return 'Satellite';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatNumber(value: number | undefined, digits = 2): string {
  return Number.isFinite(value) ? (value as number).toFixed(digits) : '--';
}

function currentPosition(satellite: SatellitePanelData): { lat: number; lon: number; alt: number } {
  if (satellite.position) return satellite.position;
  if (
    Number.isFinite(satellite.lat) &&
    Number.isFinite(satellite.lon) &&
    Number.isFinite(satellite.alt)
  ) {
    return {
      lat: satellite.lat as number,
      lon: satellite.lon as number,
      alt: satellite.alt as number,
    };
  }
  return getSatellitePosition(satellite, Date.now());
}

function buildHeader(container: HTMLElement, ctx: EntityRenderContext, satellite: SatellitePanelData): void {
  const header = ctx.el('div', 'edp-header');
  header.append(ctx.el('h2', 'edp-title', satellite.name || 'Satellite'));
  header.append(ctx.el('div', 'edp-subtitle', `NORAD ${satellite.noradId || '--'} · ${satellite.operator || 'Unknown operator'}`));
  const badges = ctx.el('div', 'edp-badge-row');
  badges.append(ctx.badge(titleCase(satellite.category), 'edp-badge'));
  badges.append(ctx.badge((satellite.source || 'derived').toUpperCase(), 'edp-badge edp-badge-dim'));
  header.append(badges);
  container.append(header);
}

function buildPositionCard(container: HTMLElement, ctx: EntityRenderContext, satellite: SatellitePanelData): void {
  const position = currentPosition(satellite);
  const [card, body] = ctx.sectionCard('Current Position');
  body.append(row(ctx, 'Latitude', `${formatNumber(position.lat, 4)}°`));
  body.append(row(ctx, 'Longitude', `${formatNumber(position.lon, 4)}°`));
  body.append(row(ctx, 'Altitude', `${formatNumber(position.alt, 0)} km`));
  body.append(row(ctx, 'Updated', new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })));
  container.append(card);
}

function buildOrbitCard(container: HTMLElement, ctx: EntityRenderContext, satellite: SatellitePanelData): void {
  const [card, body] = ctx.sectionCard('Orbital Elements');
  body.append(row(ctx, 'Epoch', satellite.epoch ? new Date(satellite.epoch).toLocaleString() : 'Unavailable'));
  body.append(row(ctx, 'Mean Motion', satellite.meanMotion != null ? `${formatNumber(satellite.meanMotion, 4)} rev/day` : '--'));
  body.append(row(ctx, 'Inclination', satellite.inclination != null ? `${formatNumber(satellite.inclination, 2)}°` : '--'));
  body.append(row(ctx, 'RAAN', satellite.raan != null ? `${formatNumber(satellite.raan, 2)}°` : '--'));
  body.append(row(ctx, 'Eccentricity', satellite.eccentricity != null ? formatNumber(satellite.eccentricity, 6) : '--'));
  container.append(card);
}

function buildSourceCard(container: HTMLElement, ctx: EntityRenderContext, satellite: SatellitePanelData): void {
  const [card, body] = ctx.sectionCard('Source');
  body.append(row(ctx, 'Source', satellite.source === 'celestrak' ? 'CelesTrak GP/OMM' : titleCase(satellite.source)));
  body.append(row(ctx, 'Group', satellite.sourceGroup || 'Curated'));
  body.append(row(ctx, 'Propagation', 'SGP4/SDP4 (satellite.js)'));
  container.append(card);
}

export class SatelliteRenderer implements EntityRenderer {
  renderSkeleton(data: unknown, ctx: EntityRenderContext): HTMLElement {
    const satellite = data as SatellitePanelData;
    const container = ctx.el('div', 'edp-generic');
    buildHeader(container, ctx, satellite);
    buildPositionCard(container, ctx, satellite);
    buildOrbitCard(container, ctx, satellite);
    buildSourceCard(container, ctx, satellite);
    container.append(textSection(
      ctx,
      'Accuracy Note',
      'Positions are propagated client-side from CelesTrak orbital elements using SGP4/SDP4 for dashboard visualization. They depend on source freshness and are not suitable for antenna pointing, collision analysis, or precision tracking.',
    ));
    return container;
  }
}
