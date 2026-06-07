import type { MapLayers } from '@/types';
import { SITE_VARIANT } from '@/config';
import { t } from '@/services/i18n';
import { getTrayOpenPreference, setTrayOpenPreference } from '@/app/ui-preferences';

interface SvgLayerTrayOptions {
  container: HTMLElement;
  layersState: MapLayers;
  getVariantLayerKeys: () => (keyof MapLayers)[];
  getLayerLabel: (layer: keyof MapLayers) => string;
  createSharedIcon: (layer: keyof MapLayers, className: string) => HTMLElement;
  toggleLayer: (layer: keyof MapLayers) => void;
}

const MAX_SVG_LAYERS = 9;

export function createSvgLayerToggles(options: SvgLayerTrayOptions): HTMLElement {
  const toggles = document.createElement('div');
  toggles.className = 'layer-toggles map-tray';
  toggles.id = 'layerToggles';
  toggles.setAttribute('role', 'region');
  toggles.setAttribute('aria-label', 'Map layers');
  const header = document.createElement('div');
  header.className = 'map-tray-header';
  const title = document.createElement('span');
  title.className = 'map-tray-title';
  title.textContent = 'Layers';
  const status = document.createElement('span');
  status.className = 'map-tray-status';
  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'map-tray-collapse';
  collapseBtn.type = 'button';
  collapseBtn.setAttribute('aria-label', 'Collapse layers');
  collapseBtn.setAttribute('aria-expanded', 'true');
  const body = document.createElement('div');
  body.className = 'map-tray-body';

  const applyCollapsedState = (collapsed: boolean) => {
    body.classList.toggle('collapsed', collapsed);
    collapseBtn.textContent = collapsed ? '+' : '-';
    collapseBtn.setAttribute('aria-label', collapsed ? 'Expand layers' : 'Collapse layers');
    collapseBtn.setAttribute('aria-expanded', String(!collapsed));
    toggles.classList.toggle('collapsed', collapsed);
    setTrayOpenPreference('svgLayersCollapsed', collapsed);
  };

  collapseBtn.addEventListener('click', () => {
    applyCollapsedState(!body.classList.contains('collapsed'));
  });
  header.append(title, status, collapseBtn);
  toggles.append(header, body);

  const enforceLayerLimit = () => {
    const allBtns = Array.from(body.querySelectorAll<HTMLButtonElement>('.layer-toggle'));
    const activeBtns = allBtns.filter(b => b.classList.contains('active'));
    if (activeBtns.length > MAX_SVG_LAYERS) {
      const excess = activeBtns.slice(MAX_SVG_LAYERS);
      for (const btn of excess) {
        btn.classList.remove('active');
        const layer = btn.dataset.layer as keyof MapLayers | undefined;
        if (layer) options.toggleLayer(layer);
      }
    }
    const activeCount = allBtns.filter(b => b.classList.contains('active')).length;
    allBtns.forEach(b => {
      if (!b.classList.contains('active')) {
        b.disabled = activeCount >= MAX_SVG_LAYERS;
        b.classList.toggle('limit-reached', activeCount >= MAX_SVG_LAYERS);
      } else {
        b.disabled = false;
        b.classList.remove('limit-reached');
      }
    });
    status.textContent = activeCount === 0 ? 'No active layers' : `${activeCount} active`;
  };

  options.getVariantLayerKeys().forEach((layer) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `layer-toggle ${options.layersState[layer] ? 'active' : ''}`;
    btn.dataset.layer = layer;
    btn.setAttribute('aria-pressed', String(Boolean(options.layersState[layer])));
    btn.setAttribute('aria-label', `${options.getLayerLabel(layer)} layer`);
    const icon = options.createSharedIcon(layer, 'layer-toggle-icon');
    const label = document.createElement('span');
    label.className = 'layer-toggle-label';
    label.textContent = options.getLayerLabel(layer);
    btn.append(icon, label);
    btn.addEventListener('click', () => {
      options.toggleLayer(layer);
      btn.setAttribute('aria-pressed', String(btn.classList.contains('active')));
      enforceLayerLimit();
    });
    body.appendChild(btn);
  });

  const helpBtn = document.createElement('button');
  helpBtn.type = 'button';
  helpBtn.className = 'layer-help-btn';
  helpBtn.textContent = '?';
  helpBtn.title = t('components.deckgl.layerGuide');
  helpBtn.setAttribute('aria-label', t('components.deckgl.layerGuide'));
  helpBtn.addEventListener('click', () => showSvgLayerHelp(options.container));
  let helpCloseTimeout: number | null = null;
  const cancelHelpClose = () => {
    if (helpCloseTimeout !== null) {
      window.clearTimeout(helpCloseTimeout);
      helpCloseTimeout = null;
    }
  };
  const queueHelpClose = () => {
    cancelHelpClose();
    helpCloseTimeout = window.setTimeout(() => hideSvgLayerHelp(options.container), 120);
  };
  helpBtn.addEventListener('mouseenter', () => {
    cancelHelpClose();
    showSvgLayerHelp(options.container);
    const popup = options.container.querySelector('.layer-help-popup');
    if (popup && !popup.hasAttribute('data-hover-bound')) {
      popup.setAttribute('data-hover-bound', 'true');
      popup.addEventListener('mouseenter', cancelHelpClose);
      popup.addEventListener('mouseleave', queueHelpClose);
    }
  });
  helpBtn.addEventListener('mouseleave', queueHelpClose);
  helpBtn.addEventListener('focus', () => showSvgLayerHelp(options.container));
  helpBtn.addEventListener('blur', queueHelpClose);
  body.appendChild(helpBtn);
  enforceLayerLimit();
  applyCollapsedState(getTrayOpenPreference('svgLayersCollapsed', false));

  return toggles;
}

