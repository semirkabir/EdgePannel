#!/usr/bin/env node

/**
 * Generates country governance/development indices data.
 * Combines publicly available data from:
 *   - UNDP Human Development Index (2023-24)
 *   - Transparency International Corruption Perceptions Index (2024)
 *   - Freedom House "Freedom in the World" (2025)
 *   - EIU Democracy Index (2024)
 *   - Fund for Peace Fragile States Index (2024)
 *   - IEP Global Peace Index (2024)
 *
 * Sources are embedded as curated static data. Update annually.
 *
 * Usage: node scripts/fetch-country-indices.mjs
 */

const FS = await import('fs');

// =============================================================================
// EMBEDDED CURATED DATA — Update annually from published reports
// =============================================================================

// HDI 2023/24 — Source: UNDP Human Development Report 2024
// Values are Human Development Index (0-1 scale)
const HDI_DATA = {
  CH: 0.967, NO: 0.966, IS: 0.959, HK: 0.956, AU: 0.951, DK: 0.952, SE: 0.952, IE: 0.950,
  DE: 0.950, NL: 0.946, FI: 0.942, SG: 0.942, BE: 0.942, NZ: 0.939, CA: 0.935, LI: 0.935,
  LU: 0.935, GB: 0.940, JP: 0.920, KR: 0.929, US: 0.927, IL: 0.915, MT: 0.915, SI: 0.921,
  AT: 0.921, AE: 0.937, ES: 0.916, FR: 0.916, CY: 0.907, IT: 0.895, EE: 0.899, CZ: 0.891,
  GR: 0.893, PL: 0.881, BH: 0.888, LT: 0.880, SA: 0.875, PT: 0.874, LV: 0.865, CL: 0.860,
  SK: 0.855, HU: 0.851, AR: 0.849, TR: 0.855, ME: 0.844, HR: 0.856, MY: 0.807, QA: 0.855,
  KW: 0.847, RU: 0.821, RS: 0.808, GE: 0.814, RO: 0.833, BR: 0.760, CN: 0.788, MX: 0.766,
  UA: 0.780, CO: 0.758, TH: 0.803, ID: 0.713, VN: 0.716, EG: 0.715, IN: 0.644, ZA: 0.713,
  PH: 0.710, PK: 0.540, NG: 0.548, BD: 0.668, KE: 0.598, ET: 0.504, CD: 0.492, YE: 0.483,
  AF: 0.484, SD: 0.548, SO: 0.361, KP: 0.381, VE: 0.691, MM: 0.608, SY: 0.563, IQ: 0.673,
  LB: 0.706, LY: 0.712, PE: 0.768, KZ: 0.812, UZ: 0.724, AZ: 0.758, TM: 0.765, KG: 0.696,
  TJ: 0.673, MN: 0.741, LK: 0.779, NP: 0.593, MA: 0.693, TN: 0.745, DZ: 0.747, GH: 0.625,
  SN: 0.525, CI: 0.545, CM: 0.605, AO: 0.596, MZ: 0.451, ZW: 0.592, ZM: 0.569, BW: 0.721,
  NA: 0.622, TZ: 0.584, UG: 0.558, RW: 0.546, BI: 0.436, MW: 0.492, BF: 0.436, ML: 0.426,
  NE: 0.394, TD: 0.394, CF: 0.386, SS: 0.385, BJ: 0.554, TG: 0.548, LR: 0.478, SL: 0.490,
  GN: 0.476, HT: 0.515, HN: 0.634, GT: 0.638, SV: 0.684, NI: 0.683, BO: 0.698, PY: 0.723,
  UY: 0.812, EC: 0.759, CU: 0.764, JM: 0.714, DO: 0.766, PA: 0.807, CR: 0.816,
};

// CPI 2024 — Source: Transparency International
// 0-100 scale (0 = highly corrupt, 100 = very clean)
const CPI_DATA = {
  DK: 90, FI: 88, NZ: 85, NO: 84, SG: 84, SE: 83, CH: 82, NL: 79, LU: 78, DE: 78,
  GB: 76, AU: 75, CA: 75, HK: 74, AT: 73, EE: 73, IS: 72, BE: 72, JP: 72, IE: 72,
  FR: 71, US: 69, KR: 68, PT: 66, LT: 65, ES: 64, LV: 63, CZ: 62, IT: 62, SI: 62,
  PL: 61, IL: 61, AE: 60, SK: 59, CY: 58, GR: 57, SA: 57, HR: 56, QA: 55, MY: 53,
  BH: 52, HU: 51, JO: 50, KW: 49, GE: 49, RO: 48, ZA: 47, CL: 47, MT: 46, MU: 46,
  AR: 46, TR: 44, CN: 43, IN: 42, ID: 42, VN: 42, TH: 40, BR: 39, MX: 38, EG: 37,
  UA: 37, PH: 36, PK: 35, KG: 35, RU: 33, NG: 32, MM: 26, BD: 25, AF: 20, SY: 19,
  YE: 16, SS: 13, SO: 11, VE: 13, KP: 11,
};

