/**
 * Per-tab renderers for the CIA World Factbook tabs on the country brief panel.
 * Each `renderX(data)` returns the full pane contents for a single tab.
 *
 * Design intent: every tab groups fields into 2-5 sub-cards using layouts that
 * fit the data shape (tiles for single numbers, stacked/labeled bars for
 * percentages, chips for categorical lists, callouts for hazards/disputes).
 */

import type { FactbookData } from '@/services/factbook';
import {
  extractPercent,
  fbObj,
  fbText,
  latestYearEntry,
  parseLabeledPercents,
  splitList,
  stripYearTag,
  takeValue,
  extractYear,
} from '@/services/factbook';
import {
  PALETTE,
  calloutCard,
  chipRow,
  collapsible,
  combine,
  el,
  emptyMessage,
  labeledBars,
  personCard,
  prose,
  sectionCard,
  stackedBar,
  statTile,
  stripNoteHtml,
  tileGrid,
} from './widgets';

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
  const body = dispatch(tab, data);
  if (!body || body.childElementCount === 0) {
    wrap.append(emptyMessage('Not available for this country.'));
    return wrap;
  }
  wrap.append(body);
  return wrap;
}

function dispatch(tab: TabId, data: FactbookData): HTMLElement | null {
  switch (tab) {
    case 'geography': return renderGeography(data);
    case 'people': return renderPeople(data);
    case 'government': return renderGovernment(data);
    case 'economy': return renderEconomy(data);
    case 'energy': return renderEnergy(data);
    case 'communications': return renderCommunications(data);
    case 'transportation': return renderTransportation(data);
    case 'military': return renderMilitary(data);
    case 'transnational': return renderTransnational(data);
    default: return null;
  }
}

// ─── Geography ────────────────────────────────────────────────────────────────

function renderGeography(data: FactbookData): HTMLElement | null {
  const sec = data.Geography;
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  // Location + coordinates
  const loc = fbText(sec, 'Location');
  const coords = fbText(sec, 'Geographic coordinates');
  if (loc || coords) {
    const body = el('div', 'cdp-fb-stack-v');
    if (loc) body.append(prose(loc)!);
    if (coords) body.append(el('div', 'cdp-fb-coords', `📍 ${coords}`));
    const card = sectionCard('Location', body);
    if (card) stack.append(card);
  }

  // At a glance
  const tiles: Array<HTMLElement | null> = [
    statTile('Total area', takeValue(fbText(sec, 'Area', 'total'))),
    statTile('Land', takeValue(fbText(sec, 'Area', 'land'))),
    statTile('Water', takeValue(fbText(sec, 'Area', 'water'))),
    statTile('Coastline', takeValue(fbText(sec, 'Coastline'))),
  ].filter((t) => t && (t.querySelector('.cdp-fb-tile-value')?.textContent ?? '—') !== '—');
  const glance = tiles.length > 0 ? sectionCard('At a glance', tileGrid(2, tiles)) : null;
  if (glance) stack.append(glance);

  // Comparative
  const comp = fbText(sec, 'Area - comparative');
  if (comp) {
    const card = sectionCard('Size comparison', prose(comp));
    if (card) stack.append(card);
  }

  // Elevation
  const elev: Array<HTMLElement | null> = [
    statTile('Highest point', takeValue(fbText(sec, 'Elevation', 'highest point'))),
    statTile('Lowest point', takeValue(fbText(sec, 'Elevation', 'lowest point'))),
    statTile('Mean elevation', takeValue(fbText(sec, 'Elevation', 'mean elevation'))),
  ].filter((t) => t && (t.querySelector('.cdp-fb-tile-value')?.textContent ?? '—') !== '—');
  if (elev.length > 0) {
    const card = sectionCard('Elevation', tileGrid(3, elev));
    if (card) stack.append(card);
  }

  // Climate + Terrain
  const climate = fbText(sec, 'Climate');
  const terrain = fbText(sec, 'Terrain');
  if (climate || terrain) {
    const body = el('div', 'cdp-fb-stack-v');
    if (climate) {
      body.append(el('div', 'cdp-fb-subhead', 'Climate'));
      body.append(prose(climate)!);
    }
    if (terrain) {
      body.append(el('div', 'cdp-fb-subhead', 'Terrain'));
      body.append(prose(terrain)!);
    }
    const card = sectionCard('Climate & terrain', body);
    if (card) stack.append(card);
  }

  // Natural resources
  const resources = splitList(fbText(sec, 'Natural resources'));
  if (resources.length > 0) {
    const card = sectionCard('Natural resources', chipRow(resources));
    if (card) stack.append(card);
  }

  // Natural hazards
  const hazards = fbText(sec, 'Natural hazards');
  if (hazards) {
    stack.append(calloutCard('Natural hazards', hazards, 'warn'));
  }

  return stack.childElementCount > 0 ? stack : null;
}

