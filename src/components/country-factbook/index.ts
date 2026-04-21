/**
 * Per-tab renderers for the CIA World Factbook tabs on the country brief panel.
 * Each `renderX(data)` returns the full pane contents for a single tab.
 *
 * Design intent: every tab groups fields into 2-5 sub-cards using layouts that
 * fit the data shape (tiles for single numbers, stacked/labeled bars for
 * percentages, chips for categorical lists, callouts for hazards/disputes).
 */

import type { FactbookData } from '@/services/factbook';
import { extractYear, stripYearTag } from '@/services/factbook';
import { el, emptyMessage, stripNoteHtml, combine } from './widgets';
import {
  renderGeographyTab,
  renderPeopleTab,
  renderGovernmentTab,
  renderEconomyTab,
  renderEnergyTab,
  renderCommunicationsTab,
  renderTransportationTab,
  renderMilitaryTab,
  renderTransnationalTab,
} from './tab-renderers';

export type TabId =
  | 'overview'
  | 'geography'
  | 'people'
  | 'government'
  | 'economy'
  | 'energy'
  | 'communications'
  | 'transportation'
  | 'military'
  | 'transnational';

export interface TabDef {
  id: TabId;
  label: string;
}

export const FACTBOOK_TABS: TabDef[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'geography', label: 'Geography' },
  { id: 'people', label: 'People' },
  { id: 'government', label: 'Government' },
  { id: 'economy', label: 'Economy' },
  { id: 'energy', label: 'Energy' },
  { id: 'communications', label: 'Comms' },
  { id: 'transportation', label: 'Transport' },
  { id: 'military', label: 'Military' },
  { id: 'transnational', label: 'Issues' },
];

/** Main dispatcher — returns a pane element for a given tab. */
export function renderFactbookTab(tab: TabId, data: FactbookData | null, country: string): HTMLElement {
  if (!data) {
    const wrap = el('div', 'cdp-fb-pane-empty');
    wrap.append(emptyMessage(`Factbook data not available for ${country}.`));
    return wrap;
  }
  const wrap = el('div', 'cdp-fb-pane-inner');
  const body = dispatch(tab, data, country);
  if (!body || body.childElementCount === 0) {
    wrap.append(emptyMessage('Not available for this country.'));
    return wrap;
  }
  wrap.append(body);
  return wrap;
}

function dispatch(tab: TabId, data: FactbookData, country: string): HTMLElement | null {
  switch (tab) {
    case 'geography': return renderGeographyTab(data, country);
    case 'people': return renderPeopleTab(data);
    case 'government': return renderGovernmentTab(data);
    case 'economy': return renderEconomyTab(data);
    case 'energy': return renderEnergyTab(data);
    case 'communications': return renderCommunicationsTab(data);
    case 'transportation': return renderTransportationTab(data);
    case 'military': return renderMilitaryTab(data);
    case 'transnational': return renderTransnationalTab(data, country);
    default: return null;
  }
}

// ─── Re-exports for backward compatibility ─────────────────────────────────────

export {
  CLIMATE_CHIP_RULES,
  HAZARD_CHIP_RULES,
  RESOURCE_CHIP_RULES,
  COMMODITY_CHIP_RULES,
  MILITARY_BRANCH_CHIP_RULES,
  AREA_REFERENCES,
  COUNTRY_ALIAS_ENTRIES,
  normalizeFactbookText,
  titleCase,
  escapeRegex,
  svgEl,
  svgText,
  formatCompactNumber,
  uniqueChips,
  collectKeywordChips,
  mapItemsToChips,
  extractLeadingClause,
  describeGovernmentType,
  describeLegalSystem,
  extractMilitaryBranches,
  describeTipTier,
  formatAreaLabel,
  getTotalAreaText,
  resolveAreaReference,
  iso2ToFlagEmoji,
  resolveCountryFlagEmoji,
  parsePartnerStats,
  buildPartnerChips,
  parseCountryMentions,
  splitList,
  parseLabeledPercents,
} from './helpers';

export {
  EVEREST_HEIGHT_M,
  WORLD_POPULATION_ESTIMATE,
  parsePopulationBracket,
  buildPopulationPyramid,
  collectMetricSeries,
  buildSparklineTile,
  buildBenchmarkTile,
  buildLandWaterSplit,
  buildAreaComparison,
  buildElevationProfile,
  buildFlowBalance,
  buildTransportChart,
  buildPopulationPictogram,
  buildDonutChart,
  buildGauge,
  HEALTH_WORLD_MEDIANS,
} from './visualizations';

export {
  renderGeographyTab,
  renderPeopleTab,
  renderGovernmentTab,
  renderEconomyTab,
  renderEnergyTab,
  renderCommunicationsTab,
  renderTransportationTab,
  renderMilitaryTab,
  renderTransnationalTab,
} from './tab-renderers';

export type {
  KeywordChipRule,
  ItemChipRule,
  AreaReference,
} from './helpers';

export type {
  PopulationBracket,
  MetricSeries,
  VisualSegment,
  GaugeMarker,
} from './visualizations';

// silence unused imports in case a helper becomes dead after a tweak
void extractYear;
void stripYearTag;
void stripNoteHtml;
void combine;