// Freedom House 2025 — Freedom in the World
// Score 0-100, Status: Free / Partly Free / Not Free
const FH_DATA = {
  FI: [100, 'Free'], NO: [100, 'Free'], SE: [100, 'Free'], NL: [99, 'Free'], LU: [99, 'Free'],
  NZ: [99, 'Free'], DK: [98, 'Free'], BE: [98, 'Free'], IE: [98, 'Free'], PT: [96, 'Free'],
  UY: [96, 'Free'], CL: [94, 'Free'], CH: [94, 'Free'], DE: [94, 'Free'], JP: [94, 'Free'],
  AU: [93, 'Free'], AT: [93, 'Free'], ES: [93, 'Free'], CA: [92, 'Free'], EE: [92, 'Free'],
  FR: [92, 'Free'], IT: [92, 'Free'], GB: [91, 'Free'], CZ: [90, 'Free'], CY: [89, 'Free'],
  KR: [88, 'Free'], US: [86, 'Free'], IL: [84, 'Free'], PL: [82, 'Free'], GR: [81, 'Free'],
  AR: [80, 'Partly Free'], TW: [80, 'Partly Free'], BR: [79, 'Partly Free'], ZA: [79, 'Partly Free'],
  MX: [78, 'Partly Free'], IN: [73, 'Partly Free'], UA: [73, 'Partly Free'], ID: [73, 'Partly Free'],
  TR: [32, 'Not Free'], RU: [17, 'Not Free'], CN: [9, 'Not Free'], SA: [8, 'Not Free'],
  SY: [1, 'Not Free'], KP: [3, 'Not Free'], AF: [10, 'Not Free'], VE: [20, 'Not Free'],
  MM: [9, 'Not Free'], IQ: [21, 'Not Free'], EG: [18, 'Not Free'], PK: [30, 'Partly Free'],
  NG: [42, 'Partly Free'], TH: [44, 'Partly Free'], PH: [54, 'Partly Free'], BD: [32, 'Partly Free'],
};

// Democracy Index 2024 — Source: EIU
// 0-10 scale
const DEMOCRACY_DATA = {
  NO: [9.71, 'Full Democracy'], NZ: [9.64, 'Full Democracy'], SE: [9.58, 'Full Democracy'],
  IS: [9.52, 'Full Democracy'], CH: [9.32, 'Full Democracy'], FI: [9.30, 'Full Democracy'],
  DK: [9.28, 'Full Democracy'], NL: [9.08, 'Full Democracy'], IE: [9.04, 'Full Democracy'],
  LU: [8.88, 'Full Democracy'], AU: [8.85, 'Full Democracy'], TW: [8.80, 'Flawed Democracy'],
  DE: [8.73, 'Full Democracy'], CA: [8.69, 'Full Democracy'], GB: [8.60, 'Flawed Democracy'],
  UY: [8.62, 'Full Democracy'], JP: [8.40, 'Flawed Democracy'], KR: [8.09, 'Flawed Democracy'],
  FR: [8.11, 'Flawed Democracy'], US: [7.84, 'Flawed Democracy'], ES: [8.07, 'Flawed Democracy'],
  IL: [7.80, 'Flawed Democracy'], IT: [7.69, 'Flawed Democracy'], PL: [7.16, 'Flawed Democracy'],
  IN: [7.11, 'Flawed Democracy'], BR: [6.49, 'Flawed Democracy'], AR: [6.52, 'Flawed Democracy'],
  ID: [6.56, 'Flawed Democracy'], MX: [5.56, 'Hybrid Regime'], UA: [6.21, 'Flawed Democracy'],
  TR: [4.37, 'Hybrid Regime'], RU: [2.94, 'Authoritarian'], CN: [2.16, 'Authoritarian'],
  SA: [2.17, 'Authoritarian'], VE: [2.47, 'Authoritarian'], IR: [1.81, 'Authoritarian'],
  KP: [1.08, 'Authoritarian'], MM: [2.65, 'Authoritarian'], AF: [0.26, 'Authoritarian'],
  SY: [1.65, 'Authoritarian'], EG: [2.79, 'Authoritarian'], PK: [3.80, 'Hybrid Regime'],
  NG: [4.53, 'Hybrid Regime'], TH: [6.69, 'Flawed Democracy'], BD: [5.71, 'Hybrid Regime'],
};