// ─── People & Society ─────────────────────────────────────────────────────────

function renderPeople(data: FactbookData): HTMLElement | null {
  const sec = data['People and Society'];
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  // Population hero
  const pop = fbText(sec, 'Population', 'total') ?? fbText(sec, 'Population');
  const growth = fbText(sec, 'Population growth rate');
  if (pop) {
    const hero = el('div', 'cdp-fb-hero');
    hero.append(
      el('div', 'cdp-fb-hero-value', takeValue(pop)),
      el('div', 'cdp-fb-hero-label', 'Total population'),
    );
    if (growth) {
      hero.append(el('div', 'cdp-fb-hero-meta', `Growth: ${growth}`));
    }
    const card = sectionCard('Population', hero);
    if (card) stack.append(card);
  }

  // Age structure
  const ageYoung = extractPercent(fbText(sec, 'Age structure', '0-14 years'));
  const ageMid = extractPercent(fbText(sec, 'Age structure', '15-64 years'));
  const ageOld = extractPercent(fbText(sec, 'Age structure', '65 years and over'));
  const median = takeValue(fbText(sec, 'Median age', 'total'));
  if (Number.isFinite(ageYoung) || Number.isFinite(ageMid) || Number.isFinite(ageOld) || median) {
    const body = el('div', 'cdp-fb-stack-v');
    if (Number.isFinite(ageYoung) && Number.isFinite(ageMid) && Number.isFinite(ageOld)) {
      body.append(
        stackedBar([
          { label: '0–14', pct: ageYoung, color: PALETTE.youth },
          { label: '15–64', pct: ageMid, color: PALETTE.working },
          { label: '65+', pct: ageOld, color: PALETTE.elder },
        ]),
      );
    }
    if (median) {
      body.append(tileGrid(2, [statTile('Median age', median)]));
    }
    const card = sectionCard('Age structure', body);
    if (card) stack.append(card);
  }

  // Languages
  const langs = parseLabeledPercents(fbText(sec, 'Languages'));
  if (langs.length > 0) {
    const card = sectionCard('Languages', labeledBars(langs));
    if (card) stack.append(card);
  }

  // Religions
  const rels = parseLabeledPercents(fbText(sec, 'Religions'));
  if (rels.length > 0) {
    const card = sectionCard('Religions', labeledBars(rels));
    if (card) stack.append(card);
  }

  // Vitals
  const vitals: Array<HTMLElement | null> = [
    statTile('Life expectancy', takeValue(fbText(sec, 'Life expectancy at birth', 'total population'))),
    statTile('Urbanization', takeValue(fbText(sec, 'Urbanization', 'urban population'))),
    statTile('Birth rate', takeValue(fbText(sec, 'Birth rate'))),
  ].filter((t) => t && (t.querySelector('.cdp-fb-tile-value')?.textContent ?? '—') !== '—');
  if (vitals.length > 0) {
    const card = sectionCard('Vitals', tileGrid(3, vitals));
    if (card) stack.append(card);
  }

  // Health & education
  const health: Array<HTMLElement | null> = [
    statTile('Physician density', takeValue(fbText(sec, 'Physician density'))),
    statTile('Hospital beds', takeValue(fbText(sec, 'Hospital bed density'))),
    statTile('Maternal mortality', takeValue(fbText(sec, 'Maternal mortality ratio'))),
    statTile(
      'School life expectancy',
      takeValue(fbText(sec, 'School life expectancy (primary to tertiary education)', 'total')),
    ),
  ].filter((t) => t && (t.querySelector('.cdp-fb-tile-value')?.textContent ?? '—') !== '—');
  if (health.length > 0) {
    const card = sectionCard('Health & education', tileGrid(2, health));
    if (card) stack.append(card);
  }

  // Ethnic groups (collapsible, since often long)
  const ethnic = fbText(sec, 'Ethnic groups');
  if (ethnic) {
    const body = prose(ethnic) ?? el('div');
    stack.append(collapsible('Ethnic groups', body));
  }

  return stack.childElementCount > 0 ? stack : null;
}

