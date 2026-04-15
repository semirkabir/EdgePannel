import type { GpsJamHex } from '@/services/gps-interference';
import type { EntityRenderer, EntityRenderContext } from '../types';

const REGION_LABELS: Record<string, string> = {
  'iran-iraq': 'Iran / Iraq',
  'levant': 'Levant',
  'israel-sinai': 'Israel / Sinai',
  'ukraine-russia': 'Ukraine / Russia',
  'russia-north': 'Northern Russia',
  'turkey-caucasus': 'Turkey / Caucasus',
  'afghanistan-pakistan': 'Afghanistan / Pakistan',
  'yemen-horn': 'Yemen / Horn of Africa',
  'northern-europe': 'Northern Europe',
  'western-europe': 'Western Europe',
  'north-america': 'North America',
  'other': 'Other Region',
};

const LEVEL_CLASS: Record<string, string> = {
  high: 'edp-badge edp-badge-severity',
  medium: 'edp-badge edp-badge-warning',
};

function classifyRegion(lat: number, lon: number): string {
  if (lat >= 29 && lat <= 42 && lon >= 43 && lon <= 63) return 'iran-iraq';
  if (lat >= 31 && lat <= 37 && lon >= 35 && lon <= 43) return 'levant';
  if (lat >= 28 && lat <= 34 && lon >= 29 && lon <= 36) return 'israel-sinai';
  if (lat >= 44 && lat <= 53 && lon >= 22 && lon <= 41) return 'ukraine-russia';
  if (lat >= 54 && lat <= 70 && lon >= 27 && lon <= 60) return 'russia-north';
  if (lat >= 36 && lat <= 42 && lon >= 26 && lon <= 45) return 'turkey-caucasus';
  if (lat >= 32 && lat <= 38 && lon >= 63 && lon <= 75) return 'afghanistan-pakistan';
  if (lat >= 10 && lat <= 20 && lon >= 42 && lon <= 55) return 'yemen-horn';
  if (lat >= 50 && lat <= 72 && lon >= -10 && lon <= 25) return 'northern-europe';
  if (lat >= 35 && lat <= 50 && lon >= -10 && lon <= 25) return 'western-europe';
  if (lat >= 25 && lat <= 50 && lon >= -125 && lon <= -65) return 'north-america';
  return 'other';
}

export class GpsJammingRenderer implements EntityRenderer {
  renderSkeleton(data: unknown, ctx: EntityRenderContext): HTMLElement {
    const hex = data as GpsJamHex;
    const container = ctx.el('div', 'edp-generic');

    const header = ctx.el('div', 'edp-header');
    header.append(ctx.el('h2', 'edp-title', 'GPS Interference Zone'));
    const region = classifyRegion(hex.lat, hex.lon);
    header.append(ctx.el('div', 'edp-subtitle', REGION_LABELS[region] ?? region));

    const badgeRow = ctx.el('div', 'edp-badge-row');
    badgeRow.append(ctx.badge(hex.level.toUpperCase(), LEVEL_CLASS[hex.level] ?? 'edp-badge'));
    badgeRow.append(ctx.badge('GPS JAMMING', 'edp-badge'));
    header.append(badgeRow);
    container.append(header);

    const [detailCard, detailBody] = ctx.sectionCard('Interference Details');
    const pctStr = hex.pct != null ? `${hex.pct}%` : '\u2014';
    detailBody.append(ctx.el('div', 'edp-detail-row').appendChild(
      (() => { const r = ctx.el('div', 'edp-detail-row'); r.append(ctx.el('span', 'edp-detail-label', 'Flights Affected'), ctx.el('span', 'edp-detail-value', pctStr)); return r; })()
    ));
    const detailGrid = ctx.el('div', 'edp-detail-row');
    detailGrid.append(ctx.el('span', 'edp-detail-label', 'Affected Flights'));
    detailGrid.append(ctx.el('span', 'edp-detail-value', String(hex.bad ?? 0)));
    detailBody.append(detailGrid);

    const goodRow = ctx.el('div', 'edp-detail-row');
    goodRow.append(ctx.el('span', 'edp-detail-label', 'Normal Flights'));
    goodRow.append(ctx.el('span', 'edp-detail-value', String(hex.good ?? 0)));
    detailBody.append(goodRow);

    const totalRow = ctx.el('div', 'edp-detail-row');
    totalRow.append(ctx.el('span', 'edp-detail-label', 'Total Tracked'));
    totalRow.append(ctx.el('span', 'edp-detail-value', String(hex.total ?? 0)));
    detailBody.append(totalRow);

    container.append(detailCard);

    const [locCard, locBody] = ctx.sectionCard('Location');
    locBody.append(ctx.el('div', 'edp-detail-row').appendChild(
      (() => { const r = ctx.el('div', 'edp-detail-row'); r.append(ctx.el('span', 'edp-detail-label', 'Coordinates'), ctx.el('span', 'edp-detail-value', `${hex.lat.toFixed(4)}\u00b0, ${hex.lon.toFixed(4)}\u00b0`)); return r; })()
    ));
    locBody.append((() => { const r = ctx.el('div', 'edp-detail-row'); r.append(ctx.el('span', 'edp-detail-label', 'Region'), ctx.el('span', 'edp-detail-value', REGION_LABELS[region] ?? region)); return r; })());
    container.append(locCard);

    const [noteCard, noteBody] = ctx.sectionCard('About');
    noteBody.append(ctx.el('p', 'edp-description', 'GPS jamming or spoofing in this hex cell was detected through aircraft navigation anomalies. Affected flights experienced degraded GPS positioning accuracy or complete signal loss.'));
    container.append(noteCard);

    return container;
  }
}