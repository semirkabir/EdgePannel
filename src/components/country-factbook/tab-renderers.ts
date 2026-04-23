/**
 * All tab rendering functions for the CIA World Factbook tabs.
 * Each `renderX(data)` returns the full pane contents for a single tab.
 */

import type { FactbookData } from '@/services/factbook';
import {
  extractPercent,
  fbObj,
  fbText,
  latestYearEntry,
  parseLabeledPercents,
  takeValue,
} from '@/services/factbook';
import {
  abbreviateStat,
  badgeRow,
  calloutCard,
  chipRow,
  collapsible,
  combine,
  el,
  emptyMessage,
  labeledBars,
  PALETTE,
  personCard,
  prose,
  sectionCard,
  stackedBar,
  statTile,
  tileGrid,
} from './widgets';
import {
  buildAreaComparison,
  buildBenchmarkTile,
  buildDonutChart,
  buildElevationProfile,
  buildFlowBalance,
  buildGauge,
  buildLandWaterSplit,
  buildPopulationPictogram,
  buildPopulationPyramid,
  buildSparklineTile,
  buildTransportChart,
  HEALTH_WORLD_MEDIANS,
  parsePopulationBracket,
  type PopulationBracket,
  type VisualSegment,
} from './visualizations';
import {
  buildPartnerChips,
  collectKeywordChips,
  CLIMATE_CHIP_RULES,
  COMMODITY_CHIP_RULES,
  describeGovernmentType,
  describeLegalSystem,
  describeTipTier,
  extractMilitaryBranches,
  getTotalAreaText,
  HAZARD_CHIP_RULES,
  mapItemsToChips,
  MILITARY_BRANCH_CHIP_RULES,
  normalizePercentMetric,
  normalizeQuantityMetric,
  parseCountryMentions,
  RESOURCE_CHIP_RULES,
  resolveMetricEntry,
  splitList,
} from './helpers';

// ─── Geography ─────────────────────────────────────────────────────────────────

export function renderGeographyTab(data: FactbookData, country: string): HTMLElement | null {
  const sec = data.Geography;
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  const loc = fbText(sec, 'Location');
  const coords = fbText(sec, 'Geographic coordinates');
  if (loc || coords) {
    const body = el('div', 'cdp-fb-stack-v');
    if (loc) body.append(prose(loc)!);
    if (coords) body.append(el('div', 'cdp-fb-coords', `\u{1F4CD} ${coords}`));
    const card = sectionCard('Location', body);
    if (card) stack.append(card);
  }

  const totalAreaText = getTotalAreaText(sec as Record<string, unknown>);
  const landAreaText = fbText(sec, 'Area', 'land');
  const waterAreaText = fbText(sec, 'Area', 'water');
  const tiles: Array<HTMLElement | null> = [
    statTile('Total area', takeValue(totalAreaText)),
    statTile('Land', takeValue(landAreaText)),
    statTile('Water', takeValue(waterAreaText)),
    statTile('Coastline', takeValue(fbText(sec, 'Coastline'))),
  ].filter((t) => t && (t.querySelector('.cdp-fb-tile-value')?.textContent ?? '\u2014') !== '\u2014');
  const glance = sectionCard('At a glance', combine([
    buildLandWaterSplit(landAreaText, waterAreaText),
    tiles.length > 0 ? tileGrid(2, tiles) : null,
  ]));
  if (glance) stack.append(glance);

  const comp = fbText(sec, 'Area - comparative');
  if (comp) {
    const card = sectionCard('Size comparison', buildAreaComparison(country, totalAreaText, comp));
    if (card) stack.append(card);
  }

  const highPointText = fbText(sec, 'Elevation', 'highest point');
  const lowPointText = fbText(sec, 'Elevation', 'lowest point');
  const meanElevationText = fbText(sec, 'Elevation', 'mean elevation');
  const elevProfile = buildElevationProfile(country, highPointText, meanElevationText, lowPointText);
  if (elevProfile) {
    const card = sectionCard('Elevation', elevProfile);
    if (card) stack.append(card);
  }

  const climate = fbText(sec, 'Climate');
  const terrain = fbText(sec, 'Terrain');
  if (climate || terrain) {
    const body = el('div', 'cdp-fb-stack-v');
    const climateChips = collectKeywordChips(climate, CLIMATE_CHIP_RULES);
    if (climateChips.length > 0) {
      body.append(chipRow(climateChips));
    }
    if (climate) {
      body.append(collapsible('Climate details', prose(climate) ?? el('div')));
    }
    if (terrain) {
      body.append(el('div', 'cdp-fb-subhead', 'Terrain'));
      body.append(prose(terrain)!);
    }
    const card = sectionCard('Climate & terrain', body);
    if (card) stack.append(card);
  }

  const resources = splitList(fbText(sec, 'Natural resources'));
  if (resources.length > 0) {
    const card = sectionCard('Natural resources', chipRow(mapItemsToChips(resources, RESOURCE_CHIP_RULES)));
    if (card) stack.append(card);
  }

  const hazards = fbText(sec, 'Natural hazards');
  if (hazards) {
    const body = el('div', 'cdp-fb-stack-v');
    const hazardChips = collectKeywordChips(hazards, HAZARD_CHIP_RULES);
    if (hazardChips.length > 0) {
      body.append(chipRow(hazardChips));
    }
    body.append(collapsible('Hazard details', prose(hazards) ?? el('div')));
    const card = sectionCard('Natural hazards', body);
    if (card) stack.append(card);
  }

  return stack.childElementCount > 0 ? stack : null;
}

