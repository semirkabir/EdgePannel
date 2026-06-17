import type { AppContext, AppModule } from '@/app/app-context';
import type { SearchResult } from '@/components/SearchModal';
import type { PopupType } from '@/components/MapPopup';
import type { NewsItem, MapLayers, SatelliteData } from '@/types';
import type { MapView } from '@/components';
import type { Command } from '@/config/commands';
import { SearchModal } from '@/components';
import { CIIPanel } from '@/components';
import { MARKET_SYMBOLS, SITE_VARIANT, STORAGE_KEYS } from '@/config';
import { LAYER_PRESETS, LAYER_KEY_MAP } from '@/config/commands';
import { calculateCII, TIER1_COUNTRIES } from '@/services/country-instability';
import { CURATED_COUNTRIES } from '@/config/countries';
import { getCountryBbox } from '@/services/country-geometry';
import { INTEL_HOTSPOTS, CONFLICT_ZONES, MILITARY_BASES, UNDERSEA_CABLES, NUCLEAR_FACILITIES, SPACEPORTS } from '@/config/geo';
import { PIPELINES, hydrateGeneratedPipelines } from '@/config/pipelines';
import { AI_DATA_CENTERS } from '@/config/ai-datacenters';
import { GAMMA_IRRADIATORS } from '@/config/irradiators';
import { TECH_COMPANIES } from '@/config/tech-companies';
import { AI_RESEARCH_LABS } from '@/config/ai-research-labs';
import { STARTUP_ECOSYSTEMS } from '@/config/startup-ecosystems';
import { TECH_HQS, ACCELERATORS } from '@/config/tech-geo';
import { STOCK_EXCHANGES, FINANCIAL_CENTERS, CENTRAL_BANKS, COMMODITY_HUBS } from '@/config/finance-geo';
import { ENTITY_REGISTRY } from '@/config/entities';
import { trackSearchResultSelected, trackCountrySelected } from '@/services/analytics';
import { t } from '@/services/i18n';
import { saveToStorage, setThemeWithLinkedMap } from '@/utils';
import { buildLiveSearchTickerPhrases } from '@/utils/live-search-suggestions';
import { buildLiveTrendingSearches } from '@/utils/live-search-trends';
import { CountryIntelManager } from '@/app/country-intel';
import { searchPredictions } from '@/services/prediction';
import { getCachedSanctions, searchSanctions } from '@/services/sanctions';
import { getQuickActionCommandIds } from '@/components/search-ux';
import { fetchCuratedSatellites, fetchCelesTrakSatellites } from '@/services/celestrak-satellites';
import { NOTABLE_INVESTORS } from '@/services/market/portfolio';
import { searchInstitutions13F, type InstitutionSearchResult } from '@/services/market/normalized-13f';
import { ENRICHMENT_SOURCES, isEnrichmentEnabled } from '@/services/enrichment-gates';
import { dataFreshness } from '@/services/data-freshness';
import {
  fetchSecAllFilings,
  getSecFilingAccessionNumber,
  getSecFilingViewerUrl,
  type SecFilingEntry,
} from '@/services/market/sec-filings';

export interface SearchManagerCallbacks {
  openCountryBriefByCode: (code: string, country: string) => void;
}

export class SearchManager implements AppModule {
  private ctx: AppContext;
  private callbacks: SearchManagerCallbacks;
  private boundKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private satelliteSearchItems: SatelliteData[] = [];
  private secFilingSearchItems: SecFilingEntry[] = [];
  private satelliteIndexPromise: Promise<void> | null = null;
  private secFilingIndexPromise: Promise<void> | null = null;

  constructor(ctx: AppContext, callbacks: SearchManagerCallbacks) {
    this.ctx = ctx;
    this.callbacks = callbacks;
  }

  init(): void {
    this.setupSearchModal();
  }

  destroy(): void {
    if (this.boundKeydownHandler) {
      document.removeEventListener('keydown', this.boundKeydownHandler);
      this.boundKeydownHandler = null;
    }
  }

