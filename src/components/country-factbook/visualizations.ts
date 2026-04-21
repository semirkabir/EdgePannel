/**
 * SVG chart builders for the CIA World Factbook tab renderers.
 * Population pyramid, donut chart, gauge, elevation profile, flow balance charts, transport charts.
 */

import type { FactbookNode } from '@/services/factbook';
import {
  extractNumber,
  extractPercent,
  latestYearEntry,
  takeValue,
} from '@/services/factbook';
import { miniSparkline } from '@/utils/sparkline';
import {
  abbreviateStat,
  el,
  prose,
  stackedBar,
  statTile,
} from './widgets';
import {
  svgEl,
  svgText,
  formatCompactNumber,
  normalizeFactbookText,
  resolveAreaReference,
  formatAreaLabel,
} from './helpers';

export const EVEREST_HEIGHT_M = 8849;
export const WORLD_POPULATION_ESTIMATE = 8_200_000_000;

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface PopulationBracket {
  label: string;
  pct: number;
  male: number;
  female: number;
}

export interface MetricSeries {
  latestText: string | undefined;
  latestYear: string | undefined;
  values: number[];
  years: string[];
}

export interface VisualSegment {
  label: string;
  pct: number;
  color: string;
}

export interface GaugeMarker {
  value: number;
  label: string;
}

export const HEALTH_WORLD_MEDIANS = {
  physician: { median: 1.8, label: '1.8/1K', higherIsBetter: true },
  beds: { median: 2.7, label: '2.7/1K', higherIsBetter: true },
  maternal: { median: 65, label: '65/100K', higherIsBetter: false },
  school: { median: 12, label: '12 years', higherIsBetter: true },
} as const;

// ─── Population Pyramid ────────────────────────────────────────────────────────

export function parsePopulationBracket(label: string, text: string | undefined): PopulationBracket | null {
  const clean = normalizeFactbookText(text);
  if (!clean) return null;
  const male = clean.match(/\bmale\s+([\d,]+)/i)?.[1];
  const female = clean.match(/\bfemale\s+([\d,]+)/i)?.[1];
  if (!male || !female) return null;
  return {
    label,
    pct: extractPercent(clean),
    male: Number.parseFloat(male.replace(/,/g, '')),
    female: Number.parseFloat(female.replace(/,/g, '')),
  };
}

export function buildPopulationPyramid(rows: PopulationBracket[]): HTMLElement | null {
  const valid = rows.filter((row) => Number.isFinite(row.male) && Number.isFinite(row.female));
  if (valid.length === 0) return null;
  const peak = Math.max(1, ...valid.flatMap((row) => [row.male, row.female]));
  const totalMale = valid.reduce((sum, row) => sum + row.male, 0);
  const totalFemale = valid.reduce((sum, row) => sum + row.female, 0);

  const wrap = el('div', 'cdp-fb-pyramid');
  const head = el('div', 'cdp-fb-pyramid-head');
  head.append(
    el('div', 'cdp-fb-pyramid-side-label cdp-fb-pyramid-side-label-male', 'Male'),
    el('div', 'cdp-fb-pyramid-side-label cdp-fb-pyramid-side-label-female', 'Female'),
  );
  wrap.append(head);

  for (const row of valid) {
    const rowEl = el('div', 'cdp-fb-pyramid-row');

    const maleSide = el('div', 'cdp-fb-pyramid-side cdp-fb-pyramid-side-male');
    maleSide.title = `${row.label}: ${formatCompactNumber(row.male)} male`;
    const maleFill = el('div', 'cdp-fb-pyramid-fill cdp-fb-pyramid-fill-male');
    maleFill.style.width = `${Math.max(6, (row.male / peak) * 100)}%`;
    maleSide.append(maleFill);

    const age = el('div', 'cdp-fb-pyramid-age', Number.isFinite(row.pct) ? `${row.label} ${row.pct.toFixed(1)}%` : row.label);

    const femaleSide = el('div', 'cdp-fb-pyramid-side cdp-fb-pyramid-side-female');
    femaleSide.title = `${row.label}: ${formatCompactNumber(row.female)} female`;
    const femaleFill = el('div', 'cdp-fb-pyramid-fill cdp-fb-pyramid-fill-female');
    femaleFill.style.width = `${Math.max(6, (row.female / peak) * 100)}%`;
    femaleSide.append(femaleFill);

    rowEl.append(maleSide, age, femaleSide);
    wrap.append(rowEl);
  }

  wrap.append(el(
    'div',
    'cdp-fb-pyramid-meta',
    `Male ${formatCompactNumber(totalMale)} • Female ${formatCompactNumber(totalFemale)}`,
  ));
  return wrap;
}