export function showSvgLayerHelp(container: HTMLElement): void {
  const existing = container.querySelector('.layer-help-popup');
  if (existing) {
    existing.remove();
    return;
  }

  const popup = document.createElement('div');
  popup.className = 'layer-help-popup';
  popup.innerHTML = buildLayerHelpContent();
  popup.querySelector('.layer-help-close')?.addEventListener('click', () => popup.remove());

  const content = popup.querySelector('.layer-help-content');
  if (content) {
    content.addEventListener('wheel', (e) => e.stopPropagation(), { passive: false });
    content.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: false });
  }

  setTimeout(() => {
    const closeHandler = (e: MouseEvent) => {
      if (!popup.contains(e.target as Node)) {
        popup.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 100);

  container.appendChild(popup);
}

export function hideSvgLayerHelp(container: HTMLElement): void {
  container.querySelector('.layer-help-popup')?.remove();
}

function buildLayerHelpContent(): string {
  const label = (layerKey: string): string => t(`components.deckgl.layers.${layerKey}`).toUpperCase();
  const staticLabel = (labelKey: string): string => t(`components.deckgl.layerHelp.labels.${labelKey}`).toUpperCase();
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
      <button class="layer-help-close" aria-label="Close">\u00d7</button>
    </div>
  `;

  if (SITE_VARIANT === 'tech') {
    return `
      ${helpHeader}
      <div class="layer-help-content">
        ${helpSection('techEcosystem', [
          helpItem(label('startupHubs'), 'techStartupHubs'),
          helpItem(label('cloudRegions'), 'techCloudRegions'),
          helpItem(label('techHQs'), 'techHQs'),
          helpItem(label('accelerators'), 'techAccelerators'),
          helpItem(label('techEvents'), 'techEvents'),
        ])}
        ${helpSection('infrastructure', [
          helpItem(label('underseaCables'), 'infraCables'),
          helpItem(label('aiDataCenters'), 'infraDatacenters'),
          helpItem(label('internetOutages'), 'infraOutages'),
          helpItem(label('cyberThreats'), 'techCyberThreats'),
        ])}
        ${helpSection('naturalEconomic', [
          helpItem(label('naturalEvents'), 'naturalEventsTech'),
          helpItem(label('fires'), 'techFires'),
          helpItem(staticLabel('countries'), 'countriesOverlay'),
        ])}
      </div>
    `;
  }

  if (SITE_VARIANT === 'finance') {
    return `
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
          helpItem(label('underseaCables'), 'financeCables'),
          helpItem(label('pipelines'), 'financePipelines'),
          helpItem(label('internetOutages'), 'financeOutages'),
          helpItem(label('cyberThreats'), 'financeCyberThreats'),
        ])}
        ${helpSection('macroContext', [
          helpItem(label('economicCenters'), 'economicCenters'),
          helpItem(label('strategicWaterways'), 'macroWaterways'),
          helpItem(label('weatherAlerts'), 'weatherAlertsMarket'),
          helpItem(label('naturalEvents'), 'naturalEventsMacro'),
        ])}
      </div>
    `;
  }

  return `
    ${helpHeader}
    <div class="layer-help-content">
      ${helpSection('timeFilter', [
        helpItem(staticLabel('timeRecent'), 'timeRecent'),
        helpItem(staticLabel('timeExtended'), 'timeExtended'),
      ], 'timeAffects')}
      ${helpSection('geopolitical', [
        helpItem(label('conflictZones'), 'geoConflicts'),
        helpItem(label('intelHotspots'), 'geoHotspots'),
        helpItem(staticLabel('sanctions'), 'geoSanctions'),
        helpItem(label('protests'), 'geoProtests'),
        helpItem(label('ucdpEvents'), 'geoUcdpEvents'),
        helpItem(label('displacementFlows'), 'geoDisplacement'),
      ])}
      ${helpSection('militaryStrategic', [
        helpItem(label('militaryBases'), 'militaryBases'),
        helpItem(label('nuclearSites'), 'militaryNuclear'),
        helpItem(label('gammaIrradiators'), 'militaryIrradiators'),
        helpItem(label('militaryActivity'), 'militaryActivity'),
        helpItem(label('spaceports'), 'militarySpaceports'),
      ])}
      ${helpSection('infrastructure', [
        helpItem(label('underseaCables'), 'infraCablesFull'),
        helpItem(label('pipelines'), 'infraPipelinesFull'),
        helpItem(label('internetOutages'), 'infraOutages'),
        helpItem(label('aiDataCenters'), 'infraDatacentersFull'),
        helpItem(label('cyberThreats'), 'infraCyberThreats'),
      ])}
      ${helpSection('transport', [
        helpItem(label('shipTraffic'), 'transportShipping'),
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
      ${helpSection('labels', [
        helpItem(staticLabel('countries'), 'countriesOverlay'),
        helpItem(label('strategicWaterways'), 'waterwaysLabels'),
      ])}
    </div>
  `;
}
