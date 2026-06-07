export type DataConfidenceTier = 'strong' | 'caution' | 'fragile';

export interface DataConfidenceAssessment {
  tier: DataConfidenceTier;
  label: string;
  sourceLabel: string;
  summary: string;
  caveats: string[];
}

export interface MacroForecastConfidenceInput {
  domain?: string;
  title?: string;
  scenario?: string;
  feedSummary?: string;
  signals?: Array<{ type?: string; value?: string }>;
  confidence?: number;
  calibration?: { source?: string; marketTitle?: string };
  caseFile?: {
    baseCase?: string;
    changeSummary?: string;
    worldState?: { summary?: string; activePressures?: string[]; keyUnknowns?: string[] };
    supportingEvidence?: Array<{ summary?: string }>;
    counterEvidence?: Array<{ summary?: string }>;
    triggers?: string[];
  };
}

export interface ConsumerPriceConfidenceInput {
  coveragePct?: number;
  freshnessLagMin?: number;
  upstreamUnavailable?: boolean;
  stalledCount?: number;
  parseSuccessRates?: number[];
}

const LABOR_TERMS = [
  'payroll',
  'jobs',
  'employment',
  'unemployment',
  'labor',
  'labour',
  'wage',
  'worker',
  'workers',
  'gig',
  'ces',
  'cps',
  'jolts',
  'birth-death',
  'multiple job',
];

const PRICE_TERMS = [
  'cpi',
  'inflation',
  'prices',
  'price pressure',
  'shelter',
  'rent',
  'core pce',
  'ppi',
  'deflation',
];

const OUTPUT_TERMS = [
  'gdp',
  'retail sales',
  'consumer spending',
  'personal consumption',
  'advance estimate',
  'revision',
  'revised',
  'bea',
  'census',
];

const OFFICIAL_SOURCE_TERMS = ['bls', 'census', 'bea', 'fred', 'federal reserve', 'fed'];
const MARKET_SOURCE_TERMS = ['polymarket', 'kalshi', 'prediction market', 'market price'];

function includesAny(text: string, terms: string[]): boolean {
  return terms.some(term => text.includes(term));
}

function compactList(items: Array<string | undefined>, limit = 5): string[] {
  return items.filter((item): item is string => Boolean(item?.trim())).slice(0, limit);
}

export function assessMacroForecastConfidence(input: MacroForecastConfidenceInput): DataConfidenceAssessment | null {
  const signalText = (input.signals ?? []).map(signal => `${signal.type ?? ''} ${signal.value ?? ''}`).join(' ');
  const evidenceText = [
    ...(input.caseFile?.supportingEvidence ?? []).map(item => item.summary),
    ...(input.caseFile?.counterEvidence ?? []).map(item => item.summary),
    ...(input.caseFile?.triggers ?? []),
    ...(input.caseFile?.worldState?.activePressures ?? []),
    ...(input.caseFile?.worldState?.keyUnknowns ?? []),
  ].join(' ');
  const text = [
    input.domain,
    input.title,
    input.scenario,
    input.feedSummary,
    signalText,
    input.caseFile?.baseCase,
    input.caseFile?.changeSummary,
    input.caseFile?.worldState?.summary,
    evidenceText,
    input.calibration?.source,
    input.calibration?.marketTitle,
  ].join(' ').toLowerCase();

  const caveats: string[] = [];
  const sourceNotes: string[] = [];

  if (includesAny(text, LABOR_TERMS)) {
    caveats.push('Labor prints can overstate strength when payroll jobs diverge from employed people.');
    caveats.push('Gig and supplemental work may be undercounted by main-job survey framing.');
  }

  if (includesAny(text, PRICE_TERMS)) {
    caveats.push('Inflation reads can be distorted by imputation, shelter weight, and broken collection periods.');
  }

  if (includesAny(text, OUTPUT_TERMS)) {
    caveats.push('GDP, retail, and spending signals carry high first-print revision risk.');
  }

  if (includesAny(text, OFFICIAL_SOURCE_TERMS)) {
    sourceNotes.push('official statistical series');
  }

  if (includesAny(text, MARKET_SOURCE_TERMS)) {
    sourceNotes.push('market-implied pricing');
    caveats.push('Market calibration reflects trader consensus, not measurement precision.');
  }

  const isMacroDomain = input.domain === 'market';
  if (!isMacroDomain && caveats.length === 0) return null;

  if (caveats.length === 0) {
    caveats.push('Macro-sensitive inputs are modeled estimates and should be checked against revisions.');
  }

  const modelConfidence = typeof input.confidence === 'number' ? input.confidence : 1;
  const tier: DataConfidenceTier = caveats.length >= 3 || modelConfidence < 0.45
    ? 'fragile'
    : caveats.length >= 2 || modelConfidence < 0.65
      ? 'caution'
      : 'strong';

  const sourceLabel = compactList(sourceNotes).join(' + ') || 'mixed macro sources';

  return {
    tier,
    label: tier === 'fragile' ? 'Data fragile' : tier === 'caution' ? 'Data caveat' : 'Data checked',
    sourceLabel,
    summary: tier === 'strong'
      ? 'Macro inputs look usable, but still represent modeled estimates.'
      : tier === 'caution'
        ? 'Interpret the probability with macro measurement caveats.'
        : 'Macro measurement risk may materially distort the signal.',
    caveats: compactList(caveats, 3),
  };
}

export function assessConsumerPriceConfidence(input: ConsumerPriceConfidenceInput): DataConfidenceAssessment {
  const coverage = input.coveragePct ?? 0;
  const freshness = input.freshnessLagMin ?? 0;
  const parseRates = input.parseSuccessRates ?? [];
  const avgParse = parseRates.length
    ? parseRates.reduce((sum, rate) => sum + rate, 0) / parseRates.length
    : 1;

  const caveats: string[] = [
    'Retailer baskets are high-frequency price signals, not official CPI.',
    'They do not include shelter weight or official CPI imputation mechanics.',
  ];

  if (input.upstreamUnavailable) {
    caveats.push('Collection is unavailable or still warming up.');
  }
  if (coverage > 0 && coverage < 60) {
    caveats.push('Low product coverage can overstate category moves.');
  } else if (coverage > 0 && coverage < 80) {
    caveats.push('Partial product coverage can bias basket comparisons.');
  }
  if (freshness > 240) {
    caveats.push('Stale retailer runs can miss fresh price changes.');
  } else if (freshness > 60) {
    caveats.push('Freshness lag can blur week-over-week changes.');
  }
  if ((input.stalledCount ?? 0) > 0) {
    caveats.push('Some retailer feeds are stalled.');
  }
  if (avgParse < 0.8) {
    caveats.push('Parser failures can distort retailer spreads.');
  }

  const tier: DataConfidenceTier = input.upstreamUnavailable || coverage < 50 || freshness > 480 || avgParse < 0.65
    ? 'fragile'
    : coverage < 80 || freshness > 60 || (input.stalledCount ?? 0) > 0 || avgParse < 0.9
      ? 'caution'
      : 'strong';

  return {
    tier,
    label: tier === 'fragile' ? 'Data fragile' : tier === 'caution' ? 'Coverage caveat' : 'Coverage solid',
    sourceLabel: 'retailer collection',
    summary: tier === 'strong'
      ? 'Good retailer coverage for a real-time basket read.'
      : tier === 'caution'
        ? 'Read basket moves as directional; coverage or freshness may distort the magnitude.'
        : 'Price signal is thin enough that headline moves may be misleading.',
    caveats: compactList(caveats, 4),
  };
}