// ─── Metric Series / Sparkline ─────────────────────────────────────────────────

export function collectMetricSeries(
  obj: Record<string, FactbookNode> | undefined,
  basename: string,
): MetricSeries {
  const latest = latestYearEntry(obj, basename);
  if (!obj) {
    return {
      latestText: latest.text,
      latestYear: latest.year,
      values: [],
      years: [],
    };
  }

  const rows = Object.entries(obj)
    .map(([key, value]) => {
      if (!key.startsWith(basename)) return null;
      const year = key.match(/(\d{4})$/)?.[1];
      const text = typeof value === 'object' && value && 'text' in value
        ? (value as { text?: string }).text
        : undefined;
      const numeric = extractNumber(text);
      if (!year || !text || !Number.isFinite(numeric)) return null;
      return { year, value: numeric };
    })
    .filter((row): row is { year: string; value: number } => !!row)
    .sort((a, b) => Number.parseInt(a.year, 10) - Number.parseInt(b.year, 10));

  return {
    latestText: latest.text,
    latestYear: latest.year,
    values: rows.map((row) => row.value),
    years: rows.map((row) => row.year),
  };
}

export function buildSparklineTile(
  label: string,
  obj: Record<string, FactbookNode> | undefined,
  basename: string,
): HTMLElement | null {
  const series = collectMetricSeries(obj, basename);
  if (!series.latestText) return null;
  const tile = statTile(label, takeValue(series.latestText), { year: series.latestYear });
  if (series.values.length >= 2) {
    const change = series.values[series.values.length - 1]! - series.values[0]!;
    const sparkMarkup = miniSparkline(series.values, change, 56, 18);
    if (sparkMarkup) {
      const spark = el('div', 'cdp-fb-tile-spark');
      spark.innerHTML = sparkMarkup;
      spark.title = `${series.years[0]} to ${series.years[series.years.length - 1]}`;
      tile.append(spark);
    }
  }
  return tile;
}

// ─── Benchmark Tile ────────────────────────────────────────────────────────────

export function buildBenchmarkTile(
  label: string,
  text: string | undefined,
  median: number,
  medianLabel: string,
  higherIsBetter: boolean,
): HTMLElement | null {
  const valueText = abbreviateStat(takeValue(text));
  if (!valueText) return null;
  const tile = statTile(label, valueText);
  const value = extractNumber(text);
  if (!Number.isFinite(value) || !Number.isFinite(median) || median <= 0) return tile;

  const favorable = higherIsBetter ? value >= median : value <= median;
  const ceiling = Math.max(median * 2, value);
  const ratio = value / median;
  const relation = value >= median ? 'above' : 'below';

  const benchmark = el('div', 'cdp-fb-benchmark');
  const track = el('div', 'cdp-fb-benchmark-track');
  const fill = el(
    'div',
    favorable ? 'cdp-fb-benchmark-fill cdp-fb-benchmark-fill-good' : 'cdp-fb-benchmark-fill cdp-fb-benchmark-fill-bad',
  );
  fill.style.width = `${Math.max(5, (Math.min(value, ceiling) / ceiling) * 100)}%`;
  const marker = el('div', 'cdp-fb-benchmark-marker');
  marker.style.left = `${(median / ceiling) * 100}%`;
  track.append(fill, marker);

  benchmark.append(
    track,
    el('div', 'cdp-fb-benchmark-meta', `${ratio.toFixed(ratio >= 10 ? 0 : 1)}x ${relation} median • world median ${medianLabel}`),
  );
  tile.append(benchmark);
  return tile;
}

// ─── Land/Water Split ──────────────────────────────────────────────────────────

export function buildLandWaterSplit(landText: string | undefined, waterText: string | undefined): HTMLElement | null {
  const land = extractNumber(landText);
  const water = extractNumber(waterText);
  if (!Number.isFinite(land) || !Number.isFinite(water) || land < 0 || water < 0) return null;
  const total = land + water;
  if (total <= 0) return null;
  return stackedBar([
    { label: 'Land', pct: (land / total) * 100, color: '#8b5e34' },
    { label: 'Water', pct: (water / total) * 100, color: '#38bdf8' },
  ]);
}