// ─── People & Society ──────────────────────────────────────────────────────────

export function renderPeopleTab(data: FactbookData): HTMLElement | null {
  const sec = data['People and Society'];
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

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
    const pictogram = buildPopulationPictogram(pop);
    if (pictogram) hero.append(pictogram);
    const card = sectionCard('Population', hero);
    if (card) stack.append(card);
  }

  const ageYoung = extractPercent(fbText(sec, 'Age structure', '0-14 years'));
  const ageMid = extractPercent(fbText(sec, 'Age structure', '15-64 years'));
  const ageOld = extractPercent(fbText(sec, 'Age structure', '65 years and over'));
  const median = takeValue(fbText(sec, 'Median age', 'total'));
  const peopleVitals: Array<HTMLElement | null> = [
    median ? statTile('Median age', median) : null,
    statTile('Life expectancy', takeValue(fbText(sec, 'Life expectancy at birth', 'total population'))),
    statTile(
      'Urbanization',
      abbreviateStat(takeValue(fbText(sec, 'Urbanization', 'urban population'))),
      { valueClassName: 'cdp-fb-tile-value-compact' },
    ),
    statTile(
      'Birth rate',
      abbreviateStat(takeValue(fbText(sec, 'Birth rate'))),
      { valueClassName: 'cdp-fb-tile-value-compact' },
    ),
  ].filter((t) => t && (t.querySelector('.cdp-fb-tile-value')?.textContent ?? '\u2014') !== '\u2014');
  const pyramid = buildPopulationPyramid([
    parsePopulationBracket('0\u201314', fbText(sec, 'Age structure', '0-14 years')),
    parsePopulationBracket('15\u201364', fbText(sec, 'Age structure', '15-64 years')),
    parsePopulationBracket('65+', fbText(sec, 'Age structure', '65 years and over')),
  ].filter((row): row is PopulationBracket => !!row));
  if (Number.isFinite(ageYoung) || Number.isFinite(ageMid) || Number.isFinite(ageOld) || median) {
    const body = el('div', 'cdp-fb-stack-v');
    if (pyramid) body.append(pyramid);
    if (Number.isFinite(ageYoung) && Number.isFinite(ageMid) && Number.isFinite(ageOld)) {
      body.append(
        stackedBar([
          { label: '0\u201314', pct: ageYoung, color: PALETTE.youth },
          { label: '15\u201364', pct: ageMid, color: PALETTE.working },
          { label: '65+', pct: ageOld, color: PALETTE.elder },
        ]),
      );
    }
    if (peopleVitals.length > 0) {
      const vitalsGrid = el('div', 'cdp-fb-grid cdp-fb-grid-4');
      peopleVitals.forEach((tile) => {
        if (tile) vitalsGrid.append(tile);
      });
      body.append(vitalsGrid);
    }
    const card = sectionCard('Age structure', body);
    if (card) stack.append(card);
  }

  const ethnicPcts = parseLabeledPercents(fbText(sec, 'Ethnic groups'));
  if (ethnicPcts.length > 0) {
    const card = sectionCard('Ethnic groups', labeledBars(ethnicPcts));
    if (card) stack.append(card);
  } else {
    const ethnicRaw = fbText(sec, 'Ethnic groups');
    if (ethnicRaw) stack.append(collapsible('Ethnic groups', prose(ethnicRaw) ?? el('div')));
  }

  const langs = parseLabeledPercents(fbText(sec, 'Languages'));
  if (langs.length > 0) {
    const card = sectionCard('Languages', labeledBars(langs));
    if (card) stack.append(card);
  }

  const rels = parseLabeledPercents(fbText(sec, 'Religions'));
  if (rels.length > 0) {
    const card = sectionCard('Religions', labeledBars(rels));
    if (card) stack.append(card);
  }

  const health: Array<HTMLElement | null> = [
    buildBenchmarkTile(
      'Physician density',
      fbText(sec, 'Physician density'),
      HEALTH_WORLD_MEDIANS.physician.median,
      HEALTH_WORLD_MEDIANS.physician.label,
      HEALTH_WORLD_MEDIANS.physician.higherIsBetter,
    ),
    buildBenchmarkTile(
      'Hospital beds',
      fbText(sec, 'Hospital bed density'),
      HEALTH_WORLD_MEDIANS.beds.median,
      HEALTH_WORLD_MEDIANS.beds.label,
      HEALTH_WORLD_MEDIANS.beds.higherIsBetter,
    ),
    buildBenchmarkTile(
      'Maternal mortality',
      fbText(sec, 'Maternal mortality ratio'),
      HEALTH_WORLD_MEDIANS.maternal.median,
      HEALTH_WORLD_MEDIANS.maternal.label,
      HEALTH_WORLD_MEDIANS.maternal.higherIsBetter,
    ),
    buildBenchmarkTile(
      'School life expectancy',
      fbText(sec, 'School life expectancy (primary to tertiary education)', 'total'),
      HEALTH_WORLD_MEDIANS.school.median,
      HEALTH_WORLD_MEDIANS.school.label,
      HEALTH_WORLD_MEDIANS.school.higherIsBetter,
    ),
  ].filter((t) => t && (t.querySelector('.cdp-fb-tile-value')?.textContent ?? '\u2014') !== '\u2014');
  if (health.length > 0) {
    const card = sectionCard('Health & education', tileGrid(2, health));
    if (card) stack.append(card);
  }

  return stack.childElementCount > 0 ? stack : null;
}