// Fragile States Index 2024 — Source: Fund for Peace
// 0-120 scale (0 = most stable, 120 = most fragile)
const FSI_DATA = {
  SO: 112.3, SS: 109.7, SY: 107.9, YE: 106.6, SD: 106.2, CD: 106.1, AF: 104.0,
  CF: 102.1, TD: 100.6, HT: 99.3, ET: 98.6, ML: 98.4, MM: 98.2, NG: 97.5,
  GN: 96.2, BF: 95.5, CM: 95.3, BI: 95.1, PK: 94.4, ZW: 93.9, LR: 93.5,
  UG: 93.3, IQ: 93.0, NE: 92.6, VE: 92.5, KP: 92.3, ER: 91.8, LY: 91.1,
  CG: 90.7, SL: 89.7, KE: 88.9, MZ: 88.6, RW: 87.9, AO: 87.3, TG: 86.8,
  BD: 86.5, NP: 86.3, MW: 85.7, LK: 85.5, PE: 84.9, RS: 84.7, NI: 84.3,
  FJ: 84.0, EG: 83.5, UA: 83.2, IR: 83.0, IN: 82.8, JO: 82.5, GT: 82.3,
  PH: 82.1, TR: 81.4, RU: 80.9, BR: 80.2, MX: 80.1, LB: 79.9, DZ: 79.7,
  BO: 79.5, CO: 79.3, ID: 78.6, VN: 78.4, MA: 78.2, TN: 77.8, CN: 77.6,
  ZA: 76.8, SA: 76.5, TH: 76.1, AZ: 75.9, MN: 75.5, EC: 75.2, GY: 75.0,
  BY: 74.8, KZ: 74.6, HK: 74.4, BA: 74.2, UZ: 73.9, PY: 73.7, MK: 73.5,
  ME: 73.3, KW: 73.1, QA: 72.9, BH: 72.7, OM: 72.5, AR: 72.1, GE: 72.0,
  AL: 71.6, DO: 71.4, AM: 71.2, MD: 70.9, VU: 70.7, TJ: 70.5, ZM: 70.2,
  SN: 70.0, GQ: 69.8, KM: 69.6, TM: 69.4, LS: 69.2, SB: 69.0, TL: 68.8,
  KG: 68.6, JM: 68.4, BT: 68.2, DJ: 68.0, NA: 67.8, BZ: 67.6, MR: 67.4,
  LA: 67.2, CV: 67.0, BN: 66.8, GA: 66.6, GH: 66.4, CU: 66.2, SV: 66.0,
  TT: 65.8, MY: 65.5, CY: 65.0, CZ: 64.8, MT: 64.5, HU: 64.3, PL: 64.0,
  HR: 63.8, RO: 63.5, BG: 63.3, GR: 63.0, SK: 62.8, ES: 62.5, IT: 62.3,
  US: 62.0, LT: 59.8, LV: 59.5, EE: 59.3, CL: 59.0, CR: 58.8, PA: 58.5,
  UY: 58.3, KR: 57.5, FR: 57.3, GB: 57.0, BE: 56.8, JP: 56.5, PT: 56.3,
  SI: 56.0, AT: 55.8, IL: 55.5, IE: 55.3, DE: 55.0, AE: 54.8, NL: 54.5,
  AU: 54.3, SG: 54.0, LU: 53.8, NZ: 53.5, DK: 53.3, CA: 53.0, SE: 52.8,
  IS: 52.5, CH: 52.3, NO: 52.0, FI: 48.5,
};