// ─── Area Comparison ───────────────────────────────────────────────────────────

export function buildAreaComparison(countryName: string, totalAreaText: string | undefined, comparativeText: string | undefined): HTMLElement | null {
  const countryArea = extractNumber(totalAreaText);
  const ref = resolveAreaReference(comparativeText);
  if (!Number.isFinite(countryArea) || !ref) return comparativeText ? prose(comparativeText) : null;

  const wrap = el('div', 'cdp-fb-stack-v');
  const visual = el('div', 'cdp-fb-area-compare');
  const maxArea = Math.max(countryArea, ref.areaSqKm);
  const minSide = 28;
  const maxSide = 88;
  const sideFor = (area: number) => minSide + Math.sqrt(area / maxArea) * (maxSide - minSide);

  const left = el('div', 'cdp-fb-area-box-wrap');
  const leftBox = el('div', 'cdp-fb-area-box cdp-fb-area-box-country');
  leftBox.style.width = `${sideFor(countryArea)}px`;
  leftBox.style.height = `${sideFor(countryArea)}px`;
  left.append(
    leftBox,
    el('div', 'cdp-fb-area-label', countryName),
    el('div', 'cdp-fb-area-meta', formatAreaLabel(countryArea)),
  );

  const right = el('div', 'cdp-fb-area-box-wrap');
  const rightBox = el('div', 'cdp-fb-area-box cdp-fb-area-box-reference');
  rightBox.style.width = `${sideFor(ref.areaSqKm)}px`;
  rightBox.style.height = `${sideFor(ref.areaSqKm)}px`;
  right.append(
    rightBox,
    el('div', 'cdp-fb-area-label', ref.label),
    el('div', 'cdp-fb-area-meta', formatAreaLabel(ref.areaSqKm)),
  );

  visual.append(left, right);
  wrap.append(visual);

  const ratio = countryArea / ref.areaSqKm;
  wrap.append(el(
    'div',
    'cdp-fb-chart-note',
    `${ratio >= 1 ? ratio.toFixed(1) : (1 / ratio).toFixed(1)}${ratio >= 1 ? 'x larger than' : 'x smaller than'} ${ref.label}`,
  ));
  if (comparativeText) wrap.append(prose(comparativeText)!);
  return wrap;
}

// ─── Elevation Profile ─────────────────────────────────────────────────────────