// ─── Government ────────────────────────────────────────────────────────────────

export function renderGovernmentTab(data: FactbookData): HTMLElement | null {
  const sec = data.Government;
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  const chief = fbText(sec, 'Executive branch', 'chief of state');
  const head = fbText(sec, 'Executive branch', 'head of government');
  if (chief || head) {
    const row = el('div', 'cdp-fb-grid cdp-fb-grid-2');
    row.append(personCard('Chief of state', chief));
    row.append(personCard('Head of government', head));
    const card = sectionCard('Leadership', row);
    if (card) stack.append(card);
  }

  const govType = fbText(sec, 'Government type');
  const legal = fbText(sec, 'Legal system');
  if (govType || legal) {
    const body = el('div', 'cdp-fb-stack-v');
    const badges = badgeRow([describeGovernmentType(govType), describeLegalSystem(legal)]);
    if (badges.childElementCount > 0) {
      body.append(badges);
    }
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

  const capName = fbText(sec, 'Capital', 'name');
  const capCoords = fbText(sec, 'Capital', 'geographic coordinates');
  const capTz = fbText(sec, 'Capital', 'time difference');
  if (capName) {
    const body = el('div', 'cdp-fb-stack-v');
    body.append(el('div', 'cdp-fb-hero-value', capName));
    const meta: string[] = [];
    if (capCoords) meta.push(`\u{1F4CD} ${capCoords}`);
    if (capTz) meta.push(`\u{1F550} ${capTz}`);
    if (meta.length > 0) body.append(el('div', 'cdp-fb-hero-meta', meta.join('   ')));
    const card = sectionCard('Capital', body);
    if (card) stack.append(card);
  }

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

  const consHist = fbText(sec, 'Constitution', 'history');
  if (consHist) {
    stack.append(collapsible('Constitution', prose(consHist) ?? el('div')));
  }

  const admin = fbText(sec, 'Administrative divisions');
  if (admin) {
    const chips = splitList(admin);
    const body = chips.length > 2 ? chipRow(chips) : prose(admin) ?? el('div');
    stack.append(collapsible('Administrative divisions', body));
  }

  return stack.childElementCount > 0 ? stack : null;
}

// ─── Economy ───────────────────────────────────────────────────────────────────

export function renderEconomyTab(data: FactbookData): HTMLElement | null {
  const sec = data.Economy;
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  const headline: Array<HTMLElement | null> = [
    buildSparklineTile('GDP (PPP)', fbObj(sec, 'Real GDP (purchasing power parity)'), 'Real GDP (purchasing power parity)'),
    buildSparklineTile('GDP per capita', fbObj(sec, 'Real GDP per capita'), 'Real GDP per capita'),
    buildSparklineTile('Real GDP growth', fbObj(sec, 'Real GDP growth rate'), 'Real GDP growth rate'),
  ];
  if (headline.some(Boolean)) {
    const card = sectionCard('Headline', tileGrid(3, headline));
    if (card) stack.append(card);
  }

  const ag = extractPercent(fbText(sec, 'GDP - composition, by sector of origin', 'agriculture'));
  const ind = extractPercent(fbText(sec, 'GDP - composition, by sector of origin', 'industry'));
  const svc = extractPercent(fbText(sec, 'GDP - composition, by sector of origin', 'services'));
  if (Number.isFinite(ag) && Number.isFinite(ind) && Number.isFinite(svc)) {
    const segments: VisualSegment[] = [
      { label: 'Agriculture', pct: ag, color: PALETTE.agriculture },
      { label: 'Industry', pct: ind, color: PALETTE.industry },
      { label: 'Services', pct: svc, color: PALETTE.services },
    ];
    const card = sectionCard(
      'GDP composition by sector',
      combine([
        buildDonutChart(segments, 'GDP'),
        stackedBar(segments),
      ]),
    );
    if (card) stack.append(card);
  }

  const fiscal: Array<HTMLElement | null> = [
    buildSparklineTile('Inflation', fbObj(sec, 'Inflation rate (consumer prices)'), 'Inflation rate (consumer prices)'),
    buildSparklineTile('Unemployment', fbObj(sec, 'Unemployment rate'), 'Unemployment rate'),
    buildSparklineTile('Public debt', fbObj(sec, 'Public debt'), 'Public debt'),
  ];
  if (fiscal.some(Boolean)) {
    const card = sectionCard('Fiscal', tileGrid(3, fiscal));
    if (card) stack.append(card);
  }

  const expVal = latestYearEntry(fbObj(sec, 'Exports'), 'Exports');
  const impVal = latestYearEntry(fbObj(sec, 'Imports'), 'Imports');
  const expPart = buildPartnerChips(fbText(sec, 'Exports - partners'));
  const impPart = buildPartnerChips(fbText(sec, 'Imports - partners'));
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
      expBody.append(chipRow(mapItemsToChips(expCom.slice(0, 8), COMMODITY_CHIP_RULES)));
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
      impBody.append(chipRow(mapItemsToChips(impCom.slice(0, 8), COMMODITY_CHIP_RULES)));
    }
    const impCard = el('section', 'cdp-card cdp-fb-card');
    impCard.append(el('h3', 'cdp-card-title', 'Imports'));
    const impCardBody = el('div', 'cdp-card-body');
    impCardBody.append(impBody);
    impCard.append(impCardBody);
    row.append(impCard);

    stack.append(row);
  }

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

