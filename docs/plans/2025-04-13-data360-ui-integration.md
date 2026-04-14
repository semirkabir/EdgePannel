# Data360 UI Integration Plan

## Where Each Dataset Lives in the UI

### V-Dem Democracy Indices (84 indicators) → 3 surfaces

1. **DemocracyPanel** (new, panel key `democracy`) — Ranked list of countries by composite democracy score with 5 sub-score bars (Electoral, Liberal, Participatory, Deliberative, Egalitarian) + Freedom of Expression + Corruption. Visible in `full` and `tech` variants.

2. **Country Deep-Dive — Governance Section** — When you click any country on the map, the CountryDeepDivePanel gets a new "Governance & Democracy" section with V-Dem radar chart + Polity regime type badge ("Full Democracy" / "Hybrid Regime" / "Autocracy").

3. **CII Enhancement** — The Country Instability Index currently uses only WGI (6 governance indicators). Now it blends: **WGI 50% + V-Dem electoral democracy 30% + Polity combined 20%**. No UI change needed — the CII score just gets more accurate.

### IFC GEM Risk (12 indicators) → 3 surfaces

1. **Risk Dashboard Panel** — New or enhanced from existing `GeopoliticalRiskPanel`. Top 10 riskiest countries, breakdown by political/economic/operational/sovereign risk.

2. **Country Deep-Dive — Risk Profile Section** — Small cards showing each risk category for the clicked country.

3. **New Map Layer `gemRisk`** — Choropleth coloring countries by combined GEM risk score. Available in `full`, `finance`, `commodity` variants.

### WB ESG (71 indicators) → 2 surfaces

1. **Country Deep-Dive — ESG Profile Section** — Environmental (CO2, PM2.5, renewable), Social (access to electricity, literacy), Governance (already covered by WGI/V-Dem).

2. **RenewableEnergyPanel Enhancement** — Add ESG renewable breakdown by source and energy intensity trends.

### WB SSGD (128 indicators) → 2 surfaces

1. **Country Deep-Dive — Social Sustainability Section** (full + happy variants)

2. **New "Social Progress" Panel** for `happy` variant + new `socialProgress` map layer

### WB FINDEX (280 indicators) → 2 surfaces

1. **New "Financial Inclusion" Panel** for `finance` variant

2. **Country Deep-Dive — Financial Access Section** (finance variant only)

### ITU Digital Health (78 indicators) → 2 surfaces

1. **TechReadinessPanel Enhancement** — Add broadband prices, digital skills, ICT employment

2. **New "Digital Economy" Panel** for `tech` variant

## Phased Approach

**Phase 1** (build first): DemocracyPanel, CII blend, Country Deep-Dive governance/risk sections, GEM Risk Dashboard, search integration

**Phase 2**: ESG, Social Progress, Financial Inclusion, Digital Economy panels + country deep-dive sections

**Phase 3**: Gender Equity deep-dive, choropleth map layers, enhanced ProgressCharts

## Panel Registrations per Variant

### `full` variant
- Add: `democracy` (priority 1), `gem-risk` (priority 2)
- Add map layers: `gemRisk`, `democracy`
- Modify CII computation to include V-Dem + Polity blend

### `tech` variant
- Add: `democracy` (priority 2)
- Enhance: `tech-readiness` panel with Data360 digital health data

### `finance` variant
- Add: `gem-risk` (priority 1)
- Add map layer: `gemRisk`

### `happy` variant
- Add in Phase 2: `social-progress` panel, `socialProgress` map layer

## Type Definitions Needed

```typescript
// V-Dem Democracy Score
interface DemocracyScore {
  countryCode: string;
  countryName: string;
  compositeScore: number;    // 0-100, weighted blend
  rank: number;
  regimeType: 'Full Democracy' | 'Democracy' | 'Hybrid Regime' | 'Autocracy';
  components: {
    electoral: number | null;      // V2X_API
    liberal: number | null;        // V2X_LIB  
    participatory: number | null; // V2X_PART
    deliberative: number | null;   // V2X_DL
    egalitarian: number | null;    // V2X_EG
    freedomOfExpression: number | null; // V2XME_FREEXP
    cleanElections: number | null;      // V2XELECGOV
  };
  source: 'vdem' | 'polity';
}

// Polity V Regime Data
interface PolityData {
  countryCode: string;
  countryName: string;
  polityScore: number;      // -10 to +10
  democracyScore: number;   // 0-10
  autocracyScore: number;   // 0-10
  regimeType: 'Full Democracy' | 'Democracy' | 'Hybrid Regime' | 'Autocracy';
  constraintOnExecutive: number; // 1-7
  politicalCompetition: number;  // 1-10
}

// GEM Risk Score
interface GemRiskScore {
  countryCode: string;
  countryName: string;
  compositeRisk: number;      // 0-100
  rank: number;
  components: {
    political: number | null;    // PBD
    economic: number | null;     // BED  
    operational: number | null;  // OD
    sovereign: number | null;    // SRD
  };
}

// Enhanced CII Governance Component (blended)
interface EnhancedGovernanceScore {
  countryCode: string;
  countryName: string;
  wgiScore: number;           // 50% weight
  vdemElectoralDemocracy: number | null; // 30% weight
  polityScore: number | null;  // 20% weight
  blendedGovernance: number;   // final blended value
}
```

## Search Integration

Add Data360 indicators to search with these terms:
- "democracy", "vdem", "regime type" → DemocracyPanel
- "political risk", "gem risk", "country risk" → GEM Risk Panel
- "governance", "polity" → Country Deep-Dive governance section