export function buildElevationProfile(
  countryName: string,
  highText: string | undefined,
  _meanText: string | undefined,
  lowText: string | undefined,
): HTMLElement | null {
  const high = extractNumber(highText);
  const low = extractNumber(lowText);
  if (!Number.isFinite(high) || !Number.isFinite(low)) return null;

  const wrap = el('div', 'cdp-fb-elevation');

  const svgWidth = 320;
  const svgHeight = 280;
  const topPad = 60;
  const bottomPad = 36;
  const chartHeight = svgHeight - topPad - bottomPad;

  const maxElev = EVEREST_HEIGHT_M;
  const minElev = Math.min(0, low);
  const range = Math.max(1, maxElev - minElev);
  const yFor = (elev: number) => topPad + ((maxElev - elev) / range) * chartHeight;

  const svg = svgEl('svg', {
    viewBox: `0 0 ${svgWidth} ${svgHeight}`,
    class: 'cdp-fb-elevation-svg',
    role: 'img',
    'aria-label': `${countryName} elevation compared to Mount Everest`,
  });

  const seaY = yFor(0);
  svg.append(svgEl('line', {
    x1: '16', y1: String(seaY), x2: String(svgWidth - 16), y2: String(seaY),
    class: 'cdp-fb-elevation-sealevel',
  }));
  svg.append(svgText({
    x: String(svgWidth - 16),
    y: String(seaY - 5),
    class: 'cdp-fb-elevation-sealevel-label',
    'text-anchor': 'end',
  }, 'Sea level'));

  const countryX = 96;
  const countryTopY = yFor(high);
  const countryBottomY = yFor(low);
  svg.append(svgEl('line', {
    x1: String(countryX), y1: String(countryBottomY),
    x2: String(countryX), y2: String(countryTopY),
    class: 'cdp-fb-elevation-country-line',
  }));
  svg.append(svgEl('circle', {
    cx: String(countryX), cy: String(countryTopY),
    r: '5', class: 'cdp-fb-elevation-peak-dot',
  }));
  svg.append(svgEl('circle', {
    cx: String(countryX), cy: String(countryBottomY),
    r: '5', class: 'cdp-fb-elevation-base-dot',
  }));
  svg.append(svgText({
    x: String(countryX),
    y: String(countryTopY - 10),
    class: 'cdp-fb-elevation-country-label',
    'text-anchor': 'middle',
  }, `${formatCompactNumber(high)} m`));
  if (low < 0) {
    svg.append(svgText({
      x: String(countryX),
      y: String(countryBottomY + 14),
      class: 'cdp-fb-elevation-country-base-label',
      'text-anchor': 'middle',
    }, `${formatCompactNumber(low)} m`));
  }
  const countryCaption = countryName.length > 18 ? `${countryName.slice(0, 17)}…` : countryName;
  svg.append(svgText({
    x: String(countryX),
    y: String(svgHeight - 14),
    class: 'cdp-fb-elevation-caption',
    'text-anchor': 'middle',
  }, countryCaption));

  const everestX = 224;
  const everestTopY = yFor(EVEREST_HEIGHT_M);
  const everestBottomY = yFor(0);
  svg.append(svgEl('line', {
    x1: String(everestX), y1: String(everestBottomY),
    x2: String(everestX), y2: String(everestTopY),
    class: 'cdp-fb-elevation-everest-line',
  }));
  const iconW = 26;
  const iconH = 32;
  const baseY = everestTopY;
  const peakPath = [
    `M ${everestX - iconW} ${baseY}`,
    `L ${everestX - iconW * 0.45} ${baseY - iconH * 0.55}`,
    `L ${everestX - iconW * 0.15} ${baseY - iconH * 0.3}`,
    `L ${everestX + iconW * 0.1} ${baseY - iconH}`,
    `L ${everestX + iconW * 0.4} ${baseY - iconH * 0.55}`,
    `L ${everestX + iconW} ${baseY}`,
    'Z',
  ].join(' ');
  svg.append(svgEl('path', {
    d: peakPath,
    class: 'cdp-fb-elevation-everest-peak',
  }));
  const snowPath = [
    `M ${everestX - iconW * 0.12} ${baseY - iconH * 0.72}`,
    `L ${everestX + iconW * 0.1} ${baseY - iconH}`,
    `L ${everestX + iconW * 0.28} ${baseY - iconH * 0.68}`,
    `L ${everestX + iconW * 0.18} ${baseY - iconH * 0.6}`,
    `L ${everestX + iconW * 0.05} ${baseY - iconH * 0.78}`,
    `L ${everestX - iconW * 0.02} ${baseY - iconH * 0.65}`,
    'Z',
  ].join(' ');
  svg.append(svgEl('path', {
    d: snowPath,
    class: 'cdp-fb-elevation-everest-snow',
  }));
  svg.append(svgText({
    x: String(everestX),
    y: String(baseY - iconH - 8),
    class: 'cdp-fb-elevation-everest-label',
    'text-anchor': 'middle',
  }, `${formatCompactNumber(EVEREST_HEIGHT_M)} m`));
  svg.append(svgText({
    x: String(everestX),
    y: String(svgHeight - 14),
    class: 'cdp-fb-elevation-caption',
    'text-anchor': 'middle',
  }, 'Mt. Everest'));

  wrap.append(svg);

  const pctOfEverest = Math.max(0, (high / EVEREST_HEIGHT_M) * 100);
  const legend = el('div', 'cdp-fb-elevation-legend');
  const makeItem = (label: string, value: string): HTMLElement => {
    const item = el('div', 'cdp-fb-elevation-item');
    item.append(
      el('div', 'cdp-fb-elevation-label', label),
      el('div', 'cdp-fb-elevation-value', value),
    );
    return item;
  };
  legend.append(
    makeItem('Highest', takeValue(highText) || `${formatCompactNumber(high)} m`),
    makeItem('Lowest', takeValue(lowText) || `${formatCompactNumber(low)} m`),
    makeItem('vs. Everest', `${pctOfEverest.toFixed(1)}%`),
  );
  wrap.append(legend);

  return wrap;
}

// ─── Flow Balance ──────────────────────────────────────────────────────────────