// ─── Government ───────────────────────────────────────────────────────────────

function renderGovernment(data: FactbookData): HTMLElement | null {
  const sec = data.Government;
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  // Leadership
  const chief = fbText(sec, 'Executive branch', 'chief of state');
  const head = fbText(sec, 'Executive branch', 'head of government');
  if (chief || head) {
    const row = el('div', 'cdp-fb-grid cdp-fb-grid-2');
    row.append(personCard('Chief of state', chief));
    row.append(personCard('Head of government', head));
    const card = sectionCard('Leadership', row);
    if (card) stack.append(card);
  }

  // Structure
  const govType = fbText(sec, 'Government type');
  const legal = fbText(sec, 'Legal system');
  if (govType || legal) {
    const body = el('div', 'cdp-fb-stack-v');
    if (govType) {
      body.append(el('div', 'cdp-fb-subhead', 'Government type'));
      body.append(prose(govType)!);
    }
    if (legal) {
      body.append(el('div', 'cdp-fb-subhead', 'Legal system'));
      body.append(prose(legal)!);
    }
    const card = sectionCard('Structure', body);
    if (card) stack.append(card);
  }

  // Capital
  const capName = fbText(sec, 'Capital', 'name');
  const capCoords = fbText(sec, 'Capital', 'geographic coordinates');
  const capTz = fbText(sec, 'Capital', 'time difference');
  if (capName) {
    const body = el('div', 'cdp-fb-stack-v');
    body.append(el('div', 'cdp-fb-hero-value', capName));
    const meta: string[] = [];
    if (capCoords) meta.push(`📍 ${capCoords}`);
    if (capTz) meta.push(`🕐 ${capTz}`);
    if (meta.length > 0) body.append(el('div', 'cdp-fb-hero-meta', meta.join('   ')));
    const card = sectionCard('Capital', body);
    if (card) stack.append(card);
  }

  // Independence
  const indep = fbText(sec, 'Independence');
  const holiday = fbText(sec, 'National holiday');
  if (indep || holiday) {
    const body = el('div', 'cdp-fb-stack-v');
    if (indep) {
      body.append(el('div', 'cdp-fb-subhead', 'Independence'));
      body.append(prose(indep)!);
    }
    if (holiday) {
      body.append(el('div', 'cdp-fb-subhead', 'National holiday'));
      body.append(prose(holiday)!);
    }
    const card = sectionCard('History', body);
    if (card) stack.append(card);
  }

  // Constitution (collapsed)
  const consHist = fbText(sec, 'Constitution', 'history');
  if (consHist) {
    stack.append(collapsible('Constitution', prose(consHist) ?? el('div')));
  }

  // Administrative divisions (collapsed, with chips when comma-separated)
  const admin = fbText(sec, 'Administrative divisions');
  if (admin) {
    const chips = splitList(admin);
    const body = chips.length > 2 ? chipRow(chips) : prose(admin) ?? el('div');
    stack.append(collapsible('Administrative divisions', body));
  }

  return stack.childElementCount > 0 ? stack : null;
}

// ─── Economy ──────────────────────────────────────────────────────────────────