  private setupSearchModal(): void {
    const searchOptions = SITE_VARIANT === 'tech'
      ? { placeholder: t('modals.search.placeholderTech') }
      : SITE_VARIANT === 'happy'
        ? { placeholder: 'Search or type a command...' }
        : SITE_VARIANT === 'finance'
          ? { placeholder: t('modals.search.placeholderFinance') }
          : { placeholder: t('modals.search.placeholder') };
    this.ctx.searchModal = new SearchModal(this.ctx.container, {
      ...searchOptions,
      getTickerPhrases: () => buildLiveSearchTickerPhrases(this.ctx),
      getTrendingSearches: () => buildLiveTrendingSearches(this.ctx),
    });

    if (SITE_VARIANT === 'happy') {
      // Happy variant: no geopolitical/military/infrastructure sources
    } else if (SITE_VARIANT === 'tech') {
      this.ctx.searchModal.registerSource('techcompany', TECH_COMPANIES.map(c => ({
        id: c.id,
        title: c.name,
        subtitle: `${c.sector} ${c.city} ${c.keyProducts?.join(' ') || ''}`.trim(),
        data: c,
      })));

      this.ctx.searchModal.registerSource('ailab', AI_RESEARCH_LABS.map(l => ({
        id: l.id,
        title: l.name,
        subtitle: `${l.type} ${l.city} ${l.focusAreas?.join(' ') || ''}`.trim(),
        data: l,
      })));

      this.ctx.searchModal.registerSource('startup', STARTUP_ECOSYSTEMS.map(s => ({
        id: s.id,
        title: s.name,
        subtitle: `${s.ecosystemTier} ${s.topSectors?.join(' ') || ''} ${s.notableStartups?.join(' ') || ''}`.trim(),
        data: s,
      })));

      this.ctx.searchModal.registerSource('datacenter', AI_DATA_CENTERS.map(d => ({
        id: d.id,
        title: d.name,
        subtitle: `${d.owner} ${d.chipType || ''}`.trim(),
        data: d,
      })));

      this.ctx.searchModal.registerSource('cable', UNDERSEA_CABLES.map(c => ({
        id: c.id,
        title: c.name,
        subtitle: c.major ? 'Major internet backbone' : 'Undersea cable',
        data: c,
      })));

      this.ctx.searchModal.registerSource('techhq', TECH_HQS.map(h => ({
        id: h.id,
        title: h.company,
        subtitle: `${h.type === 'faang' ? 'Big Tech' : h.type === 'unicorn' ? 'Unicorn' : 'Public'} • ${h.city}, ${h.country}`,
        data: h,
      })));

      this.ctx.searchModal.registerSource('accelerator', ACCELERATORS.map(a => ({
        id: a.id,
        title: a.name,
        subtitle: `${a.type} • ${a.city}, ${a.country}${a.notable ? ` • ${a.notable.slice(0, 2).join(', ')}` : ''}`,
        data: a,
      })));
    } else {
      this.ctx.searchModal.registerSource('hotspot', INTEL_HOTSPOTS.map(h => ({
        id: h.id,
        title: h.name,
        subtitle: `${h.subtext || ''} ${h.keywords?.join(' ') || ''} ${h.description || ''}`.trim(),
        data: h,
      })));

      this.ctx.searchModal.registerSource('conflict', CONFLICT_ZONES.map(c => ({
        id: c.id,
        title: c.name,
        subtitle: `${c.parties?.join(' ') || ''} ${c.keywords?.join(' ') || ''} ${c.description || ''}`.trim(),
        data: c,
      })));

      this.ctx.searchModal.registerSource('base', MILITARY_BASES.map(b => ({
        id: b.id,
        title: b.name,
        subtitle: `${b.type} ${b.description || ''}`.trim(),
        data: b,
      })));

      this.registerPipelineSource();
      void hydrateGeneratedPipelines().then((added) => {
        if (added > 0) this.registerPipelineSource();
      });

      this.ctx.searchModal.registerSource('cable', UNDERSEA_CABLES.map(c => ({
        id: c.id,
        title: c.name,
        subtitle: c.major ? 'Major cable' : '',
        data: c,
      })));

      this.ctx.searchModal.registerSource('datacenter', AI_DATA_CENTERS.map(d => ({
        id: d.id,
        title: d.name,
        subtitle: `${d.owner} ${d.chipType || ''}`.trim(),
        data: d,
      })));

      this.ctx.searchModal.registerSource('nuclear', NUCLEAR_FACILITIES.map(n => ({
        id: n.id,
        title: n.name,
        subtitle: `${n.type} ${n.operator || ''}`.trim(),
        data: n,
      })));

      this.ctx.searchModal.registerSource('irradiator', GAMMA_IRRADIATORS.map(g => ({
        id: g.id,
        title: `${g.city}, ${g.country}`,
        subtitle: g.organization || '',
        data: g,
      })));

      this.ctx.searchModal.registerSource('spaceport', SPACEPORTS.map(s => ({
        id: s.id,
        title: s.name,
        subtitle: `${s.operator} ${s.country} ${s.status} ${s.launches} launch cadence`.trim(),
        data: s,
      })));
    }

    if (SITE_VARIANT === 'finance') {
      this.ctx.searchModal.registerSource('exchange', STOCK_EXCHANGES.map(e => ({
        id: e.id,
        title: `${e.shortName} - ${e.name}`,
        subtitle: `${e.tier} • ${e.city}, ${e.country}${e.marketCap ? ` • $${e.marketCap}T` : ''}`,
        data: e,
      })));

      this.ctx.searchModal.registerSource('financialcenter', FINANCIAL_CENTERS.map(f => ({
        id: f.id,
        title: f.name,
        subtitle: `${f.type} financial center${f.gfciRank ? ` • GFCI #${f.gfciRank}` : ''}${f.specialties ? ` • ${f.specialties.slice(0, 3).join(', ')}` : ''}`,
        data: f,
      })));

      this.ctx.searchModal.registerSource('centralbank', CENTRAL_BANKS.map(b => ({
        id: b.id,
        title: `${b.shortName} - ${b.name}`,
        subtitle: `${b.type}${b.currency ? ` • ${b.currency}` : ''} • ${b.city}, ${b.country}`,
        data: b,
      })));

      this.ctx.searchModal.registerSource('commodityhub', COMMODITY_HUBS.map(h => ({
        id: h.id,
        title: h.name,
        subtitle: `${h.type} • ${h.city}, ${h.country}${h.commodities ? ` • ${h.commodities.slice(0, 3).join(', ')}` : ''}`,
        data: h,
      })));
    }

    this.ctx.searchModal.registerSource('country', this.buildCountrySearchItems());

    this.ctx.searchModal.registerSource('company', this.buildCompanySearchItems());
    this.ctx.searchModal.registerAsyncSource('company', async (query) => this.buildTickerFallbackSearchItems(query), { limit: 1 });

    this.ctx.searchModal.registerSource('satellite', this.buildSatelliteSearchItems(this.satelliteSearchItems));
    this.refreshSatelliteSearchIndex();
    this.ctx.searchModal.registerAsyncSource('satellite', async (query) => this.buildLiveSatelliteSearchItems(query), { limit: 8 });

    this.ctx.searchModal.registerSource('institution', this.buildFeaturedInstitutionSearchItems());
    this.ctx.searchModal.registerAsyncSource('institution', async (query) => this.buildInstitutionSearchItems(query), { limit: 8 });

    this.ctx.searchModal.registerSource('secfiling', this.buildSecFilingSearchItems(this.secFilingSearchItems));
    this.ctx.searchModal.registerAsyncSource('secfiling', async (query) => this.buildLiveSecFilingSearchItems(query), { limit: 8 });

    if (this.ctx.marketplace) {
      this.ctx.searchModal.registerSource('marketplace', this.ctx.marketplace.getSearchItems());
    }

    this.ctx.searchModal.setActivePanels(Object.keys(this.ctx.panels));
    this.ctx.searchModal.setQuickActionIds(getQuickActionCommandIds(SITE_VARIANT));
    this.ctx.searchModal.setOnSelect((result) => this.handleSearchResult(result));
    this.ctx.searchModal.setOnCommand((cmd) => this.handleCommand(cmd));

    this.boundKeydownHandler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (this.ctx.searchModal?.isOpen()) {
          this.ctx.searchModal.close();
        } else {
          this.updateSearchIndex();
          this.ctx.searchModal?.open();
        }
      }
    };
    document.addEventListener('keydown', this.boundKeydownHandler);
  }

  private handleSearchResult(result: SearchResult): void {
    trackSearchResultSelected(result.type);
    switch (result.type) {
      case 'news': {
        const item = result.data as NewsItem;
        this.scrollToPanel('politics');
        this.highlightNewsItem(item.link);
        break;
      }
      case 'hotspot': {
        const hotspot = result.data as typeof INTEL_HOTSPOTS[0];
        this.ctx.map?.setView('global');
        setTimeout(() => { this.ctx.map?.triggerHotspotClick(hotspot.id); }, 300);
        break;
      }
      case 'conflict': {
        const conflict = result.data as typeof CONFLICT_ZONES[0];
        this.ctx.map?.setView('global');
        setTimeout(() => { this.ctx.map?.triggerConflictClick(conflict.id); }, 300);
        break;
      }
      case 'market': {
        this.scrollToPanel('markets');
        break;
      }
      case 'prediction': {
        const market = result.data as { title?: string; slug?: string; url?: string; volume?: number; endDate?: string; yesPrice?: number };
        this.ctx.entityDetailPanel?.show('predictionMarket', {
          title: market.title || '',
          slug: market.slug || '',
          category: 'geopolitics',
          volume: market.volume || 0,
          endDate: market.endDate,
          closed: false,
          url: market.url || '',
        });
        break;
      }
      case 'base': {
        const base = result.data as typeof MILITARY_BASES[0];
        this.ctx.map?.setView('global');
        setTimeout(() => { this.ctx.map?.triggerBaseClick(base.id); }, 300);
        break;
      }
      case 'pipeline': {
        const pipeline = result.data as typeof PIPELINES[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('pipelines');
        this.ctx.mapLayers.pipelines = true;
        setTimeout(() => { this.ctx.map?.triggerPipelineClick(pipeline.id); }, 300);
        break;
      }
      case 'cable': {
        const cable = result.data as typeof UNDERSEA_CABLES[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('cables');
        this.ctx.mapLayers.cables = true;
        setTimeout(() => { this.ctx.map?.triggerCableClick(cable.id); }, 300);
        break;
      }
      case 'datacenter': {
        const dc = result.data as typeof AI_DATA_CENTERS[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('datacenters');
        this.ctx.mapLayers.datacenters = true;
        setTimeout(() => { this.ctx.map?.triggerDatacenterClick(dc.id); }, 300);
        break;
      }
      case 'nuclear': {
        const nuc = result.data as typeof NUCLEAR_FACILITIES[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('nuclear');
        this.ctx.mapLayers.nuclear = true;
        setTimeout(() => { this.ctx.map?.triggerNuclearClick(nuc.id); }, 300);
        break;
      }
      case 'irradiator': {
        const irr = result.data as typeof GAMMA_IRRADIATORS[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('irradiators');
        this.ctx.mapLayers.irradiators = true;
        setTimeout(() => { this.ctx.map?.triggerIrradiatorClick(irr.id); }, 300);
        break;
      }
      case 'spaceport': {
        const spaceport = result.data as typeof SPACEPORTS[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('spaceports');
        this.ctx.mapLayers.spaceports = true;
        setTimeout(() => { this.ctx.map?.triggerSpaceportClick(spaceport.id); }, 300);
        break;
      }
      case 'satellite': {
        const satellite = result.data as SatelliteData;
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('satellite');
        this.ctx.mapLayers.satellite = true;
        setTimeout(() => { this.ctx.map?.triggerSatelliteClick(satellite.id); }, 300);
        break;
      }
      case 'earthquake':
      case 'outage':
        this.ctx.map?.setView('global');
        break;
      case 'techcompany': {
        const company = result.data as typeof TECH_COMPANIES[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('techHQs');
        this.ctx.mapLayers.techHQs = true;
        setTimeout(() => { this.ctx.map?.setCenter(company.lat, company.lon, 4); }, 300);
        break;
      }
      case 'ailab': {
        const lab = result.data as typeof AI_RESEARCH_LABS[0];
        this.ctx.map?.setView('global');
        setTimeout(() => { this.ctx.map?.setCenter(lab.lat, lab.lon, 4); }, 300);
        break;
      }
      case 'startup': {
        const ecosystem = result.data as typeof STARTUP_ECOSYSTEMS[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('startupHubs');
        this.ctx.mapLayers.startupHubs = true;
        setTimeout(() => { this.ctx.map?.setCenter(ecosystem.lat, ecosystem.lon, 4); }, 300);
        break;
      }
      case 'techevent':
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('techEvents');
        this.ctx.mapLayers.techEvents = true;
        break;
      case 'techhq': {
        const hq = result.data as typeof TECH_HQS[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('techHQs');
        this.ctx.mapLayers.techHQs = true;
        setTimeout(() => { this.ctx.map?.setCenter(hq.lat, hq.lon, 4); }, 300);
        break;
      }
      case 'accelerator': {
        const acc = result.data as typeof ACCELERATORS[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('accelerators');
        this.ctx.mapLayers.accelerators = true;
        setTimeout(() => { this.ctx.map?.setCenter(acc.lat, acc.lon, 4); }, 300);
        break;
      }
      case 'exchange': {
        const exchange = result.data as typeof STOCK_EXCHANGES[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('stockExchanges');
        this.ctx.mapLayers.stockExchanges = true;
        setTimeout(() => { this.ctx.map?.setCenter(exchange.lat, exchange.lon, 4); }, 300);
        break;
      }
      case 'financialcenter': {
        const fc = result.data as typeof FINANCIAL_CENTERS[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('financialCenters');
        this.ctx.mapLayers.financialCenters = true;
        setTimeout(() => { this.ctx.map?.setCenter(fc.lat, fc.lon, 4); }, 300);
        break;
      }
      case 'centralbank': {
        const bank = result.data as typeof CENTRAL_BANKS[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('centralBanks');
        this.ctx.mapLayers.centralBanks = true;
        setTimeout(() => { this.ctx.map?.setCenter(bank.lat, bank.lon, 4); }, 300);
        break;
      }
      case 'commodityhub': {
        const hub = result.data as typeof COMMODITY_HUBS[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('commodityHubs');
        this.ctx.mapLayers.commodityHubs = true;
        setTimeout(() => { this.ctx.map?.setCenter(hub.lat, hub.lon, 4); }, 300);
        break;
      }
      case 'country': {
        const { code, name } = result.data as { code: string; name: string };
        trackCountrySelected(code, name, 'search');
        this.ctx.map?.setView('global');
        this.callbacks.openCountryBriefByCode(code, name);
        break;
      }
      case 'company': {
        const { ticker, name } = result.data as { ticker: string; name: string };
        this.ctx.entityDetailPanel?.show('company' as PopupType, { ticker, name });
        break;
      }
      case 'secfiling': {
        const filing = result.data as SecFilingEntry;
        this.ctx.entityDetailPanel?.show('secFiling' as PopupType, this.toSecFilingDetailData(filing));
        break;
      }
      case 'institution': {
        const institution = result.data as InstitutionSearchResult | { name: string; cik: string };
        this.ctx.entityDetailPanel?.show('institution' as PopupType, {
          name: institution.name,
          cik: institution.cik,
        });
        break;
      }
      case 'marketplace': {
        this.ctx.marketplace?.openSearchResult(result.data as import('@/types/marketplace').MarketplaceSearchResultData);
        break;
      }
      case 'place': {
        const place = result.data as import('@/services/place-search').PlaceSearchResult;
        this.ctx.map?.setView('global');
        if (place.lat != null && place.lon != null) {
          setTimeout(() => { this.ctx.map?.setCenter(place.lat!, place.lon!, 5); }, 300);
        } else if (place.url) {
          window.open(place.url, '_blank', 'noopener,noreferrer');
        }
        break;
      }
    }
  }

  private handleCommand(cmd: Command): void {
    const colonIdx = cmd.id.indexOf(':');
    if (colonIdx === -1) return;
    const category = cmd.id.slice(0, colonIdx);
    const action = cmd.id.slice(colonIdx + 1);

    switch (category) {
      case 'nav':
        this.ctx.map?.setView(action as MapView);
        {
          const sel = document.getElementById('regionSelect') as HTMLSelectElement;
          if (sel) sel.value = action;
        }
        break;

      case 'layers': {
        if (action === 'all') {
          for (const key of Object.keys(this.ctx.mapLayers))
            this.ctx.mapLayers[key as keyof MapLayers] = true;
        } else if (action === 'none') {
          for (const key of Object.keys(this.ctx.mapLayers))
            this.ctx.mapLayers[key as keyof MapLayers] = false;
        } else {
          const preset = LAYER_PRESETS[action];
          if (preset) {
            for (const key of Object.keys(this.ctx.mapLayers))
              this.ctx.mapLayers[key as keyof MapLayers] = false;
            for (const layer of preset)
              this.ctx.mapLayers[layer] = true;
          }
        }
        saveToStorage(STORAGE_KEYS.mapLayers, this.ctx.mapLayers);
        this.ctx.map?.setLayers(this.ctx.mapLayers);
        break;
      }

      case 'layer': {
        const layerKey = (LAYER_KEY_MAP[action] || action) as keyof MapLayers;
        if (!(layerKey in this.ctx.mapLayers)) return;
        this.ctx.mapLayers[layerKey] = !this.ctx.mapLayers[layerKey];
        saveToStorage(STORAGE_KEYS.mapLayers, this.ctx.mapLayers);
        if (this.ctx.mapLayers[layerKey]) {
          this.ctx.map?.enableLayer(layerKey);
        } else {
          this.ctx.map?.setLayers(this.ctx.mapLayers);
        }
        break;
      }

      case 'panel':
        this.scrollToPanel(action);
        break;

      case 'view':
        if (action === 'dark' || action === 'light') {
          setThemeWithLinkedMap(action);
        } else if (action === 'fullscreen') {
          if (document.fullscreenElement) {
            try { void document.exitFullscreen()?.catch(() => {}); } catch {}
          } else {
            const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
            if (el.requestFullscreen) {
              try { void el.requestFullscreen()?.catch(() => {}); } catch {}
            } else if (el.webkitRequestFullscreen) {
              try { el.webkitRequestFullscreen(); } catch {}
            }
          }
        } else if (action === 'settings') {
          this.ctx.unifiedSettings?.open();
        } else if (action === 'refresh') {
          window.location.reload();
        }
        break;

      case 'time':
        this.ctx.map?.setTimeRange(action as import('@/components').TimeRange);
        break;

      case 'actions':
        if (action === 'open-marketplace') {
          void this.ctx.marketplace?.openModal();
        }
        break;

      case 'country': {
        const name = TIER1_COUNTRIES[action]
          || CURATED_COUNTRIES[action]?.name
          || new Intl.DisplayNames(['en'], { type: 'region' }).of(action)
          || action;
        trackCountrySelected(action, name, 'command');
        this.callbacks.openCountryBriefByCode(action, name);
        break;
      }

      case 'country-map': {
        const bbox = getCountryBbox(action);
        if (bbox) {
          const [minLon, minLat, maxLon, maxLat] = bbox;
          const lat = (minLat + maxLat) / 2;
          const lon = (minLon + maxLon) / 2;
          const span = Math.max(maxLat - minLat, maxLon - minLon);
          const zoom = span > 40 ? 3 : span > 15 ? 4 : span > 5 ? 5 : 6;
          this.ctx.map?.setView('global');
          setTimeout(() => { this.ctx.map?.setCenter(lat, lon, zoom); }, 300);
        }
        break;
      }
    }
  }

  private scrollToPanel(panelId: string): void {
    const panel = document.querySelector(`[data-panel="${panelId}"]`);
    if (panel) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      panel.classList.add('flash-highlight');
      setTimeout(() => panel.classList.remove('flash-highlight'), 1500);
    }
  }

  private highlightNewsItem(itemId: string): void {
    setTimeout(() => {
      const item = document.querySelector(`[data-news-id="${CSS.escape(itemId)}"]`);
      if (item) {
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        item.classList.add('flash-highlight');
        setTimeout(() => item.classList.remove('flash-highlight'), 1500);
      }
    }, 100);
  }

  updateSearchIndex(): void {
    if (!this.ctx.searchModal) return;

    this.ctx.searchModal.registerSource('country', this.buildCountrySearchItems());
    this.ctx.searchModal.registerSource('company', this.buildCompanySearchItems());
    this.ctx.searchModal.registerSource('satellite', this.buildSatelliteSearchItems(this.satelliteSearchItems));
    this.ctx.searchModal.registerSource('institution', this.buildFeaturedInstitutionSearchItems());
    this.ctx.searchModal.registerSource('secfiling', this.buildSecFilingSearchItems(this.secFilingSearchItems));
    this.refreshSatelliteSearchIndex();
    this.refreshSecFilingSearchIndex();

    const newsItems = this.ctx.allNews.slice(0, 500).map(n => ({
      id: n.link,
      title: n.title,
      subtitle: n.source,
      data: n,
    }));
    console.log(`[Search] Indexing ${newsItems.length} news items (allNews total: ${this.ctx.allNews.length})`);
    this.ctx.searchModal.registerSource('news', newsItems);

    if (this.ctx.latestPredictions.length > 0) {
      this.ctx.searchModal.registerSource('prediction', this.ctx.latestPredictions.map(p => ({
        id: p.title,
        title: p.title,
        subtitle: `${Math.round(p.yesPrice)}% probability`,
        data: p,
      })));
    }

    const sanctions = getCachedSanctions();
    if (sanctions.length > 0) {
      this.ctx.searchModal.registerSource('sanction', sanctions.slice(0, 200).map(entity => ({
        id: entity.id,
        title: entity.name,
        subtitle: `${entity.source} · ${entity.programs.slice(0, 2).join(', ')}`,
        data: { name: entity.name, id: entity.id, entity },
      })));
    }

    this.ctx.searchModal.registerAsyncSource('sanction', async (query) => {
      return searchSanctions(query, 30).map(entity => ({
        id: entity.id,
        title: entity.name,
        subtitle: `${entity.source} · ${entity.type}${entity.countries.length ? ` · ${entity.countries.slice(0, 2).join(', ')}` : ''}`,
        data: { name: entity.name, id: entity.id, entity },
      }));
    }, { limit: 250 });

    // Live prediction search — fetches matching markets from the API on demand
    this.ctx.searchModal.registerAsyncSource('prediction', async (query) => {
      const markets = await searchPredictions(query);
      return markets.map(p => ({
        id: `live-${p.slug || p.title}`,
        title: p.title,
        subtitle: `${Math.round(p.yesPrice)}% probability${p.volume ? ` • $${Math.round(p.volume).toLocaleString()} vol` : ''}`,
        data: p,
      }));
    }, { limit: 250 });

    this.ctx.searchModal.registerAsyncSource('place', async (query) => {
      if (!isEnrichmentEnabled(ENRICHMENT_SOURCES.PLACE_SEARCH)) {
        this.ctx.statusPanel?.updateApi('Place Search', { status: 'disabled' });
        return [];
      }
      try {
        const { searchPlaces } = await import('@/services/place-search');
        const results = await searchPlaces(query);
        this.ctx.statusPanel?.updateApi('Place Search', {
          status: results.length > 0 ? 'ok' : 'warning',
        });
        if (results.length > 0) dataFreshness.recordUpdate('place_search', results.length);
        return results.map((place) => ({
          id: place.id,
          title: place.title,
          subtitle: `${place.source}${place.subtitle ? ` · ${place.subtitle}` : ''}`,
          data: place,
        }));
      } catch (error) {
        console.warn('[Search] Place search failed:', error);
        this.ctx.statusPanel?.updateApi('Place Search', { status: 'error' });
        dataFreshness.recordError('place_search', String(error));
        return [];
      }
    }, { limit: 8 });

    if (this.ctx.latestMarkets.length > 0) {
      this.ctx.searchModal.registerSource('market', this.ctx.latestMarkets.map(m => ({
        id: m.symbol,
        title: `${m.symbol} - ${m.name}`,
        subtitle: `$${m.price?.toFixed(2) || 'N/A'}`,
        data: m,
      })));
    }

    if (this.ctx.marketplace) {
      this.ctx.searchModal.registerSource('marketplace', this.ctx.marketplace.getSearchItems());
    }
  }

  private buildCountrySearchItems(): { id: string; title: string; subtitle: string; data: { code: string; name: string } }[] {
    const panelScores = (this.ctx.panels['cii'] as CIIPanel | undefined)?.getScores() ?? [];
    const scores = panelScores.length > 0 ? panelScores : calculateCII();
    const ciiByCode = new Map(scores.map((score) => [score.code, score]));
    return Object.entries(TIER1_COUNTRIES).map(([code, name]) => {
      const score = ciiByCode.get(code);
      return {
        id: code,
        title: `${CountryIntelManager.toFlagEmoji(code)} ${name}`,
        subtitle: score ? `CII: ${score.score}/100 • ${score.level}` : 'Country Brief',
        data: { code, name },
      };
    });
  }

  private registerPipelineSource(): void {
    this.ctx.searchModal?.registerSource('pipeline', PIPELINES.map(p => ({
      id: p.id,
      title: p.name,
      subtitle: `${p.type} ${p.operator || ''} ${p.countries?.join(' ') || ''}`.trim(),
      data: p,
    })));
  }

  private buildCompanySearchItems(): { id: string; title: string; subtitle: string; searchText: string; data: { ticker: string; name: string } }[] {
    const itemsBySymbol = new Map<string, { id: string; title: string; subtitle: string; searchText: string; data: { ticker: string; name: string } }>();

    for (const entity of ENTITY_REGISTRY) {
      if (entity.type !== 'company' && entity.type !== 'index') continue;
      const searchTerms = [
        ...this.symbolSearchVariants(entity.id),
        entity.name,
        entity.sector,
        ...(entity.aliases ?? []),
        ...(entity.keywords ?? []),
      ].filter(Boolean);

      itemsBySymbol.set(entity.id.toUpperCase(), {
        id: entity.id,
        title: entity.name,
        subtitle: [entity.id, entity.sector].filter(Boolean).join(' - '),
        searchText: searchTerms.join(' '),
        data: { ticker: entity.id, name: entity.name },
      });
    }

    for (const market of MARKET_SYMBOLS) {
      const key = market.symbol.toUpperCase();
      if (itemsBySymbol.has(key)) continue;
      itemsBySymbol.set(key, {
        id: market.symbol,
        title: market.name,
        subtitle: [market.display, market.symbol, 'Market symbol'].filter(Boolean).join(' - '),
        searchText: [...this.symbolSearchVariants(market.symbol), ...this.symbolSearchVariants(market.display), market.name].filter(Boolean).join(' '),
        data: { ticker: market.symbol, name: market.name },
      });
    }

    return Array.from(itemsBySymbol.values());
  }

  private buildTickerFallbackSearchItems(query: string): { id: string; title: string; subtitle: string; searchText: string; data: { ticker: string; name: string } }[] {
    const ticker = this.normalizeTickerQuery(query);
    if (!ticker) return [];

    const normalizedQuery = query.trim().toLowerCase();
    const knownItems = this.buildCompanySearchItems();
    if (knownItems.some(item => this.companySearchText(item).includes(normalizedQuery))) return [];

    const tickerKey = this.normalizeSymbolKey(ticker);
    const knownSymbols = new Set(knownItems.map(item => this.normalizeSymbolKey(item.data.ticker)));
    if (knownSymbols.has(tickerKey)) return [];

    return [{
      id: `ticker-${ticker}`,
      title: ticker,
      subtitle: 'Ticker symbol',
      searchText: ticker,
      data: { ticker, name: ticker },
    }];
  }

  private normalizeTickerQuery(query: string): string | null {
    const ticker = query.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9]{0,5}([.-][A-Z0-9]{1,4})?$/.test(ticker)) return null;
    return ticker;
  }

  private normalizeSymbolKey(symbol: string): string {
    return symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private symbolSearchVariants(symbol: string | undefined): string[] {
    if (!symbol) return [];
    const variants = new Set<string>([symbol]);
    if (symbol.startsWith('^')) variants.add(symbol.slice(1));
    if (symbol.includes('-')) variants.add(symbol.replace(/-/g, '.'));
    if (symbol.includes('.')) variants.add(symbol.replace(/\./g, '-'));
    variants.add(this.normalizeSymbolKey(symbol));
    return Array.from(variants);
  }

  private companySearchText(item: { title: string; subtitle?: string; searchText?: string }): string {
    return [item.title, item.subtitle, item.searchText].filter(Boolean).join(' ').toLowerCase();
  }

  private refreshSatelliteSearchIndex(): void {
    if (this.satelliteIndexPromise) return;
    this.satelliteIndexPromise = fetchCuratedSatellites()
      .then((satellites) => {
        this.satelliteSearchItems = satellites;
        this.ctx.searchModal?.registerSource('satellite', this.buildSatelliteSearchItems(satellites));
      })
      .catch((err) => {
        console.warn('[Search] Satellite index unavailable.', err);
      })
      .finally(() => {
        this.satelliteIndexPromise = null;
      });
  }

  private buildSatelliteSearchItems(satellites: SatelliteData[]): { id: string; title: string; subtitle: string; searchText: string; data: SatelliteData }[] {
    return satellites.map((satellite) => ({
      id: satellite.id,
      title: satellite.name,
      subtitle: [
        satellite.operator,
        satellite.category,
        satellite.sourceGroup ? `CelesTrak ${satellite.sourceGroup}` : '',
        satellite.noradId ? `NORAD ${satellite.noradId}` : '',
      ].filter(Boolean).join(' - '),
      searchText: [
        satellite.name,
        satellite.operator,
        satellite.category,
        satellite.source,
        satellite.sourceGroup,
        satellite.objectId,
        String(satellite.noradId || ''),
      ].filter(Boolean).join(' '),
      data: satellite,
    }));
  }

  private async buildLiveSatelliteSearchItems(query: string): Promise<{ id: string; title: string; subtitle: string; searchText: string; data: SatelliteData }[]> {
    if (query.trim().length < 2) return [];
    const normalized = query.trim().toLowerCase();
    const satellites = await fetchCelesTrakSatellites();
    return this.buildSatelliteSearchItems(satellites)
      .filter((item) => this.searchItemText(item).includes(normalized))
      .slice(0, 24);
  }

  private buildFeaturedInstitutionSearchItems(): { id: string; title: string; subtitle: string; searchText: string; data: { name: string; cik: string } }[] {
    return NOTABLE_INVESTORS.map((investor) => ({
      id: investor.cik || investor.name,
      title: investor.name,
      subtitle: `${investor.description} - 13F institutional filer`,
      searchText: [investor.name, investor.description, investor.cik, '13F institutional filer hedge fund asset manager'].join(' '),
      data: { name: investor.name, cik: investor.cik },
    }));
  }

  private async buildInstitutionSearchItems(query: string): Promise<{ id: string; title: string; subtitle: string; searchText: string; data: InstitutionSearchResult }[]> {
    if (query.trim().length < 2) return [];
    const results = await searchInstitutions13F(query, { limit: 24 });
    return results.map((institution) => ({
      id: institution.cik || institution.name,
      title: institution.name,
      subtitle: [
        institution.subtitle,
        institution.latestFilingType,
        institution.latestFilingDate ? this.formatSearchDate(institution.latestFilingDate) : '',
        institution.relatedTicker ? `${institution.relatedTicker} holder` : '',
      ].filter(Boolean).join(' - '),
      searchText: [institution.name, institution.cik, institution.subtitle, institution.latestFilingType, institution.relatedTicker].filter(Boolean).join(' '),
      data: institution,
    }));
  }

  private refreshSecFilingSearchIndex(): void {
    if (this.secFilingIndexPromise) return;
    this.secFilingIndexPromise = fetchSecAllFilings()
      .then((filings) => {
        this.secFilingSearchItems = filings.slice(0, 120);
        this.ctx.searchModal?.registerSource('secfiling', this.buildSecFilingSearchItems(this.secFilingSearchItems));
      })
      .catch((err) => {
        console.warn('[Search] SEC filing index unavailable.', err);
      })
      .finally(() => {
        this.secFilingIndexPromise = null;
      });
  }

  private buildSecFilingSearchItems(filings: SecFilingEntry[]): { id: string; title: string; subtitle: string; searchText: string; data: SecFilingEntry }[] {
    return filings.map((filing) => ({
      id: filing.id || `${filing.cik}:${filing.filingType}:${filing.filedAt.toISOString()}`,
      title: `${filing.filingType} - ${filing.filerName}`,
      subtitle: [
        filing.cik ? `CIK ${filing.cik}` : '',
        this.formatSearchDate(filing.filedAt.toISOString()),
        filing.description,
      ].filter(Boolean).join(' - '),
      searchText: [filing.title, filing.filerName, filing.cik, filing.filingType, filing.description].filter(Boolean).join(' '),
      data: filing,
    }));
  }

  private async buildLiveSecFilingSearchItems(query: string): Promise<{ id: string; title: string; subtitle: string; searchText: string; data: SecFilingEntry }[]> {
    if (query.trim().length < 2) return [];
    const normalized = query.trim().toLowerCase();
    const filings = await fetchSecAllFilings();
    return this.buildSecFilingSearchItems(filings)
      .filter((item) => this.searchItemText(item).includes(normalized))
      .slice(0, 24);
  }

  private toSecFilingDetailData(filing: SecFilingEntry): {
    cik: string;
    companyName: string;
    filingType: string;
    accessionNumber: string;
    documentUrl: string;
    title: string;
    filedAt: string;
  } {
    return {
      cik: filing.cik,
      companyName: filing.filerName,
      filingType: filing.filingType,
      accessionNumber: getSecFilingAccessionNumber(filing),
      documentUrl: getSecFilingViewerUrl(filing) || filing.url,
      title: filing.title,
      filedAt: filing.filedAt.toISOString(),
    };
  }

  private formatSearchDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private searchItemText(item: { title: string; subtitle?: string; searchText?: string }): string {
    return [item.title, item.subtitle, item.searchText].filter(Boolean).join(' ').toLowerCase();
  }
}