// ─── Energy ────────────────────────────────────────────────────────────────────

export function renderEnergyTab(data: FactbookData): HTMLElement | null {
  const sec = data.Energy;
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  const accessMetric = normalizePercentMetric(
    fbText(sec, 'Electricity access', 'electrification - total population'),
  );
  const capacityMetric = normalizeQuantityMetric(
    fbText(sec, 'Electricity', 'installed generating capacity'),
    { preferCompact: false },
  );
  const consumptionMetric = normalizeQuantityMetric(
    fbText(sec, 'Electricity', 'consumption'),
    { preferCompact: false },
  );
  const elecTiles: Array<HTMLElement | null> = [
    Number.isFinite(accessMetric.value) && accessMetric.displayText ? statTile('Access to electricity', accessMetric.displayText, {
      year: accessMetric.year,
      hint: accessMetric.rawText,
    }) : null,
    Number.isFinite(capacityMetric.value) && capacityMetric.displayText ? statTile('Installed capacity', capacityMetric.displayText, {
      year: capacityMetric.year,
      hint: capacityMetric.rawText,
    }) : null,
    Number.isFinite(consumptionMetric.value) && consumptionMetric.displayText ? statTile('Consumption', consumptionMetric.displayText, {
      year: consumptionMetric.year,
      hint: consumptionMetric.rawText,
    }) : null,
  ];
  const accessGauge = Number.isFinite(accessMetric.value)
    ? buildGauge(accessMetric.value!, {
      label: 'Electrification',
      valueText: accessMetric.displayText ?? `${accessMetric.value!.toFixed(1)}%`,
      note: 'Share of population with electricity access',
      max: 100,
      tone: accessMetric.value! >= 95 ? 'good' : accessMetric.value! >= 75 ? 'info' : 'warn',
    })
    : null;
  const electricityInputsPresent = !!(
    accessMetric.rawText
    || capacityMetric.rawText
    || consumptionMetric.rawText
    || fbObj(sec, 'Electricity access')
    || fbObj(sec, 'Electricity')
  );
  if (electricityInputsPresent) {
    const electricityBody = combine([
      accessGauge,
      elecTiles.some(Boolean) ? tileGrid(3, elecTiles) : null,
    ]) ?? emptyMessage('No chartable electricity metrics available for this country.');
    const card = sectionCard('Electricity', electricityBody);
    if (card) stack.append(card);
  }

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
        metric: normalizePercentMetric(fbText(sources, k)),
        color,
      }))
      .filter((s) => Number.isFinite(s.metric.value) && s.metric.value! > 0)
      .map((s) => ({
        label: s.label,
        pct: s.metric.value!,
        color: s.color,
      }));
    const card = sectionCard('Generation mix', combine([
      buildDonutChart(segments, 'Power'),
      segments.length > 0 ? stackedBar(segments) : null,
    ]) ?? emptyMessage('Generation mix percentages are not available in a chartable format.'));
    if (card) stack.append(card);
  }

  const oilReserve = normalizeQuantityMetric(fbText(sec, 'Petroleum', 'crude oil estimated reserves'), { preferCompact: false });
  const gasReserve = normalizeQuantityMetric(fbText(sec, 'Natural gas', 'proven reserves'), { preferCompact: false });
  if (oilReserve.displayText || gasReserve.displayText) {
    const card = sectionCard(
      'Reserves',
      tileGrid(2, [
        oilReserve.displayText ? statTile('Crude oil', oilReserve.displayText, {
          year: oilReserve.year,
          hint: oilReserve.rawText,
        }) : null,
        gasReserve.displayText ? statTile('Natural gas', gasReserve.displayText, {
          year: gasReserve.year,
          hint: gasReserve.rawText,
        }) : null,
      ]));
    if (card) stack.append(card);
  }

  const oilProd = takeValue(fbText(sec, 'Petroleum', 'total petroleum production'));
  const oilCons = takeValue(fbText(sec, 'Petroleum', 'refined petroleum consumption'));
  const gasProd = takeValue(fbText(sec, 'Natural gas', 'production'));
  const gasCons = takeValue(fbText(sec, 'Natural gas', 'consumption'));
  if (oilProd || oilCons || gasProd || gasCons) {
    const body = el('div', 'cdp-fb-stack-v');
    if (oilProd || oilCons) {
      body.append(buildFlowBalance('Petroleum', oilProd, oilCons)
        ?? tileGrid(2, [
          oilProd ? statTile('Production', oilProd) : null,
          oilCons ? statTile('Consumption', oilCons) : null,
        ]));
    }
    if (gasProd || gasCons) {
      body.append(buildFlowBalance('Natural gas', gasProd, gasCons)
        ?? tileGrid(2, [
          gasProd ? statTile('Production', gasProd) : null,
          gasCons ? statTile('Consumption', gasCons) : null,
        ]));
    }
    const card = sectionCard('Production vs consumption', body);
    if (card) stack.append(card);
  }

  return stack.childElementCount > 0 ? stack : null;
}