function renderEconomy(data: FactbookData): HTMLElement | null {
  const sec = data.Economy;
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  // Headline
  const gdp = latestYearEntry(fbObj(sec, 'Real GDP (purchasing power parity)'), 'Real GDP (purchasing power parity)');
  const gdpPc = latestYearEntry(fbObj(sec, 'Real GDP per capita'), 'Real GDP per capita');
  const growth = latestYearEntry(fbObj(sec, 'Real GDP growth rate'), 'Real GDP growth rate');
  const headline: Array<HTMLElement | null> = [
    gdp.text ? statTile('GDP (PPP)', takeValue(gdp.text), { year: gdp.year }) : null,
    gdpPc.text ? statTile('GDP per capita', takeValue(gdpPc.text), { year: gdpPc.year }) : null,
    growth.text ? statTile('Real GDP growth', takeValue(growth.text), { year: growth.year }) : null,
  ];
  if (headline.some(Boolean)) {
    const card = sectionCard('Headline', tileGrid(3, headline));
    if (card) stack.append(card);
  }

  // GDP composition
  const ag = extractPercent(fbText(sec, 'GDP - composition, by sector of origin', 'agriculture'));
  const ind = extractPercent(fbText(sec, 'GDP - composition, by sector of origin', 'industry'));
  const svc = extractPercent(fbText(sec, 'GDP - composition, by sector of origin', 'services'));
  if (Number.isFinite(ag) && Number.isFinite(ind) && Number.isFinite(svc)) {
    const card = sectionCard(
      'GDP composition by sector',
      stackedBar([
        { label: 'Agriculture', pct: ag, color: PALETTE.agriculture },
        { label: 'Industry', pct: ind, color: PALETTE.industry },
        { label: 'Services', pct: svc, color: PALETTE.services },
      ]),
    );
    if (card) stack.append(card);
  }

  // Fiscal
  const infl = latestYearEntry(fbObj(sec, 'Inflation rate (consumer prices)'), 'Inflation rate (consumer prices)');
  const unemp = latestYearEntry(fbObj(sec, 'Unemployment rate'), 'Unemployment rate');
  const debt = latestYearEntry(fbObj(sec, 'Public debt'), 'Public debt');
  const fiscal: Array<HTMLElement | null> = [
    infl.text ? statTile('Inflation', takeValue(infl.text), { year: infl.year }) : null,
    unemp.text ? statTile('Unemployment', takeValue(unemp.text), { year: unemp.year }) : null,
    debt.text ? statTile('Public debt', takeValue(debt.text), { year: debt.year }) : null,
  ];
  if (fiscal.some(Boolean)) {
    const card = sectionCard('Fiscal', tileGrid(3, fiscal));
    if (card) stack.append(card);
  }

  // Trade
  const expVal = latestYearEntry(fbObj(sec, 'Exports'), 'Exports');
  const impVal = latestYearEntry(fbObj(sec, 'Imports'), 'Imports');
  const expPart = splitList(fbText(sec, 'Exports - partners'));
  const impPart = splitList(fbText(sec, 'Imports - partners'));
  const expCom = splitList(fbText(sec, 'Exports - commodities'));
  const impCom = splitList(fbText(sec, 'Imports - commodities'));
  const hasTrade = expVal.text || impVal.text || expPart.length || impPart.length;
  if (hasTrade) {
    const row = el('div', 'cdp-fb-grid cdp-fb-grid-2');

    const expBody = el('div', 'cdp-fb-stack-v');
    if (expVal.text) {
      expBody.append(el('div', 'cdp-fb-value-big', takeValue(expVal.text)));
      if (expVal.year) expBody.append(el('div', 'cdp-fb-tile-year', expVal.year));
    }
    if (expPart.length > 0) {
      expBody.append(el('div', 'cdp-fb-subhead', 'Partners'));
      expBody.append(chipRow(expPart));
    }
    if (expCom.length > 0) {
      expBody.append(el('div', 'cdp-fb-subhead', 'Commodities'));
      expBody.append(chipRow(expCom.slice(0, 8)));
    }
    const expCard = el('section', 'cdp-card cdp-fb-card');
    expCard.append(el('h3', 'cdp-card-title', 'Exports'));
    const expCardBody = el('div', 'cdp-card-body');
    expCardBody.append(expBody);
    expCard.append(expCardBody);
    row.append(expCard);

    const impBody = el('div', 'cdp-fb-stack-v');
    if (impVal.text) {
      impBody.append(el('div', 'cdp-fb-value-big', takeValue(impVal.text)));
      if (impVal.year) impBody.append(el('div', 'cdp-fb-tile-year', impVal.year));
    }
    if (impPart.length > 0) {
      impBody.append(el('div', 'cdp-fb-subhead', 'Partners'));
      impBody.append(chipRow(impPart));
    }
    if (impCom.length > 0) {
      impBody.append(el('div', 'cdp-fb-subhead', 'Commodities'));
      impBody.append(chipRow(impCom.slice(0, 8)));
    }
    const impCard = el('section', 'cdp-card cdp-fb-card');
    impCard.append(el('h3', 'cdp-card-title', 'Imports'));
    const impCardBody = el('div', 'cdp-card-body');
    impCardBody.append(impBody);
    impCard.append(impCardBody);
    row.append(impCard);

    stack.append(row);
  }

  // Economic overview (collapsed if long)
  const overview = fbText(sec, 'Economic overview');
  if (overview) {
    if (overview.length > 400) {
      stack.append(collapsible('Economic overview', prose(overview) ?? el('div')));
    } else {
      const card = sectionCard('Economic overview', prose(overview));
      if (card) stack.append(card);
    }
  }

  return stack.childElementCount > 0 ? stack : null;
}