export function buildFlowBalance(title: string, productionText: string | undefined, consumptionText: string | undefined): HTMLElement | null {
  const production = extractNumber(productionText);
  const consumption = extractNumber(consumptionText);
  if (!Number.isFinite(production) && !Number.isFinite(consumption)) return null;
  const peak = Math.max(1, Number.isFinite(production) ? production : 0, Number.isFinite(consumption) ? consumption : 0);

  const card = el('div', 'cdp-fb-flow-card');
  card.append(el('div', 'cdp-fb-flow-title', title));

  const chart = el('div', 'cdp-fb-flow-chart');
  const left = el('div', 'cdp-fb-flow-side cdp-fb-flow-side-consumption');
  const leftFill = el('div', 'cdp-fb-flow-fill cdp-fb-flow-fill-consumption');
  leftFill.style.width = `${((Number.isFinite(consumption) ? consumption : 0) / peak) * 100}%`;
  left.append(leftFill);

  const center = el('div', 'cdp-fb-flow-center');
  center.append(el('div', 'cdp-fb-flow-axis'));

  const right = el('div', 'cdp-fb-flow-side cdp-fb-flow-side-production');
  const rightFill = el('div', 'cdp-fb-flow-fill cdp-fb-flow-fill-production');
  rightFill.style.width = `${((Number.isFinite(production) ? production : 0) / peak) * 100}%`;
  right.append(rightFill);

  chart.append(left, center, right);
  card.append(chart);

  const labels = el('div', 'cdp-fb-flow-labels');
  labels.append(
    el('div', 'cdp-fb-flow-label', `Consumption ${takeValue(consumptionText) || '—'}`),
    el('div', 'cdp-fb-flow-label cdp-fb-flow-label-right', `Production ${takeValue(productionText) || '—'}`),
  );
  card.append(labels);
  return card;
}

// ─── Transport Chart ───────────────────────────────────────────────────────────

export function buildTransportChart(items: Array<{ label: string; icon: string; text: string | undefined; color: string }>): HTMLElement | null {
  const metrics = items
    .map((item) => ({
      ...item,
      value: extractNumber(item.text),
    }))
    .filter((item) => Number.isFinite(item.value) && item.value > 0);
  if (metrics.length === 0) return null;

  const peak = Math.max(...metrics.map((item) => item.value), 1);
  const wrap = el('div', 'cdp-fb-stack-v');
  const chart = el('div', 'cdp-fb-bars cdp-fb-bars-transport');

  for (const item of metrics) {
    const row = el('div', 'cdp-fb-bar-row');
    const label = el('span', 'cdp-fb-bar-label', `${item.icon} ${item.label}`);
    const track = el('div', 'cdp-fb-bar-track');
    const fill = el('div', 'cdp-fb-bar-fill cdp-fb-bar-fill-transport');
    fill.style.width = `${Math.max(6, (Math.log10(item.value + 1) / Math.log10(peak + 1)) * 100)}%`;
    fill.style.background = `linear-gradient(90deg, ${item.color}, color-mix(in srgb, ${item.color} 55%, white 45%))`;
    track.append(fill);
    row.append(label, track, el('span', 'cdp-fb-bar-val', takeValue(item.text)));
    chart.append(row);
  }

  wrap.append(chart, el('div', 'cdp-fb-chart-note', 'Log scale across mixed units to show infrastructure scale at a glance.'));
  return wrap;
}

// ─── Population Pictogram ──────────────────────────────────────────────────────

export function buildPopulationPictogram(popText: string | undefined): HTMLElement | null {
  const population = extractNumber(popText);
  if (!Number.isFinite(population) || population <= 0) return null;

  const share = Math.min(1, population / WORLD_POPULATION_ESTIMATE);
  const scaled = share * 10;
  const fullIcons = Math.floor(scaled);
  const partialIcon = Math.max(0, Math.min(1, scaled - fullIcons));

  const wrap = el('div', 'cdp-fb-pop-pictogram');
  const row = el('div', 'cdp-fb-pop-icons');
  for (let i = 0; i < 10; i += 1) {
    const icon = el('div', 'cdp-fb-pop-icon');
    const fill = el('div', 'cdp-fb-pop-icon-fill');
    const ratio = i < fullIcons ? 1 : i === fullIcons ? partialIcon : 0;
    fill.style.height = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    icon.append(fill);
    row.append(icon);
  }

  const sharePct = (share * 100).toFixed(share >= 0.1 ? 1 : 2);
  wrap.append(
    row,
    el('div', 'cdp-fb-pop-meta', `${sharePct}% of world population`),
  );
  return wrap;
}