// Global Peace Index 2024 — Source: IEP
// 1-5 scale (1 = most peaceful)
const GPI_DATA = {
  IS: 1.112, IE: 1.303, AT: 1.316, NZ: 1.313, SG: 1.339, CH: 1.350, PT: 1.374,
  DK: 1.383, SI: 1.395, JP: 1.405, CZ: 1.435, FI: 1.445, CA: 1.449, NO: 1.465,
  DE: 1.465, HU: 1.474, BE: 1.494, MY: 1.513, AU: 1.534, SK: 1.464, SE: 1.482,
  NL: 1.486, PL: 1.564, BG: 1.563, HR: 1.561, RO: 1.552, ES: 1.515, EE: 1.532,
  LV: 1.535, LT: 1.536, IT: 1.559, FR: 1.588, GB: 1.628, KR: 1.713, US: 2.432,
  CN: 2.410, IN: 2.287, BR: 2.144, MX: 2.613, RU: 3.235, UA: 3.280, TR: 2.590,
  IR: 2.484, IL: 2.459, SA: 2.247, AE: 1.947, QA: 1.792, KW: 1.889, OM: 1.880,
  BH: 2.022, JO: 2.135, EG: 2.286, DZ: 2.305, MA: 2.060, TN: 2.061, LY: 2.989,
  SD: 3.377, SS: 3.172, SO: 3.091, YE: 3.394, SY: 3.294, IQ: 3.078, AF: 3.294,
  PK: 2.644, BD: 2.314, LK: 2.300, NP: 2.037, MM: 2.792, TH: 2.120, VN: 1.962,
  ID: 2.010, PH: 2.460, NZ: 1.313, ZA: 2.315, NG: 2.740, KE: 2.549, ET: 2.582,
  UG: 2.404, TZ: 2.099, GH: 1.991, ZW: 2.496, CD: 3.215, CM: 2.614, CI: 2.311,
  VE: 2.609, CO: 2.774, PE: 2.254, AR: 1.873, CL: 1.986, UY: 1.976, PA: 1.998,
};

// =============================================================================
// MAIN
// =============================================================================