// ─── Energy ───────────────────────────────────────────────────────────────────

function renderEnergy(data: FactbookData): HTMLElement | null {
  const sec = data.Energy;
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  // Electricity
  const access = takeValue(fbText(sec, 'Electricity access', 'electrification - total population'));
  const capacity = takeValue(fbText(sec, 'Electricity', 'installed generating capacity'));
  const consumption = takeValue(fbText(sec, 'Electricity', 'consumption'));
  const elecTiles: Array<HTMLElement | null> = [
    access ? statTile('Access to electricity', access) : null,
    capacity ? statTile('Installed capacity', capacity) : null,
    consumption ? statTile('Consumption', consumption) : null,
  ];
  if (elecTiles.some(Boolean)) {
    const card = sectionCard('Electricity', tileGrid(3, elecTiles));
    if (card) stack.append(card);
  }

  // Generation mix
  const sources = fbObj(sec, 'Electricity generation sources');
  if (sources) {
    const keyMap: Array<[string, string]> = [
      ['fossil fuels', PALETTE.fossil],
      ['nuclear', PALETTE.nuclear],
      ['hydroelectricity', PALETTE.hydro],
      ['solar', PALETTE.solar],
      ['wind', PALETTE.wind],
      ['geothermal', PALETTE.geothermal],
      ['biomass and waste', PALETTE.biomass],
      ['tide and wave', PALETTE.other],
    ];
    const segments = keyMap
      .map(([k, color]) => ({
        label: k.replace(/(^|\s)\S/g, (c) => c.toUpperCase()),
        pct: extractPercent(fbText(sources, k)),
        color,
      }))
      .filter((s) => Number.isFinite(s.pct) && s.pct > 0);
    if (segments.length > 0) {
      const card = sectionCard('Generation mix', stackedBar(segments));
      if (card) stack.append(card);
    }
  }

  // Reserves
  const oilReserve = takeValue(fbText(sec, 'Petroleum', 'crude oil estimated reserves'));
  const gasReserve = takeValue(fbText(sec, 'Natural gas', 'proven reserves'));
  if (oilReserve || gasReserve) {
    const card = sectionCard(
      'Reserves',
      tileGrid(2, [
        oilReserve ? statTile('Crude oil', oilReserve) : null,
        gasReserve ? statTile('Natural gas', gasReserve) : null,
      ]),
    );
    if (card) stack.append(card);
  }

  // Production vs consumption
  const oilProd = takeValue(fbText(sec, 'Petroleum', 'total petroleum production'));
  const oilCons = takeValue(fbText(sec, 'Petroleum', 'refined petroleum consumption'));
  const gasProd = takeValue(fbText(sec, 'Natural gas', 'production'));
  const gasCons = takeValue(fbText(sec, 'Natural gas', 'consumption'));
  if (oilProd || oilCons || gasProd || gasCons) {
    const body = el('div', 'cdp-fb-stack-v');
    if (oilProd || oilCons) {
      body.append(el('div', 'cdp-fb-subhead', 'Petroleum'));
      body.append(tileGrid(2, [
        oilProd ? statTile('Production', oilProd) : null,
        oilCons ? statTile('Consumption', oilCons) : null,
      ]));
    }
    if (gasProd || gasCons) {
      body.append(el('div', 'cdp-fb-subhead', 'Natural gas'));
      body.append(tileGrid(2, [
        gasProd ? statTile('Production', gasProd) : null,
        gasCons ? statTile('Consumption', gasCons) : null,
      ]));
    }
    const card = sectionCard('Production vs consumption', body);
    if (card) stack.append(card);
  }

  return stack.childElementCount > 0 ? stack : null;
}

