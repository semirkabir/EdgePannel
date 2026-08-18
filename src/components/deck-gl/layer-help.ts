/**
 * Builds the variant-specific "layer help" overlay markup for DeckGLMap.
 *
 * Pure string builder — depends only on the i18n `t()` helper and the build-time
 * `SITE_VARIANT`. Extracted verbatim from DeckGLMap.showLayerHelp() to shrink
 * that file; the returned HTML is identical, so behaviour is unchanged. The
 * caller owns DOM creation, positioning, and event wiring.
 */
import { t } from '@/services/i18n';
import { SITE_VARIANT } from '@/config/variant';

export function buildLayerHelpHtml(): string {
  const label = (layerKey: string): string => t(`components.deckgl.layers.${layerKey}`).toUpperCase();
  const helpItem = (layerLabel: string, descriptionKey: string): string =>
    `<div class="layer-help-item"><span>${layerLabel}</span> ${t(`components.deckgl.layerHelp.descriptions.${descriptionKey}`)}</div>`;
  const helpSection = (titleKey: string, items: string[], noteKey?: string): string => `
      <div class="layer-help-section">
        <div class="layer-help-title">${t(`components.deckgl.layerHelp.sections.${titleKey}`)}</div>
        ${items.join('')}
        ${noteKey ? `<div class="layer-help-note">${t(`components.deckgl.layerHelp.notes.${noteKey}`)}</div>` : ''}
      </div>
    `;
  const helpHeader = `
      <div class="layer-help-header">
        <span>${t('components.deckgl.layerHelp.title')}</span>
        <button class="layer-help-close" aria-label="Close">×</button>
      </div>
    `;

  const controlsFooter = `
      <div class="layer-help-controls-footer">
        <div class="layer-help-controls-row">
          <span class="layer-help-ctrl-badge ctrl-clear">✕</span>
          <span>${t('components.deckgl.layerHelp.controls.clearDesc')}</span>
        </div>
        <div class="layer-help-controls-row">
          <span class="layer-help-ctrl-badge ctrl-marketplace">▦</span>
          <span>${t('components.deckgl.layerHelp.controls.marketplaceDesc')}</span>
        </div>
        <div class="layer-help-controls-row">
          <span class="layer-help-ctrl-badge ctrl-help">?</span>
          <span>${t('components.deckgl.layerHelp.controls.helpDesc')}</span>
        </div>
      </div>
    `;

  // ── TECH variant ─────────────────────────────────────────────────────────
  // Layers: startupHubs, techHQs, accelerators, cloudRegions,
  //         datacenters, cables, outages, cyberThreats, techEvents
  const techHelpContent = `
      ${helpHeader}
      <div class="layer-help-content">
        ${helpSection('techEcosystem', [
    helpItem(label('startupHubs'), 'techStartupHubs'),
    helpItem(label('techHQs'), 'techHQs'),
    helpItem(label('accelerators'), 'techAccelerators'),
    helpItem(label('cloudRegions'), 'techCloudRegions'),
    helpItem(label('techEvents'), 'techEvents'),
  ])}
        ${helpSection('infrastructure', [
    helpItem(label('aiDataCenters'), 'infraDatacenters'),
    helpItem(label('underseaCables'), 'infraCables'),
    helpItem(label('internetOutages'), 'infraOutages'),
    helpItem(label('cyberThreats'), 'techCyberThreats'),
  ])}
        ${controlsFooter}
      </div>
    `;

  // ── FINANCE variant ───────────────────────────────────────────────────────
  // Layers: stockExchanges, financialCenters, centralBanks, commodityHubs,
  //         gulfInvestments, tradeRoutes, cables, pipelines,
  //         natural, cyberThreats, dayNight
  const financeHelpContent = `
      ${helpHeader}
      <div class="layer-help-content">
        ${helpSection('financeCore', [
    helpItem(label('stockExchanges'), 'financeExchanges'),
    helpItem(label('financialCenters'), 'financeCenters'),
    helpItem(label('centralBanks'), 'financeCentralBanks'),
    helpItem(label('commodityHubs'), 'financeCommodityHubs'),
    helpItem(label('gulfInvestments'), 'financeGulfInvestments'),
  ])}
        ${helpSection('infrastructureRisk', [
    helpItem(label('tradeRoutes'), 'financeTradeRoutes'),
    helpItem(label('underseaCables'), 'financeCables'),
    helpItem(label('pipelines'), 'financePipelines'),
    helpItem(label('internetOutages'), 'financeOutages'),
    helpItem(label('cyberThreats'), 'financeCyberThreats'),
  ])}
        ${helpSection('macroContext', [
    helpItem(label('weatherAlerts'), 'weatherAlertsMarket'),
    helpItem(label('economicCenters'), 'economicCenters'),
    helpItem(label('strategicWaterways'), 'macroWaterways'),
    helpItem(label('naturalEvents'), 'financeNatural'),
    helpItem(label('dayNight'), 'dayNight'),
  ])}
        ${controlsFooter}
      </div>
    `;

  // ── HAPPY variant ─────────────────────────────────────────────────────────
  // Layers: positiveEvents, kindness, happiness, speciesRecovery, renewableInstallations
  const happyHelpContent = `
      ${helpHeader}
      <div class="layer-help-content">
        ${helpSection('happyCore', [
    helpItem(label('positiveEvents'), 'happyPositiveEvents'),
    helpItem(label('kindness'), 'happyKindness'),
    helpItem(label('happiness'), 'happyHappiness'),
  ])}
        ${helpSection('happyEnvironment', [
    helpItem(label('speciesRecovery'), 'happySpecies'),
    helpItem(label('renewableInstallations'), 'happyRenewable'),
  ])}
        ${controlsFooter}
      </div>
    `;

  // ── COMMODITY variant ─────────────────────────────────────────────────────
  // Layers: miningSites, processingPlants, commodityPorts, commodityHubs,
  //         minerals, pipelines, waterways, tradeRoutes,
  //         natural, weather, outages, clouds
  const commodityHelpContent = `
      ${helpHeader}
      <div class="layer-help-content">
        ${helpSection('commodityAssets', [
    helpItem(label('miningSites'), 'commodityMining'),
    helpItem(label('processingPlants'), 'commodityProcessing'),
    helpItem(label('commodityPorts'), 'commodityPorts'),
    helpItem(label('commodityHubs'), 'commodityHubs'),
    helpItem(label('criticalMinerals'), 'commodityMinerals'),
  ])}
        ${helpSection('commodityRoutes', [
    helpItem(label('pipelines'), 'commodityPipelines'),
    helpItem(label('strategicWaterways'), 'commodityWaterways'),
    helpItem(label('tradeRoutes'), 'commodityTradeRoutes'),
  ])}
        ${helpSection('commodityContext', [
    helpItem(label('naturalEvents'), 'commodityNatural'),
    helpItem(label('weatherAlerts'), 'commodityWeather'),
    helpItem(label('internetOutages'), 'commodityOutages'),
    helpItem(label('clouds'), 'clouds'),
  ])}
        ${controlsFooter}
      </div>
    `;

  // ── FULL / WORLD variant ──────────────────────────────────────────────────
  // Layers: iranAttacks, hotspots, conflicts, bases, nuclear, irradiators,
  //         spaceports, cables, pipelines, datacenters, military,
  //         ais, tradeRoutes, flights, protests, ucdpEvents, displacement,
  //         climate, weather, outages, cyberThreats, natural, fires,
  //         waterways, economic, minerals, gpsJamming, ciiChoropleth, dayNight
  const fullHelpContent = `
      ${helpHeader}
      <div class="layer-help-content">
        ${helpSection('timeFilter', [
    helpItem('1H / 6H / 24H', 'timeRecent'),
    helpItem('7D / ALL', 'timeExtended'),
  ], 'timeAffects')}
        ${helpSection('geopolitical', [
    helpItem(label('intelHotspots'), 'geoHotspots'),
    helpItem(label('conflictZones'), 'geoConflicts'),
    helpItem(label('iranAttacks'), 'geoIranAttacks'),
    helpItem(label('protests'), 'geoProtests'),
    helpItem(label('ucdpEvents'), 'geoUcdpEvents'),
    helpItem(label('displacementFlows'), 'geoDisplacement'),
  ])}
        ${helpSection('militaryStrategic', [
    helpItem(label('militaryBases'), 'militaryBases'),
    helpItem(label('nuclearSites'), 'militaryNuclear'),
    helpItem(label('gammaIrradiators'), 'militaryIrradiators'),
    helpItem(label('spaceports'), 'militarySpaceports'),
    helpItem(label('militaryActivity'), 'militaryActivity'),
  ])}
        ${helpSection('infrastructure', [
    helpItem(label('underseaCables'), 'infraCablesFull'),
    helpItem(label('pipelines'), 'infraPipelinesFull'),
    helpItem(label('aiDataCenters'), 'infraDatacentersFull'),
    helpItem(label('internetOutages'), 'infraOutages'),
    helpItem(label('cyberThreats'), 'infraCyberThreats'),
  ])}
        ${helpSection('transport', [
    helpItem(label('shipTraffic'), 'transportShipping'),
    helpItem(label('tradeRoutes'), 'tradeRoutes'),
    helpItem(label('flightDelays'), 'transportDelays'),
  ])}
        ${helpSection('naturalEconomic', [
    helpItem(label('naturalEvents'), 'naturalEventsFull'),
    helpItem(label('fires'), 'firesFull'),
    helpItem(label('weatherAlerts'), 'weatherAlerts'),
    helpItem(label('climateAnomalies'), 'climateAnomalies'),
    helpItem(label('economicCenters'), 'economicCenters'),
    helpItem(label('criticalMinerals'), 'mineralsFull'),
  ])}
        ${helpSection('overlays', [
    helpItem(label('ciiChoropleth'), 'ciiChoropleth'),
    helpItem(label('gpsJamming'), 'gpsJamming'),
    helpItem(label('dayNight'), 'dayNight'),
    helpItem(label('clouds'), 'clouds'),
    helpItem(label('strategicWaterways'), 'waterwaysLabels'),
  ])}
        ${controlsFooter}
      </div>
    `;

  return SITE_VARIANT === 'tech'
    ? techHelpContent
    : SITE_VARIANT === 'finance'
      ? financeHelpContent
      : SITE_VARIANT === 'happy'
        ? happyHelpContent
        : SITE_VARIANT === 'commodity'
          ? commodityHelpContent
          : fullHelpContent;
}