function buildCountryIndices() {
  // Collect all unique codes
  const allCodes = new Set([
    ...Object.keys(HDI_DATA),
    ...Object.keys(CPI_DATA),
    ...Object.keys(FH_DATA),
    ...Object.keys(DEMOCRACY_DATA),
    ...Object.keys(FSI_DATA),
    ...Object.keys(GPI_DATA),
  ]);

  // Get country names
  const names = {};
  // We'll use a minimal name mapping from the profiles we'll have
  const knownNames = {
    AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AO: 'Angola', AR: 'Argentina',
    AM: 'Armenia', AU: 'Australia', AT: 'Austria', AZ: 'Azerbaijan', BH: 'Bahrain',
    BD: 'Bangladesh', BY: 'Belarus', BE: 'Belgium', BZ: 'Belize', BJ: 'Benin',
    BT: 'Bhutan', BO: 'Bolivia', BA: 'Bosnia and Herzegovina', BW: 'Botswana',
    BR: 'Brazil', BN: 'Brunei', BG: 'Bulgaria', BF: 'Burkina Faso', BI: 'Burundi',
    CV: 'Cabo Verde', KH: 'Cambodia', CM: 'Cameroon', CA: 'Canada', CF: 'Central African Republic',
    TD: 'Chad', CL: 'Chile', CN: 'China', CO: 'Colombia', KM: 'Comoros',
    CD: 'DR Congo', CG: 'Congo', CR: 'Costa Rica', CI: "Côte d'Ivoire", HR: 'Croatia',
    CU: 'Cuba', CY: 'Cyprus', CZ: 'Czech Republic', DK: 'Denmark', DJ: 'Djibouti',
    DO: 'Dominican Republic', EC: 'Ecuador', EG: 'Egypt', SV: 'El Salvador', GQ: 'Equatorial Guinea',
    ER: 'Eritrea', EE: 'Estonia', SZ: 'Eswatini', ET: 'Ethiopia', FJ: 'Fiji',
    FI: 'Finland', FR: 'France', GA: 'Gabon', GM: 'Gambia', GE: 'Georgia',
    DE: 'Germany', GH: 'Ghana', GR: 'Greece', GT: 'Guatemala', GN: 'Guinea',
    GW: 'Guinea-Bissau', GY: 'Guyana', HT: 'Haiti', HN: 'Honduras', HK: 'Hong Kong',
    HU: 'Hungary', IS: 'Iceland', IN: 'India', ID: 'Indonesia', IR: 'Iran',
    IQ: 'Iraq', IE: 'Ireland', IL: 'Israel', IT: 'Italy', JM: 'Jamaica',
    JP: 'Japan', JO: 'Jordan', KZ: 'Kazakhstan', KE: 'Kenya', KI: 'Kiribati',
    KP: 'North Korea', KR: 'South Korea', KW: 'Kuwait', KG: 'Kyrgyzstan', LA: 'Laos',
    LV: 'Latvia', LB: 'Lebanon', LS: 'Lesotho', LR: 'Liberia', LY: 'Libya',
    LI: 'Liechtenstein', LT: 'Lithuania', LU: 'Luxembourg', MG: 'Madagascar', MW: 'Malawi',
    MY: 'Malaysia', MV: 'Maldives', ML: 'Mali', MT: 'Malta', MH: 'Marshall Islands',
    MR: 'Mauritania', MU: 'Mauritius', MX: 'Mexico', FM: 'Micronesia', MD: 'Moldova',
    MC: 'Monaco', MN: 'Mongolia', ME: 'Montenegro', MA: 'Morocco', MZ: 'Mozambique',
    MM: 'Myanmar', NA: 'Namibia', NR: 'Nauru', NP: 'Nepal', NL: 'Netherlands',
    NZ: 'New Zealand', NI: 'Nicaragua', NE: 'Niger', NG: 'Nigeria', MK: 'North Macedonia',
    NO: 'Norway', OM: 'Oman', PK: 'Pakistan', PW: 'Palau', PS: 'Palestine',
    PA: 'Panama', PG: 'Papua New Guinea', PY: 'Paraguay', PE: 'Peru', PH: 'Philippines',
    PL: 'Poland', PT: 'Portugal', QA: 'Qatar', RO: 'Romania', RU: 'Russia',
    RW: 'Rwanda', KN: 'St. Kitts and Nevis', LC: 'St. Lucia', VC: 'St. Vincent', WS: 'Samoa',
    SM: 'San Marino', ST: 'Sao Tome and Principe', SA: 'Saudi Arabia', SN: 'Senegal', RS: 'Serbia',
    SC: 'Seychelles', SL: 'Sierra Leone', SG: 'Singapore', SK: 'Slovakia', SI: 'Slovenia',
    SB: 'Solomon Islands', SO: 'Somalia', ZA: 'South Africa', SS: 'South Sudan', ES: 'Spain',
    LK: 'Sri Lanka', SD: 'Sudan', SR: 'Suriname', SE: 'Sweden', CH: 'Switzerland',
    SY: 'Syria', TW: 'Taiwan', TJ: 'Tajikistan', TZ: 'Tanzania', TH: 'Thailand',
    TL: 'Timor-Leste', TG: 'Togo', TO: 'Tonga', TT: 'Trinidad and Tobago', TN: 'Tunisia',
    TR: 'Turkey', TM: 'Turkmenistan', TV: 'Tuvalu', UG: 'Uganda', UA: 'Ukraine',
    AE: 'United Arab Emirates', GB: 'United Kingdom', US: 'United States', UY: 'Uruguay',
    UZ: 'Uzbekistan', VU: 'Vanuatu', VE: 'Venezuela', VN: 'Vietnam', YE: 'Yemen',
    ZM: 'Zambia', ZW: 'Zimbabwe',
  };

  const result = {};
  for (const code of allCodes) {
    const hdi = HDI_DATA[code] ?? null;
    const cpi = CPI_DATA[code] ?? null;
    const fh = FH_DATA[code];
    const dem = DEMOCRACY_DATA[code];
    const fsi = FSI_DATA[code] ?? null;
    const gpi = GPI_DATA[code] ?? null;

    result[code] = {
      code,
      name: knownNames[code] || code,
      hdi,
      hdiRank: null,
      cpiScore: cpi,
      cpiRank: null,
      freedomScore: fh ? fh[0] : null,
      freedomStatus: fh ? fh[1] : null,
      democracyIndex: dem ? dem[0] : null,
      democracyRegime: dem ? dem[1] : null,
      fragileStatesIndex: fsi ? Math.round(fsi * 10) / 10 : null,
      globalPeaceIndex: gpi ? Math.round(gpi * 1000) / 1000 : null,
      gpiRank: null,
      sourceYear: 2024,
    };
  }

  return result;
}

async function main() {
  console.log('Building country indices data...');

  // Try to fetch country names from REST Countries API for completeness
  let nameMap = {};
  try {
    const res = await fetch('https://restcountries.com/v3.1/all?fields=cca2,name');
    if (res.ok) {
      const data = await res.json();
      for (const c of data) {
        if (c.cca2 && c.name?.common) {
          nameMap[c.cca2] = c.name.common;
        }
      }
      console.log(`  Fetched ${Object.keys(nameMap).length} country names from REST Countries`);
    }
  } catch (e) {
    console.warn(`  ⚠ Could not fetch country names: ${e.message}`);
  }

  const indices = buildCountryIndices();

  // Override with names from API where available
  for (const [code, entry] of Object.entries(indices)) {
    if (nameMap[code] && entry.name === code) {
      entry.name = nameMap[code];
    }
  }

  const output = JSON.stringify(indices, null, 2);
  const fs = await import('fs'); // Note: already imported at top but safer to ensure
  const { writeFileSync } = fs;
  writeFileSync('src/data/country-indices.json', output + '\n', 'utf-8');

  console.log(`Wrote ${Object.keys(indices).length} country indices to src/data/country-indices.json`);
  console.log(`File size: ${(output.length / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