// ─── Donut Chart ───────────────────────────────────────────────────────────────

export function buildDonutChart(segments: VisualSegment[], centerLabel: string): HTMLElement | null {
  const valid = segments.filter((segment) => Number.isFinite(segment.pct) && segment.pct > 0);
  if (valid.length === 0) return null;

  const total = valid.reduce((sum, segment) => sum + segment.pct, 0) || 1;
  const wrap = el('div', 'cdp-fb-donut');
  const svg = svgEl('svg', {
    viewBox: '0 0 120 120',
    class: 'cdp-fb-donut-svg',
    role: 'img',
    'aria-label': `${centerLabel} breakdown donut chart`,
  });
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  svg.append(svgEl('circle', {
    cx: '60',
    cy: '60',
    r: String(radius),
    class: 'cdp-fb-donut-track',
  }));

  for (const segment of valid) {
    const ring = svgEl('circle', {
      cx: '60',
      cy: '60',
      r: String(radius),
      class: 'cdp-fb-donut-segment',
    });
    ring.style.stroke = segment.color;
    ring.style.strokeDasharray = `${(segment.pct / total) * circumference} ${circumference}`;
    ring.style.strokeDashoffset = `${-offset}`;
    offset += (segment.pct / total) * circumference;
    svg.append(ring);
  }

  const center = el('div', 'cdp-fb-donut-center');
  center.append(
    el('div', 'cdp-fb-donut-value', `${Math.round(total)}%`),
    el('div', 'cdp-fb-donut-label', centerLabel),
  );
  wrap.append(svg, center);
  return wrap;
}

// ─── Gauge ─────────────────────────────────────────────────────────────────────

export function buildGauge(
  value: number,
  options: {
    label: string;
    valueText: string;
    note?: string;
    max: number;
    markers?: GaugeMarker[];
    tone?: 'good' | 'warn' | 'info';
  },
): HTMLElement | null {
  if (!Number.isFinite(value) || !Number.isFinite(options.max) || options.max <= 0) return null;

  const wrap = el('div', 'cdp-fb-gauge');
  const svg = svgEl('svg', {
    viewBox: '0 0 160 160',
    class: 'cdp-fb-gauge-svg',
    role: 'img',
    'aria-label': `${options.label} gauge`,
  });
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(options.max, value));

  const track = svgEl('circle', {
    cx: '80',
    cy: '80',
    r: String(radius),
    class: 'cdp-fb-gauge-track',
  });
  const progress = svgEl('circle', {
    cx: '80',
    cy: '80',
    r: String(radius),
    class: `cdp-fb-gauge-progress cdp-fb-gauge-progress-${options.tone ?? 'info'}`,
  });
  progress.style.strokeDasharray = `${(clamped / options.max) * circumference} ${circumference}`;
  progress.style.strokeDashoffset = '0';
  svg.append(track, progress);

  for (const marker of options.markers ?? []) {
    if (!Number.isFinite(marker.value) || marker.value < 0) continue;
    const ratio = Math.max(0, Math.min(1, marker.value / options.max));
    const angle = -90 + ratio * 360;
    const radians = angle * (Math.PI / 180);
    const cx = 80 + Math.cos(radians) * radius;
    const cy = 80 + Math.sin(radians) * radius;
    svg.append(svgEl('circle', {
      cx: cx.toFixed(1),
      cy: cy.toFixed(1),
      r: '3.5',
      class: 'cdp-fb-gauge-marker-dot',
    }));
  }

  const figure = el('div', 'cdp-fb-gauge-figure');
  const center = el('div', 'cdp-fb-gauge-center');
  center.append(
    el('div', 'cdp-fb-gauge-value', options.valueText),
    el('div', 'cdp-fb-gauge-label', options.label),
  );
  figure.append(svg, center);

  wrap.append(figure);
  if (options.note) {
    wrap.append(el('div', 'cdp-fb-gauge-note', options.note));
  }

  if ((options.markers ?? []).length > 0) {
    const legend = el('div', 'cdp-fb-gauge-legend');
    for (const marker of options.markers ?? []) {
      const item = el('div', 'cdp-fb-gauge-legend-item');
      item.append(
        el('span', 'cdp-fb-gauge-legend-dot'),
        el('span', 'cdp-fb-gauge-legend-label', marker.label),
      );
      legend.append(item);
    }
    wrap.append(legend);
  }

  return wrap;
}