// ─── Communications ───────────────────────────────────────────────────────────

function renderCommunications(data: FactbookData): HTMLElement | null {
  const sec = data.Communications;
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  // Connectivity tiles
  const internet = takeValue(fbText(sec, 'Internet users', 'percent of population'))
    || takeValue(fbText(sec, 'Internet users', 'total'));
  const mobile = takeValue(fbText(sec, 'Telephones - mobile cellular', 'total subscriptions'));
  const broadband = takeValue(fbText(sec, 'Broadband - fixed subscriptions', 'total'))
    || takeValue(fbText(sec, 'Broadband - fixed subscriptions'));
  const fixed = takeValue(fbText(sec, 'Telephones - fixed lines', 'total subscriptions'));

  const tiles: Array<HTMLElement | null> = [
    internet ? statTile('Internet users', internet) : null,
    mobile ? statTile('Mobile subscriptions', mobile) : null,
    broadband ? statTile('Fixed broadband', broadband) : null,
    fixed ? statTile('Fixed lines', fixed) : null,
  ];
  if (tiles.some(Boolean)) {
    const card = sectionCard('Connectivity', tileGrid(2, tiles));
    if (card) stack.append(card);
  }

  // TLD
  const tld = takeValue(fbText(sec, 'Internet country code'));
  if (tld) {
    const card = sectionCard('Country code / TLD', el('div', 'cdp-fb-value-big', tld));
    if (card) stack.append(card);
  }

  // Broadcast media
  const media = fbText(sec, 'Broadcast media');
  if (media) {
    if (media.length > 300) {
      stack.append(collapsible('Broadcast media', prose(media) ?? el('div')));
    } else {
      const card = sectionCard('Broadcast media', prose(media));
      if (card) stack.append(card);
    }
  }

  return stack.childElementCount > 0 ? stack : null;
}

// ─── Transportation ───────────────────────────────────────────────────────────

function renderTransportation(data: FactbookData): HTMLElement | null {
  const sec = data.Transportation;
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  const airports = takeValue(fbText(sec, 'Airports')) || takeValue(fbText(sec, 'Airports', 'total'));
  const heliports = takeValue(fbText(sec, 'Heliports'));
  const railways = takeValue(fbText(sec, 'Railways', 'total'));
  const roadways = takeValue(fbText(sec, 'Roadways', 'total'));
  const waterways = takeValue(fbText(sec, 'Waterways'));
  const pipelines = takeValue(fbText(sec, 'Pipelines'));
  const merchant = takeValue(fbText(sec, 'Merchant marine', 'total'));

  const tiles: Array<HTMLElement | null> = [
    airports ? statTile('✈ Airports', airports) : null,
    railways ? statTile('🚂 Railways', railways) : null,
    roadways ? statTile('🛣 Roadways', roadways) : null,
    waterways ? statTile('🛶 Waterways', waterways) : null,
    pipelines ? statTile('🛢 Pipelines', pipelines) : null,
    merchant ? statTile('🚢 Merchant marine', merchant) : null,
    heliports ? statTile('🚁 Heliports', heliports) : null,
  ];
  if (tiles.some(Boolean)) {
    const card = sectionCard('Infrastructure', tileGrid(3, tiles));
    if (card) stack.append(card);
  }

  // Airports breakdown (collapsed)
  const airportsObj = fbObj(sec, 'Airports');
  if (airportsObj) {
    const rows: string[] = [];
    for (const [k, v] of Object.entries(airportsObj)) {
      if (k === 'total' || typeof v === 'string') continue;
      const t = (v as { text?: string }).text;
      if (t) rows.push(`${k}: ${t}`);
    }
    if (rows.length > 0) {
      const body = el('div', 'cdp-fb-stack-v');
      for (const r of rows) body.append(el('div', 'cdp-fb-kv', r));
      stack.append(collapsible('Airports by runway', body));
    }
  }

  // Ports
  const portsObj = fbObj(sec, 'Ports');
  const keyPorts = splitList(fbText(sec, 'Ports', 'key ports')) || splitList(fbText(sec, 'Ports', 'major ports'));
  const totalPorts = takeValue(fbText(sec, 'Ports', 'total ports'));
  if (totalPorts || keyPorts.length > 0 || portsObj) {
    const body = el('div', 'cdp-fb-stack-v');
    if (totalPorts) body.append(el('div', 'cdp-fb-value-big', totalPorts));
    if (keyPorts.length > 0) {
      body.append(el('div', 'cdp-fb-subhead', 'Major ports'));
      body.append(chipRow(keyPorts.slice(0, 20)));
    }
    const card = sectionCard('Ports', body);
    if (card) stack.append(card);
  }

  return stack.childElementCount > 0 ? stack : null;
}

