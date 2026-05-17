export interface CountryProfile {
  code: string;
  iso3: string;
  name: string;
  capital: string | null;
  region: string;
  subregion: string;
  population: number;
  areaKm2: number;
  languages: Record<string, string>;
  currencies: Record<string, { name: string; symbol: string }>;
  timezones: string[];
  lat: number;
  lon: number;
  demonym: string;
  flagEmoji: string;
  borders: string[];
  independent: boolean;
  unMember: boolean;
}

export interface CountryIndicator {
  code: string;
  name: string;
  gdpCurrentUSD: number | null;
  gdpPerCapitaUSD: number | null;
  gdpGrowthPct: number | null;
  inflationPct: number | null;
  unemploymentPct: number | null;
  population: number | null;
  giniIndex: number | null;
  internetUsersPct: number | null;
  militarySpendPctGDP: number | null;
  co2EmissionsKt: number | null;
  lifeExpectancyYears: number | null;
  literacyRatePct: number | null;
  year: number;
}

export interface CountryIndex {
  code: string;
  name: string;
  hdi: number | null;
  hdiRank: number | null;
  cpiScore: number | null;
  cpiRank: number | null;
  freedomScore: number | null;
  freedomStatus: 'Free' | 'Partly Free' | 'Not Free' | null;
  democracyIndex: number | null;
  democracyRegime: 'Full Democracy' | 'Flawed Democracy' | 'Hybrid Regime' | 'Authoritarian' | null;
  fragileStatesIndex: number | null;
  globalPeaceIndex: number | null;
  gpiRank: number | null;
  sourceYear: number;
}

export interface CountryProfileBundle {
  profiles: Record<string, CountryProfile>;
  indicators: Record<string, CountryIndicator>;
  indices: Record<string, CountryIndex>;
}
