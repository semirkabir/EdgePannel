/**
 * Unified economic service barrel -- re-exports from focused sub-modules.
 *
 * Sub-modules:
 *   - fred.ts       FRED (Federal Reserve Economic Data)
 *   - eia.ts        EIA/Energy analytics
 *   - worldbank.ts  World Bank indicators, tech readiness, governance, vulnerability
 *   - bis.ts        BIS (Bank for International Settlements)
 *
 * All existing imports from '@/services/economic' continue to work unchanged.
 */

// FRED
export {
  fetchFredData,
  getFredStatus,
  getChangeClass,
  formatChange,
  FRED_SERIES,
} from './fred';
export type { FredSeries } from './fred';

// EIA / Energy
export {
  fetchOilAnalytics,
  fetchEnergyCapacityRpc,
  checkEiaStatus,
  formatOilValue,
  getTrendIndicator,
  getTrendColor,
} from './eia';
export type { OilDataPoint, OilMetric, OilAnalytics } from './eia';

// World Bank
export {
  getIndicatorData,
  getTechReadinessRankings,
  getCountryComparison,
  getGovernanceScores,
  getEconomicVulnerability,
  getAvailableIndicators,
  fetchCountryMacroData,
  INDICATOR_PRESETS,
  TECH_COUNTRIES,
} from './worldbank';
export type {
  WorldBankResponse,
  TechReadinessScore,
  GovernanceScore,
  EconomicVulnerabilityData,
  MacroEconomicCard,
} from './worldbank';

// Re-export constants that consumers may reference
export { TECH_INDICATORS, MACRO_INDICATORS } from './worldbank';

// BIS
export {
  fetchBisData,
} from './bis';
export type { BisData, BisPolicyRate, BisExchangeRate, BisCreditToGdp } from './bis';