// ─── Military & Security ──────────────────────────────────────────────────────

function renderMilitary(data: FactbookData): HTMLElement | null {
  const sec = data['Military and Security'];
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  // Spend & size
  const spend = latestYearEntry(fbObj(sec, 'Military expenditures'), 'Military Expenditures');
  const personnel = fbText(sec, 'Military and security service personnel strengths');
  const tiles: Array<HTMLElement | null> = [
    spend.text ? statTile('Military spending', takeValue(spend.text), { year: spend.year }) : null,
    personnel ? statTile('Personnel', takeValue(personnel)) : null,
  ];
  if (tiles.some(Boolean)) {
    const card = sectionCard('Spend & size', tileGrid(2, tiles));
    if (card) stack.append(card);
  }

  // Branches (chip-ify from the forces text)
  const forces = fbText(sec, 'Military and security forces');
  if (forces) {
    // forces text often contains ":" separator — grab the portion with branches
    const parts = forces.split(':');
    const branchText = parts.length > 1 ? parts.slice(1).join(':') : forces;
    const candidates = splitList(branchText.split('(')[0]!)
      .map((s) => s.replace(/^\s*(and|or)\s+/i, '').trim())
      .filter((s) => s.length > 0 && s.length < 90);
    if (candidates.length > 0) {
      const card = sectionCard('Branches', chipRow(candidates.slice(0, 20)));
      if (card) stack.append(card);
    } else {
      const card = sectionCard('Branches', prose(forces));
      if (card) stack.append(card);
    }
  }

  // Service details
  const serviceAge = fbText(sec, 'Military service age and obligation');
  if (serviceAge) {
    stack.append(collapsible('Service age & obligation', prose(serviceAge) ?? el('div')));
  }

  // Deployments
  const deploy = fbText(sec, 'Military deployments');
  if (deploy) {
    const card = sectionCard('Deployments', prose(deploy));
    if (card) stack.append(card);
  }

  // Inventory
  const inv = fbText(sec, 'Military equipment inventories and acquisitions');
  if (inv) {
    stack.append(collapsible('Equipment inventory', prose(inv) ?? el('div')));
  }

  return stack.childElementCount > 0 ? stack : null;
}

// ─── Transnational Issues ─────────────────────────────────────────────────────

function renderTransnational(data: FactbookData): HTMLElement | null {
  const sec = data['Transnational Issues'];
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  // Disputes
  const disputes = fbText(sec, 'Disputes - international');
  if (disputes) {
    stack.append(calloutCard('International disputes', disputes, 'warn'));
  }

  // Refugees & IDPs
  const refugees = takeValue(fbText(sec, 'Refugees and internally displaced persons', 'refugees'));
  const idps = takeValue(fbText(sec, 'Refugees and internally displaced persons', 'IDPs'));
  if (refugees || idps) {
    const card = sectionCard(
      'Refugees & IDPs',
      tileGrid(2, [
        refugees ? statTile('Refugees hosted', refugees) : null,
        idps ? statTile('Internally displaced', idps) : null,
      ]),
    );
    if (card) stack.append(card);
  }

  // Trafficking
  const traf = fbText(sec, 'Trafficking in persons');
  if (traf) {
    stack.append(calloutCard('Trafficking in persons', traf, 'info'));
  }

  // Illicit drugs
  const drugs = fbText(sec, 'Illicit drugs');
  if (drugs) {
    stack.append(calloutCard('Illicit drugs', drugs, 'info'));
  }

  return stack.childElementCount > 0 ? stack : null;
}

// silence unused imports in case a helper becomes dead after a tweak
void extractYear;
void stripYearTag;
void stripNoteHtml;
void combine;
