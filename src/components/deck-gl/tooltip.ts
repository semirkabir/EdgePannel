/**
 * Builds hover-tooltip HTML for DeckGLMap picked objects.
 *
 * Extracted verbatim from DeckGLMap.getTooltip(): a pure switch over the picked
 * layer id that returns escaped tooltip markup. The instance data maps it reads
 * (CII / governance / democracy / happiness / election / market / sanctions /
 * tariff / GEM-risk overlays) are passed in via `TooltipContext`, so the
 * function stays side-effect-free and the returned HTML is unchanged.
 */
import type { PickingInfo } from '@deck.gl/core';
import type { GulfInvestment } from '@/types';
import type { TradeRouteSegment } from '@/config/trade-routes';
import { UNDERSEA_CABLES } from '@/config/geo';
import { CONFIDENCE_TIERS, type ConfidenceTier } from '@/services/confidence-tier';
import { t } from '@/services/i18n';
import { escapeHtml } from '@/utils/sanitize';
import { formatAircraftAge, formatAircraftSourceLabel } from './geo-math';
import { countryToFlagEmoji } from './helpers';
import { formatPolymarketVolume } from './prediction-market-style';

// Choropleth level → swatch colour, used by the overlay tooltip cases.
// Moved here from DeckGLMap statics since this is now their only consumer.
const CII_LEVEL_HEX: Record<string, string> = {
  critical: '#b91c1c', high: '#dc2626', elevated: '#f59e0b', normal: '#eab308', low: '#22c55e',
};
const GOV_LEVEL_HEX: Record<string, string> = {
  excellent: '#16a34a', good: '#22c55e', moderate: '#eab308', weak: '#f59e0b', failing: '#dc2626',
};
const SANCTION_LEVEL_HEX: Record<string, string> = {
  severe: '#ff0000', high: '#ff6400', moderate: '#ffc800',
};
const DEMOCRACY_LEVEL_HEX: Record<string, string> = {
  'Full Democracy': '#16a34a', 'Democracy': '#22c55e', 'Hybrid Regime': '#eab308', 'Autocracy': '#dc2626',
};
const GEM_RISK_HEX: Record<string, string> = {
  low: '#22c55e', moderate: '#eab308', high: '#f59e0b', critical: '#dc2626',
};

export interface TooltipContext {
  ciiScoresMap: Map<string, { score: number; level: string }>;
  governanceScoresMap: Map<string, { index: number; level: string }>;
  sanctionsCountriesMap: Map<string, 'severe' | 'high' | 'moderate'>;
  marketPerfMap: Map<string, { changePercent: number }>;
  tariffBarriersMap: Map<string, { level: 'high' | 'moderate' | 'low'; rate?: number }>;
  democracyScoresMap: Map<string, { score: number; regimeType: string }>;
  gemRiskScoresMap: Map<string, { compositeRisk: number; rank: number }>;
  happinessScores: Map<string, number>;
  happinessYear: number;
  happinessSource: string;
  electionResults: Map<string, { winner: string; margin: number; color: [number, number, number, number] }>;
}