// ─── Communications ────────────────────────────────────────────────────────────

export function renderCommunicationsTab(data: FactbookData): HTMLElement | null {
  const sec = data.Communications;
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

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

  const tld = takeValue(fbText(sec, 'Internet country code'));
  if (tld) {
    const card = sectionCard('Country code / TLD', el('div', 'cdp-fb-value-big', tld));
    if (card) stack.append(card);
  }

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

// ─── Transportation ────────────────────────────────────────────────────────────

export function renderTransportationTab(data: FactbookData): HTMLElement | null {
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
  const totalPorts = takeValue(fbText(sec, 'Ports', 'total ports'));
  const chart = buildTransportChart([
    { label: 'Airports', icon: '\u2708\uFE0F', text: airports, color: '#3b82f6' },
    { label: 'Railways', icon: '\u{1F686}', text: railways, color: '#10b981' },
    { label: 'Roadways', icon: '\u{1F6E3}', text: roadways, color: '#f59e0b' },
    { label: 'Waterways', icon: '\u{1F6F6}', text: waterways, color: '#06b6d4' },
    { label: 'Pipelines', icon: '\u{1F6E2}', text: pipelines, color: '#ef4444' },
    { label: 'Ports', icon: '\u2693', text: totalPorts, color: '#0ea5e9' },
    { label: 'Merchant marine', icon: '\u{1F6A2}', text: merchant, color: '#f97316' },
    { label: 'Heliports', icon: '\u{1F681}', text: heliports, color: '#8b5cf6' },
  ]);

  const tiles: Array<HTMLElement | null> = [
    airports ? statTile('\u2708 Airports', airports) : null,
    railways ? statTile('\u{1F682} Railways', railways) : null,
    roadways ? statTile('\u{1F6E3} Roadways', roadways) : null,
    waterways ? statTile('\u{1F6F6} Waterways', waterways) : null,
    pipelines ? statTile('\u{1F6E2} Pipelines', pipelines) : null,
    merchant ? statTile('\u{1F6A2} Merchant marine', merchant) : null,
    heliports ? statTile('\u{1F681} Heliports', heliports) : null,
  ];
  if (chart || tiles.some(Boolean)) {
    const card = sectionCard('Infrastructure', combine([
      chart,
      tileGrid(3, tiles),
    ]));
    if (card) stack.append(card);
  }

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

  const portsObj = fbObj(sec, 'Ports');
  const keyPorts = splitList(fbText(sec, 'Ports', 'key ports')) || splitList(fbText(sec, 'Ports', 'major ports'));
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

// ─── Military & Security ───────────────────────────────────────────────────────

export function renderMilitaryTab(data: FactbookData): HTMLElement | null {
  const sec = data['Military and Security'];
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  const spendEntry = resolveMetricEntry((sec as Record<string, unknown>)['Military expenditures'], 'Military Expenditures');
  const spendMetric = normalizePercentMetric(spendEntry.rawText, {
    contextPattern: /\bGDP\b/i,
    suffix: ' of GDP',
  });
  const personnelMetric = normalizeQuantityMetric(
    fbText(sec, 'Military and security service personnel strengths'),
  );
  const spendGauge = Number.isFinite(spendMetric.value)
    ? buildGauge(spendMetric.value!, {
      label: 'Military spending',
      valueText: spendMetric.displayText ?? `${spendMetric.value!.toFixed(1)}% of GDP`,
      note: 'Benchmarked against NATO target and world average',
      max: Math.max(4, Math.ceil((Math.max(spendMetric.value!, 2.2) + 0.5) * 2) / 2),
      markers: [
        { value: 2, label: 'NATO target 2%' },
        { value: 2.2, label: 'World average 2.2%' },
      ],
      tone: spendMetric.value! >= 2 ? 'good' : spendMetric.value! >= 1.2 ? 'info' : 'warn',
    })
    : null;
  const tiles: Array<HTMLElement | null> = [
    Number.isFinite(personnelMetric.value) && personnelMetric.displayText ? statTile('Personnel', personnelMetric.displayText, {
      year: personnelMetric.year,
      hint: personnelMetric.rawText,
    }) : null,
  ];
  const spendAndSizeInputsPresent = !!(
    spendEntry.rawText
    || personnelMetric.rawText
    || fbObj(sec, 'Military expenditures')
    || fbText(sec, 'Military and security service personnel strengths')
  );
  if (spendAndSizeInputsPresent) {
    if (spendGauge && spendMetric.year) {
      spendGauge.append(el('div', 'cdp-fb-tile-year', spendMetric.year));
    }
    const card = sectionCard('Spend & size', combine([
      spendGauge,
      tiles.some(Boolean) ? tileGrid(2, tiles) : null,
    ]) ?? emptyMessage('Military spending and personnel totals are not available in a chartable format.'));
    if (card) stack.append(card);
  }

  const forces = fbText(sec, 'Military and security forces');
  if (forces) {
    const body = el('div', 'cdp-fb-stack-v');
    const candidates = extractMilitaryBranches(forces);
    if (candidates.length > 0) {
      body.append(chipRow(mapItemsToChips(candidates.slice(0, 20), MILITARY_BRANCH_CHIP_RULES)));
    }
    body.append(collapsible('Service structure details', prose(forces) ?? el('div')));
    const card = sectionCard('Branches', body);
    if (card) stack.append(card);
  }

  const serviceAge = fbText(sec, 'Military service age and obligation');
  if (serviceAge) {
    stack.append(collapsible('Service age & obligation', prose(serviceAge) ?? el('div')));
  }

  const deploy = fbText(sec, 'Military deployments');
  if (deploy) {
    const deploymentChips = parseCountryMentions(deploy, true).slice(0, 8);
    const card = sectionCard('Deployments', combine([
      deploymentChips.length > 0 ? chipRow(deploymentChips) : null,
      prose(deploy),
    ]));
    if (card) stack.append(card);
  }

  const inv = fbText(sec, 'Military equipment inventories and acquisitions');
  if (inv) {
    stack.append(collapsible('Equipment inventory', prose(inv) ?? el('div')));
  }

  return stack.childElementCount > 0 ? stack : null;
}

// ─── Transnational Issues ──────────────────────────────────────────────────────

export function renderTransnationalTab(data: FactbookData, country: string): HTMLElement | null {
  const sec = data['Transnational Issues'];
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  const disputes = fbText(sec, 'Disputes - international');
  if (disputes) {
    const disputeChips = parseCountryMentions(disputes, false, [country]).slice(0, 8);
    const card = sectionCard('International disputes', combine([
      disputeChips.length > 0 ? chipRow(disputeChips) : null,
      calloutCard('Summary', disputes, 'warn'),
    ]));
    if (card) stack.append(card);
  }

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

  const traf = fbText(sec, 'Trafficking in persons')
    ?? fbText(sec, 'Trafficking in persons', 'tier rating');
  if (traf) {
    const { badge: tipBadge, body } = describeTipTier(traf);
    const wrap = el('div', 'cdp-fb-stack-v');
    if (tipBadge) wrap.append(badgeRow([tipBadge]));
    const severity = tipBadge?.tone === 'danger' ? 'danger' : tipBadge?.tone === 'warn' ? 'warn' : 'info';
    wrap.append(calloutCard('Assessment', body, severity));
    const card = sectionCard('Trafficking in persons', wrap);
    if (card) stack.append(card);
  }

  const drugs = fbText(sec, 'Illicit drugs');
  if (drugs) {
    stack.append(calloutCard('Illicit drugs', drugs, 'info'));
  }

  return stack.childElementCount > 0 ? stack : null;
}