export function buildTooltipHtml(info: PickingInfo, ctx: TooltipContext): { html: string } | null {
    if (!info.object) return null;

    const rawLayerId = info.layer?.id || '';
    const layerId = rawLayerId.endsWith('-ghost') ? rawLayerId.slice(0, -6) : rawLayerId;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = info.object as any;
    const text = (value: unknown): string => escapeHtml(String(value ?? ''));

    switch (layerId) {
      case 'hotspots-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${text(obj.subtext)}</div>` };
      case 'earthquakes-layer':
        return { html: `<div class="deckgl-tooltip"><strong>M${(obj.magnitude || 0).toFixed(1)} ${t('components.deckgl.tooltip.earthquake')}</strong><br/>${text(obj.place)}</div>` };
      case 'military-vessels-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${text(obj.operatorCountry)}</div>` };
      case 'military-flights-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.callsign || obj.registration || t('components.deckgl.tooltip.militaryAircraft'))}</strong><br/>${text(obj.type)}</div>` };
      case 'military-vessel-clusters-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name || t('components.deckgl.tooltip.vesselCluster'))}</strong><br/>${obj.vesselCount || 0} ${t('components.deckgl.tooltip.vessels')}<br/>${text(obj.activityType)}</div>` };
      case 'military-flight-clusters-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name || t('components.deckgl.tooltip.flightCluster'))}</strong><br/>${obj.flightCount || 0} ${t('components.deckgl.tooltip.aircraft')}<br/>${text(obj.activityType)}</div>` };
      case 'protests-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.title)}</strong><br/>${text(obj.country)}</div>` };
      case 'protest-clusters-layer':
        if (obj.count === 1) {
          const item = obj.items?.[0];
          return { html: `<div class="deckgl-tooltip"><strong>${text(item?.title || t('components.deckgl.tooltip.protest'))}</strong><br/>${text(item?.city || item?.country || '')}</div>` };
        }
        return { html: `<div class="deckgl-tooltip"><strong>${t('components.deckgl.tooltip.protestsCount', { count: String(obj.count) })}</strong><br/>${text(obj.country)}</div>` };
      case 'tech-hq-clusters-layer':
        if (obj.count === 1) {
          const hq = obj.items?.[0];
          return { html: `<div class="deckgl-tooltip"><strong>${text(hq?.company || '')}</strong><br/>${text(hq?.city || '')}</div>` };
        }
        return { html: `<div class="deckgl-tooltip"><strong>${t('components.deckgl.tooltip.techHQsCount', { count: String(obj.count) })}</strong><br/>${text(obj.city)}</div>` };
      case 'tech-event-clusters-layer':
        if (obj.count === 1) {
          const ev = obj.items?.[0];
          return { html: `<div class="deckgl-tooltip"><strong>${text(ev?.title || '')}</strong><br/>${text(ev?.location || '')}</div>` };
        }
        return { html: `<div class="deckgl-tooltip"><strong>${t('components.deckgl.tooltip.techEventsCount', { count: String(obj.count) })}</strong><br/>${text(obj.location)}</div>` };
      case 'datacenter-clusters-layer':
        if (obj.count === 1) {
          const dc = obj.items?.[0];
          return { html: `<div class="deckgl-tooltip"><strong>${text(dc?.name || '')}</strong><br/>${text(dc?.owner || '')}</div>` };
        }
        return { html: `<div class="deckgl-tooltip"><strong>${t('components.deckgl.tooltip.dataCentersCount', { count: String(obj.count) })}</strong><br/>${text(obj.country)}</div>` };
      case 'bases-layer': {
        const flag = countryToFlagEmoji(obj.country || '');
        const location = [flag, text(obj.country)].filter(Boolean).join(' ');
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${location}${obj.kind ? ` · ${text(obj.kind)}` : ''}</div>` };
      }
      case 'bases-cluster-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${obj.count} bases</strong></div>` };
      case 'bases-cluster-singles-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.baseName || obj.name || 'Military Base')}</strong><br/>${text(obj.baseCountry || obj.country || '')}</div>` };
      case 'nuclear-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${text(obj.type)}</div>` };
      case 'datacenters-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${text(obj.owner)}</div>` };
      case 'cables-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${t('components.deckgl.tooltip.underseaCable')}</div>` };
      case 'pipelines-layer': {
        const pipelineType = String(obj.type || '').toLowerCase();
        const pipelineTypeLabel = pipelineType === 'oil'
          ? t('popups.pipeline.types.oil')
          : pipelineType === 'gas'
            ? t('popups.pipeline.types.gas')
            : pipelineType === 'products'
              ? t('popups.pipeline.types.products')
              : `${text(obj.type)} ${t('components.deckgl.tooltip.pipeline')}`;
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${pipelineTypeLabel}</div>` };
      }
      case 'conflict-zones-layer': {
        const props = obj.properties || obj;
        return { html: `<div class="deckgl-tooltip"><strong>${text(props.name)}</strong><br/>${t('components.deckgl.tooltip.conflictZone')}</div>` };
      }

      case 'natural-events-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.title)}</strong><br/>${text(obj.category || t('components.deckgl.tooltip.naturalEvent'))}</div>` };
      case 'climate-aqi-layer': {
        const aqi = obj.europeanAqi != null ? `EAQI ${obj.europeanAqi}` : 'AQI n/a';
        const pm = obj.pm25 != null ? `PM2.5 ${Number(obj.pm25).toFixed(1)}` : '';
        const details = [aqi, pm].filter(Boolean).join(' · ');
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.location)}</strong><br/>${details}<br/><span style="opacity:0.8">${text(obj.source)}</span></div>` };
      }
      case 'nav-warnings-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.title)}</strong><br/>${text(obj.area)}</div>` };
      case 'market-perf-choropleth-layer': {
        const code = (obj as any)?.properties?.['ISO3166-1-Alpha-2'] as string | undefined;
        const entry = code ? ctx.marketPerfMap.get(code) : undefined;
        if (!entry) return null;
        const sign = entry.changePercent >= 0 ? '+' : '';
        return { html: `<div class="deckgl-tooltip"><strong>${code}</strong><br/>Weekly: ${sign}${entry.changePercent.toFixed(2)}%</div>` };
      }
      case 'tariff-barriers-choropleth-layer': {
        const code = (obj as any)?.properties?.['ISO3166-1-Alpha-2'] as string | undefined;
        const entry = code ? ctx.tariffBarriersMap.get(code) : undefined;
        if (!entry) return null;
        const rateStr = entry.rate != null ? ` (${entry.rate.toFixed(1)}% avg)` : '';
        return { html: `<div class="deckgl-tooltip"><strong>${code}</strong><br/>Tariff barrier: ${entry.level}${rateStr}</div>` };
      }
      case 'ais-vessels-layer': {
        const shipTypeLabel = (() => {
          const st = obj.shipType ?? 0;
          if (st >= 80 && st <= 89) return 'Tanker';
          if (st >= 70 && st <= 79) return 'Cargo';
          if (st >= 60 && st <= 69) return 'Passenger';
          if (st >= 35 && st <= 36) return 'Military';
          if (st >= 30 && st <= 34) return 'Fishing';
          if (st >= 50 && st <= 59) return 'Service';
          if (st > 0) return `Type ${st}`;
          return 'Vessel';
        })();
        const speedStr = obj.speed != null ? `${Number(obj.speed).toFixed(1)} kn` : '';
        const hdgStr = obj.heading != null && obj.heading >= 0 && obj.heading <= 360
          ? `${Math.round(obj.heading)}°`
          : obj.course != null ? `${Math.round(obj.course)}°` : '';
        const details = [speedStr, hdgStr].filter(Boolean).join(' · ');
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name || obj.mmsi)}</strong><br/>${shipTypeLabel}${details ? `<br/>${details}` : ''}</div>` };
      }
      case 'ais-density-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${t('components.deckgl.layers.shipTraffic')}</strong><br/>${t('popups.intensity')}: ${text(obj.intensity)}</div>` };
      case 'maritime-satellite-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>Satellite ${text(String(obj.type || '').replace(/_/g, ' '))}<br/>${text(obj.confidence)} confidence</div>` };
      case 'maritime-ocean-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${text(String(obj.metric || '').replace(/_/g, ' '))}: ${text(String(obj.value))}${text(obj.unit || '')}<br/>${text(obj.severity)} conditions</div>` };
      case 'maritime-fishing-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${text(obj.activity)} fishing activity<br/>${text(obj.vesselsEstimated != null ? `${obj.vesselsEstimated} est. vessels` : obj.confidence)}</div>` };
      case 'waterways-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${t('components.deckgl.layers.strategicWaterways')}</div>` };
      case 'economic-centers-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${text(obj.country)}</div>` };
      case 'polymarkets-layer': {
        const yes = Number(obj.yesPrice ?? 50);
        const no = 100 - yes;
        const conviction = Math.abs(yes - 50) / 50;
        const r = Math.round(125 + conviction * 40);
        const g = Math.round(190 + conviction * 28);
        const barColor = `rgb(${r},${g},255)`;
        const yesStr = yes.toFixed(0);
        const noStr = no.toFixed(0);
        const countryPart = obj.country
          ? `<span>${text(obj.country)}</span><span class="pm-tooltip-meta-dot">·</span>`
          : '';
        const endPart = obj.endDate
          ? (() => {
              const days = Math.ceil((new Date(obj.endDate as string).getTime() - Date.now()) / 86_400_000);
              return days > 0 ? `<span class="pm-tooltip-enddate">${days}d left</span>` : '';
            })()
          : '';
        return {
          html: `<div class="deckgl-tooltip deckgl-tooltip--polymarket">
            <div class="pm-tooltip-title">${text(obj.title)}</div>
            <div class="pm-tooltip-probs">
              <div class="pm-tooltip-side">
                <span class="pm-tooltip-label">YES</span>
                <span class="pm-tooltip-pct" style="color:${barColor}">${yesStr}%</span>
              </div>
              <div class="pm-tooltip-bar">
                <div class="pm-tooltip-bar-fill" style="width:${yesStr}%;background:${barColor}"></div>
              </div>
              <div class="pm-tooltip-side">
                <span class="pm-tooltip-label">NO</span>
                <span class="pm-tooltip-pct pm-tooltip-pct--no">${noStr}%</span>
              </div>
            </div>
            <div class="pm-tooltip-meta">
              ${countryPart}<span>${text(formatPolymarketVolume(obj.volume))}</span>${endPart}
            </div>
          </div>`,
        };
      }
      case 'stock-exchanges-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.shortName)}</strong><br/>${text(obj.city)}, ${text(obj.country)}</div>` };
      case 'financial-centers-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${text(obj.type)} ${t('components.deckgl.tooltip.financialCenter')}</div>` };
      case 'central-banks-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.shortName)}</strong><br/>${text(obj.city)}, ${text(obj.country)}</div>` };
      case 'commodity-hubs-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${text(obj.type)} · ${text(obj.city)}</div>` };
      case 'startup-hubs-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.city)}</strong><br/>${text(obj.country)}</div>` };
      case 'tech-hqs-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.company)}</strong><br/>${text(obj.city)}</div>` };
      case 'accelerators-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${text(obj.city)}</div>` };
      case 'cloud-regions-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.provider)}</strong><br/>${text(obj.region)}</div>` };
      case 'tech-events-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.title)}</strong><br/>${text(obj.location)}</div>` };
      case 'irradiators-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${text(obj.type || t('components.deckgl.layers.gammaIrradiators'))}</div>` };
      case 'spaceports-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${text(obj.country || t('components.deckgl.layers.spaceports'))}</div>` };
      case 'ports-layer': {
        const typeIcon = obj.type === 'naval' ? '⚓' : obj.type === 'oil' || obj.type === 'lng' ? '🛢️' : '🏭';
        return { html: `<div class="deckgl-tooltip"><strong>${typeIcon} ${text(obj.name)}</strong><br/>${text(obj.type || t('components.deckgl.tooltip.port'))} - ${text(obj.country)}</div>` };
      }
      case 'flight-delays-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)} (${text(obj.iata)})</strong><br/>${text(obj.severity)}: ${text(obj.reason)}</div>` };
      case 'aircraft-positions-layer':
        return {
          html: `<div class="deckgl-tooltip"><strong>${text(obj.callsign || obj.icao24)}</strong><br/>${obj.altitudeFt?.toLocaleString() ?? 0} ft · ${Math.round(obj.groundSpeedKts ?? 0)} kts · ${Math.round(obj.trackDeg ?? 0)}°<br/><span style="opacity:.72">${text(formatAircraftSourceLabel(obj))} · ${text(formatAircraftAge(obj.observedAt))}</span></div>`,
        };
      case 'satellites-layer':
      case 'satellites-dot-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${text(obj.operator || '')}<br/>${text(obj.category || 'satellite')}</div>` };
      case 'apt-groups-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${text(obj.aka)}<br/>${t('popups.sponsor')}: ${text(obj.sponsor)}</div>` };
      case 'minerals-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${text(obj.mineral)} - ${text(obj.country)}<br/>${text(obj.operator)}</div>` };
      case 'mining-sites-layer': {
        const statusLabel = obj.status === 'producing' ? '⛏️ Producing' : obj.status === 'development' ? '🔧 Development' : '🔍 Exploration';
        const outputStr = obj.annualOutput ? `<br/><span style="opacity:.75">${text(obj.annualOutput)}</span>` : '';
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${text(obj.mineral)} · ${text(obj.country)}<br/>${statusLabel}${outputStr}</div>` };
      }
      case 'processing-plants-layer': {
        const typeLabel = obj.type === 'smelter' ? '🏭 Smelter' : obj.type === 'refinery' ? '⚗️ Refinery' : obj.type === 'separation' ? '🧪 Separation' : '🏗️ Processing';
        const capacityStr = obj.capacityTpa ? `<br/><span style="opacity:.75">${text(String((obj.capacityTpa / 1000).toFixed(0)))}k t/yr</span>` : '';
        const mineralLabel = obj.mineral ?? (Array.isArray(obj.materials) ? obj.materials.join(', ') : '');
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${text(mineralLabel)} · ${text(obj.country)}<br/>${typeLabel}${capacityStr}</div>` };
      }
      case 'commodity-ports-layer': {
        const commoditiesStr = Array.isArray(obj.commodities) ? obj.commodities.join(', ') : '';
        const volumeStr = obj.annualVolumeMt ? `<br/><span style="opacity:.75">${text(String(obj.annualVolumeMt))}Mt/yr</span>` : '';
        return { html: `<div class="deckgl-tooltip"><strong>⚓ ${text(obj.name)}</strong><br/>${text(obj.country)}<br/>${text(commoditiesStr)}${volumeStr}</div>` };
      }
      case 'ais-disruptions-layer':
        return { html: `<div class="deckgl-tooltip"><strong>AIS ${text(obj.type || t('components.deckgl.tooltip.disruption'))}</strong><br/>${text(obj.severity)} ${t('popups.severity')}<br/>${text(obj.description)}</div>` };
      case 'gps-jamming-layer':
        return { html: `<div class="deckgl-tooltip"><strong>GPS Jamming</strong><br/>${text(obj.level)} interference (${obj.pct}%)<br/>H3: ${text(obj.h3)}</div>` };
      case 'cable-advisories-layer': {
        const cableName = UNDERSEA_CABLES.find(c => c.id === obj.cableId)?.name || obj.cableId;
        return { html: `<div class="deckgl-tooltip"><strong>${text(cableName)}</strong><br/>${text(obj.severity || t('components.deckgl.tooltip.advisory'))}<br/>${text(obj.description)}</div>` };
      }
      case 'repair-ships-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name || t('components.deckgl.tooltip.repairShip'))}</strong><br/>${text(obj.status)}</div>` };
      // All weather sub-layers share the same tooltip
      case 'weather-tornado-layer':
      case 'weather-flood-layer':
      case 'weather-thunderstorm-layer':
      case 'weather-snow-layer':
      case 'weather-heat-layer':
      case 'weather-hurricane-layer':
      case 'weather-fire-layer':
      case 'weather-wind-layer':
      case 'weather-default-layer': {
        const areaDesc = typeof obj.areaDesc === 'string' ? obj.areaDesc : '';
        const area = areaDesc ? `<br/><small>${text(areaDesc.slice(0, 50))}${areaDesc.length > 50 ? '...' : ''}</small>` : '';
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.event || t('components.deckgl.layers.weatherAlerts'))}</strong><br/>${text(obj.severity)}${area}</div>` };
      }
      case 'outages-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.asn || t('components.deckgl.tooltip.internetOutage'))}</strong><br/>${text(obj.country)}</div>` };
      case 'cyber-threats-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${t('popups.cyberThreat.title')}</strong><br/>${text(obj.severity || t('components.deckgl.tooltip.medium'))} · ${text(obj.country || t('popups.unknown'))}</div>` };
      case 'iran-events-layer': {
        const tier = obj.confidenceTier as ConfidenceTier;
        const tierLabel = tier && CONFIDENCE_TIERS[tier] ? CONFIDENCE_TIERS[tier].label : '';
        const tierStyle = tier && CONFIDENCE_TIERS[tier] ? `color:${CONFIDENCE_TIERS[tier].color};` : '';
        const tierHtml = tierLabel ? `<br/><span style="font-size:11px;${tierStyle}font-weight:600">${tierLabel}</span>` : '';
        return { html: `<div class="deckgl-tooltip"><strong>${t('components.deckgl.layers.iranAttacks')}: ${text(obj.category || '')}</strong><br/>${text((obj.title || '').slice(0, 80))}${tierHtml}</div>` };
      }
      case 'news-locations-layer':
        return { html: `<div class="deckgl-tooltip"><strong>📰 ${t('components.deckgl.tooltip.news')}</strong><br/>${text(obj.title?.slice(0, 80) || '')}</div>` };
      case 'positive-events-layer': {
        const catLabel = obj.category ? obj.category.replace(/-/g, ' & ') : 'Positive Event';
        const countInfo = obj.count > 1 ? `<br/><span style="opacity:.7">${obj.count} sources reporting</span>` : '';
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/><span style="text-transform:capitalize">${text(catLabel)}</span>${countInfo}</div>` };
      }
      case 'kindness-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong></div>` };
      case 'happiness-choropleth-layer': {
        const hcName = obj.properties?.name ?? 'Unknown';
        const hcCode = obj.properties?.['ISO3166-1-Alpha-2'];
        const hcScore = hcCode ? ctx.happinessScores.get(hcCode as string) : undefined;
        const hcScoreStr = hcScore != null ? hcScore.toFixed(1) : 'No data';
        return { html: `<div class="deckgl-tooltip"><strong>${text(hcName)}</strong><br/>Happiness: ${hcScoreStr}/10${hcScore != null ? `<br/><span style="opacity:.7">${text(ctx.happinessSource)} (${ctx.happinessYear})</span>` : ''}</div>` };
      }
      case 'elections-choropleth-layer': {
        const elName = obj.properties?.name ?? 'Unknown';
        const elCode = obj.properties?.['ISO3166-1-Alpha-2'];
        const elEntry = elCode ? ctx.electionResults.get(elCode as string) : undefined;
        if (!elEntry) return { html: `<div class="deckgl-tooltip"><strong>${text(elName)}</strong><br/><span style="opacity:.7">No election data</span></div>` };
        const marginStr = elEntry.margin != null ? `${elEntry.margin.toFixed(1)}% margin` : '';
        return { html: `<div class="deckgl-tooltip"><strong>${text(elName)}</strong><br/><span style="color:#${elEntry.color.slice(0, 3).map(c => c.toString(16).padStart(2, '0')).join('')};font-weight:600">${text(elEntry.winner)}</span>${marginStr ? `<br/><span style="opacity:.7">${marginStr}</span>` : ''}</div>` };
      }
      case 'cii-choropleth-layer': {
        const ciiName = obj.properties?.name ?? 'Unknown';
        const ciiCode = obj.properties?.['ISO3166-1-Alpha-2'];
        const ciiEntry = ciiCode ? ctx.ciiScoresMap.get(ciiCode as string) : undefined;
        if (!ciiEntry) return { html: `<div class="deckgl-tooltip"><strong>${text(ciiName)}</strong><br/><span style="opacity:.7">No CII data</span></div>` };
        const levelColor = CII_LEVEL_HEX[ciiEntry.level] ?? '#888';
        return { html: `<div class="deckgl-tooltip"><strong>${text(ciiName)}</strong><br/>CII: <span style="color:${levelColor};font-weight:600">${ciiEntry.score}/100</span><br/><span style="text-transform:capitalize;opacity:.7">${text(ciiEntry.level)}</span></div>` };
      }
      case 'governance-choropleth-layer': {
        const govName = obj.properties?.name ?? 'Unknown';
        const govCode = obj.properties?.['ISO3166-1-Alpha-2'];
        const govEntry = govCode ? ctx.governanceScoresMap.get(govCode as string) : undefined;
        if (!govEntry) return { html: `<div class="deckgl-tooltip"><strong>${text(govName)}</strong><br/><span style="opacity:.7">No governance data</span></div>` };
        const govColor = GOV_LEVEL_HEX[govEntry.level] ?? '#888';
        return { html: `<div class="deckgl-tooltip"><strong>${text(govName)}</strong><br/>Governance: <span style="color:${govColor};font-weight:600">${govEntry.index.toFixed(1)}/100</span><br/><span style="text-transform:capitalize;opacity:.7">${text(govEntry.level)}</span></div>` };
      }
      case 'sanctions-choropleth-layer': {
        const sancName = obj.properties?.name ?? 'Unknown';
        const sancCode = obj.properties?.['ISO3166-1-Alpha-2'];
        const sancLevel = sancCode ? ctx.sanctionsCountriesMap.get(sancCode as string) : undefined;
        if (!sancLevel) return { html: `<div class="deckgl-tooltip"><strong>${text(sancName)}</strong><br/><span style="opacity:.7">Not sanctioned</span></div>` };
        const sancColor = SANCTION_LEVEL_HEX[sancLevel] ?? '#888';
        return { html: `<div class="deckgl-tooltip"><strong>${text(sancName)}</strong><br/><span style="color:${sancColor};font-weight:600;text-transform:capitalize">${sancLevel} sanctions</span></div>` };
      }
      case 'sanctioned-assets-layer':
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${text(obj.type.replace(/_/g, ' '))} - ${text(obj.sanctionCountry)}</div>` };
      case 'democracy-choropleth-layer': {
        const demName = obj.properties?.name ?? 'Unknown';
        const demCode = obj.properties?.['ISO3166-1-Alpha-2'];
        const demEntry = demCode ? ctx.democracyScoresMap.get(demCode as string) : undefined;
        if (!demEntry) return { html: `<div class="deckgl-tooltip"><strong>${text(demName)}</strong><br/><span style="opacity:.7">No democracy data</span></div>` };
        const demColor = DEMOCRACY_LEVEL_HEX[demEntry.regimeType] ?? '#888';
        return { html: `<div class="deckgl-tooltip"><strong>${text(demName)}</strong><br/>Democracy: <span style="color:${demColor};font-weight:600">${demEntry.score.toFixed(1)}/100</span><br/><span style="opacity:.7">${text(demEntry.regimeType)}</span></div>` };
      }
      case 'gem-risk-choropleth-layer': {
        const gemName = obj.properties?.name ?? 'Unknown';
        const gemCode = obj.properties?.['ISO3166-1-Alpha-2'];
        const gemEntry = gemCode ? ctx.gemRiskScoresMap.get(gemCode as string) : undefined;
        if (!gemEntry) return { html: `<div class="deckgl-tooltip"><strong>${text(gemName)}</strong><br/><span style="opacity:.7">No risk data</span></div>` };
        const risk = gemEntry.compositeRisk;
        const gemLevel = risk < 25 ? 'low' : risk < 50 ? 'moderate' : risk < 75 ? 'high' : 'critical';
        const gemColor = GEM_RISK_HEX[gemLevel] ?? '#888';
        return { html: `<div class="deckgl-tooltip"><strong>${text(gemName)}</strong><br/>Risk: <span style="color:${gemColor};font-weight:600">${risk.toFixed(1)}/100</span><br/><span style="opacity:.7;text-transform:capitalize">${gemLevel} (Rank #${gemEntry.rank})</span></div>` };
      }
      case 'species-recovery-layer': {
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.commonName)}</strong><br/>${text(obj.recoveryZone?.name ?? obj.region)}<br/><span style="opacity:.7">Status: ${text(obj.recoveryStatus)}</span></div>` };
      }
      case 'renewable-installations-layer': {
        const riTypeLabel = obj.type ? String(obj.type).charAt(0).toUpperCase() + String(obj.type).slice(1) : 'Renewable';
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.name)}</strong><br/>${riTypeLabel} &middot; ${obj.capacityMW?.toLocaleString() ?? '?'} MW<br/><span style="opacity:.7">${text(obj.country)} &middot; ${obj.year}</span></div>` };
      }
      case 'trade-routes-layer': {
        const seg = obj as TradeRouteSegment;
        const statusLabel = seg.status === 'disrupted' ? '⚠ Disrupted' : seg.status === 'high_risk' ? '⚠ High Risk' : 'Active';
        return { html: `<div class="deckgl-tooltip"><strong>${text(seg.routeName)}</strong><br/>${text(seg.category)} · ${text(seg.volumeDesc)}<br/><span style="opacity:.7">${statusLabel}</span></div>` };
      }
      case 'gulf-investments-layer': {
        const inv = obj as GulfInvestment;
        const flag = inv.investingCountry === 'SA' ? '🇸🇦' : '🇦🇪';
        const usd = inv.investmentUSD != null
          ? (inv.investmentUSD >= 1000 ? `$${(inv.investmentUSD / 1000).toFixed(1)}B` : `$${inv.investmentUSD}M`)
          : t('components.deckgl.tooltip.undisclosed');
        const stake = inv.stakePercent != null ? `<br/>${text(String(inv.stakePercent))}% ${t('components.deckgl.tooltip.stake')}` : '';
        return {
          html: `<div class="deckgl-tooltip">
            <strong>${flag} ${text(inv.assetName)}</strong><br/>
            <em>${text(inv.investingEntity)}</em><br/>
            ${text(inv.targetCountry)} · ${text(inv.sector)}<br/>
            <strong>${usd}</strong>${stake}<br/>
            <span style="text-transform:capitalize">${text(inv.status)}</span>
          </div>`,
        };
      }
      case 'fires-layer': {
        const frpStr = obj.frp ? ` · FRP ${obj.frp.toFixed(0)}` : '';
        return { html: `<div class="deckgl-tooltip"><strong>🔥 ${text(obj.region || 'Fire')}</strong><br/>Brightness: ${obj.brightness?.toFixed(0) ?? '?'}K${frpStr}</div>` };
      }
      case 'ucdp-events-layer': {
        const deaths = obj.deaths_best > 0 ? `<br/><span style="opacity:.7">${obj.deaths_best} estimated deaths</span>` : '';
        return { html: `<div class="deckgl-tooltip"><strong>${text(obj.side_a)} vs ${text(obj.side_b)}</strong><br/>${text(obj.country)} · ${text(obj.type_of_violence?.replace(/-/g, ' '))}${deaths}</div>` };
      }
      default:
        return null;
    }
}
