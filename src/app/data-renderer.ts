import type { AppContext } from '@/app/app-context';
import type { MarketData } from '@/types';
import type { PredictionMarket } from '@/services/prediction';
import type { SolarWeatherSnapshot } from '@/services/solar-weather';
import type { GetShippingRatesResponse, GetChokepointStatusResponse } from '@/services/supply-chain';
import type { SupplementalSignal } from '@/services/supplemental-signal-bus';
import type { DataSourceId } from '@/services/data-freshness';
import {
  fetchMultipleStocks,
  fetchCrypto,
  fetchPredictions,
  fetchFredData,
  fetchOilAnalytics,
  fetchRecentAwards,
  fetchBisData,
  fetchTradeRestrictions,
  fetchTariffTrends,
  fetchTradeFlows,
  fetchTradeBarriers,
  fetchShippingRates,
  fetchChokepointStatus,
  fetchCriticalMinerals,
  fetchSanctions,
  fetchSolarWeather,
  fetchAllFires,
  flattenFires,
  computeRegionStats,
  toMapFires,
  fetchPizzIntStatus,
  fetchGdeltTensions,
} from '@/services';
import { getMarketWatchlistEntries } from '@/services/market-watchlist';
import { getHydratedData } from '@/services/bootstrap';
import { dataFreshness } from '@/services/data-freshness';
import { getCircuitBreakerCooldownInfo } from '@/utils';
import { getMissingFeatureSecretMessage, getMissingSecretMessage, isFeatureAvailable } from '@/services/runtime-config';
import { t } from '@/services/i18n';
import { SECTORS, COMMODITIES } from '@/config';
import { signalAggregator } from '@/services/signal-aggregator';
import { supplementalBus } from '@/services/supplemental-signal-bus';
import { ingestSatelliteFiresForCII } from '@/services/country-instability';
import { matchCountryNamesInText } from '@/services/country-geometry';
import { dataTaskScheduler } from './data-task-scheduler';
import type { MarketPanel, HeatmapPanel, CommoditiesPanel, CryptoPanel, PredictionPanel, EconomicPanel, TradePolicyPanel, SupplyChainPanel, SanctionsTrackerPanel } from '@/components';
import { SatelliteFiresPanel } from '@/components/SatelliteFiresPanel';

export interface DataRendererDeps {
  callPanel: (key: string, method: string, ...args: unknown[]) => void;
  publishSupplementalSignals: (options: {
    sourceId: string;
    sourceName: string;
    signals: SupplementalSignal[];
    dataSourceId?: DataSourceId;
    baseline?: { mean: number; stdDev: number };
    itemCount?: number;
  }) => void;
  clearSupplementalSignals: (sourceId: string, dataSourceId: DataSourceId | undefined, error: string) => void;
  refreshCiiAndBrief: (forceLocal?: boolean) => void;
  updateSearchIndex: () => void;
}

export class DataRenderer {
  private ctx: AppContext;
  private deps: DataRendererDeps;
  private scheduledDelayedTasks = new Set<string>();

  constructor(ctx: AppContext, deps: DataRendererDeps) {
    this.ctx = ctx;
    this.deps = deps;
  }

  destroy(): void {
    // No resources to clean up
  }

  async loadMarkets(): Promise<void> {
    await Promise.allSettled([
      dataTaskScheduler.schedule('market:quotes', () => this.loadMarketQuotesPanel(), { priority: 'high', group: 'finnhub' }),
      dataTaskScheduler.schedule('market:heatmap', () => this.loadHeatmapPanel(), { priority: 'high', group: 'finnhub' }),
      dataTaskScheduler.schedule('market:commodities', () => this.loadCommoditiesPanel(), { priority: 'normal', group: 'finnhub' }),
      dataTaskScheduler.schedule('market:crypto', () => this.loadCryptoPanel(), { priority: 'high', group: 'coingecko' }),
    ]);
  }

  private getEffectiveMarketSymbols(): Array<{ symbol: string; name: string; display: string }> {
    return getMarketWatchlistEntries().slice(0, 50).map(e => ({
      symbol: e.symbol,
      name: e.name || e.symbol,
      display: e.display || e.symbol,
    }));
  }

  private async loadMarketQuotesPanel(): Promise<void> {
    try {
      const customEntries = getMarketWatchlistEntries();
      const effectiveSymbols = this.getEffectiveMarketSymbols();

      const hydratedMarkets = getHydratedData('marketQuotes') as import('@/generated/client/worldmonitor/market/v1/service_client').ListMarketQuotesResponse | undefined;
      let stocksResult: Awaited<ReturnType<typeof fetchMultipleStocks>>;

      if (customEntries.length === 0 && hydratedMarkets?.quotes?.length) {
        const symbolMetaMap = new Map(effectiveSymbols.map((s) => [s.symbol, s]));
        const data = hydratedMarkets.quotes.map((q) => ({
          symbol: q.symbol,
          name: symbolMetaMap.get(q.symbol)?.name || q.name,
          display: symbolMetaMap.get(q.symbol)?.display || q.display || q.symbol,
          price: q.price != null ? q.price : null,
          change: q.change ?? null,
          sparkline: q.sparkline?.length > 0 ? q.sparkline : undefined,
        }));
        this.ctx.intelligenceStore.setMarkets(data);
        (this.ctx.panels['markets'] as MarketPanel).renderMarkets(data);
        stocksResult = { data, skipped: hydratedMarkets.finnhubSkipped || undefined, rateLimited: hydratedMarkets.rateLimited || undefined };
      } else {
        stocksResult = await fetchMultipleStocks(effectiveSymbols, {
          onBatch: (partialStocks) => {
            this.ctx.intelligenceStore.setMarkets(partialStocks);
            (this.ctx.panels['markets'] as MarketPanel).renderMarkets(partialStocks);
          },
        });
        this.ctx.intelligenceStore.setMarkets(stocksResult.data);
        (this.ctx.panels['markets'] as MarketPanel).renderMarkets(stocksResult.data, stocksResult.rateLimited);
      }

      const finnhubConfigMsg = getMissingSecretMessage('FINNHUB_API_KEY');

      if (stocksResult.rateLimited && stocksResult.data.length === 0) {
        const rlMsg = 'Market data temporarily unavailable (rate limited) — retrying shortly';
        this.ctx.panels['commodities']?.showError(rlMsg);
      } else if (stocksResult.skipped) {
        this.ctx.statusPanel?.updateApi('Finnhub', { status: 'error' });
        if (stocksResult.data.length === 0) {
          this.ctx.panels['markets']?.showConfigError(finnhubConfigMsg);
        }
      } else {
        this.ctx.statusPanel?.updateApi('Finnhub', { status: 'ok' });
      }
    } catch {
      this.ctx.statusPanel?.updateApi('Finnhub', { status: 'error' });
    }
  }

  private async loadHeatmapPanel(): Promise<void> {
    const finnhubConfigMsg = getMissingSecretMessage('FINNHUB_API_KEY');
    try {
      const hydratedSectors = getHydratedData('sectors') as import('@/generated/client/worldmonitor/market/v1/service_client').GetSectorSummaryResponse | undefined;
      if (hydratedSectors?.sectors?.length) {
        const mapped = hydratedSectors.sectors.map((s) => ({ symbol: s.symbol, name: s.name, change: s.change }));
        (this.ctx.panels['heatmap'] as HeatmapPanel).renderHeatmap(mapped);
        return;
      }

      const sectorsResult = await fetchMultipleStocks(
        SECTORS.map((s) => ({ ...s, display: s.name })),
        {
          onBatch: (partialSectors) => {
            (this.ctx.panels['heatmap'] as HeatmapPanel).renderHeatmap(
              partialSectors.map((s) => ({ symbol: s.symbol, name: s.name, change: s.change }))
            );
          },
        }
      );
      const mapped = sectorsResult.data.map((s) => ({ symbol: s.symbol, name: s.name, change: s.change }));
      if (mapped.some(s => s.change !== null)) {
        (this.ctx.panels['heatmap'] as HeatmapPanel).renderHeatmap(mapped);
      } else if (sectorsResult.skipped) {
        this.ctx.panels['heatmap']?.showConfigError(finnhubConfigMsg);
      } else {
        (this.ctx.panels['heatmap'] as HeatmapPanel).renderHeatmap([]);
      }
    } catch {
      (this.ctx.panels['heatmap'] as HeatmapPanel)?.renderHeatmap([]);
    }
  }

  private async loadCommoditiesPanel(): Promise<void> {
    const commoditiesPanel = this.ctx.panels['commodities'] as CommoditiesPanel;
    const mapCommodity = (c: MarketData) => ({ display: c.display, price: c.price, change: c.change, sparkline: c.sparkline });

    const loadOnce = async (): Promise<Array<{ display: string; price: number | null; change: number | null; sparkline?: number[] }>> => {
      const commoditiesResult = await fetchMultipleStocks(COMMODITIES, {
        onBatch: (partial) => commoditiesPanel.renderCommodities(partial.map(mapCommodity)),
        useCommodityBreaker: true,
      });
      return commoditiesResult.data.map(mapCommodity);
    };

    try {
      const hydratedCommodities = getHydratedData('commodityQuotes') as import('@/generated/client/worldmonitor/market/v1/service_client').ListMarketQuotesResponse | undefined;
      if (hydratedCommodities?.quotes?.length) {
        const symbolMetaMap = new Map(COMMODITIES.map((s) => [s.symbol, s]));
        const data = hydratedCommodities.quotes.map((q) => ({
          symbol: q.symbol,
          name: symbolMetaMap.get(q.symbol)?.name || q.name,
          display: symbolMetaMap.get(q.symbol)?.display || q.display || q.symbol,
          price: q.price != null ? q.price : null,
          change: q.change ?? null,
          sparkline: q.sparkline?.length > 0 ? q.sparkline : undefined,
        }));
        const mapped = data.map(mapCommodity);
        if (mapped.some(d => d.price !== null)) {
          commoditiesPanel.renderCommodities(mapped);
          return;
        }
      }

      const mapped = await loadOnce();
      if (mapped.some(d => d.price !== null)) {
        commoditiesPanel.renderCommodities(mapped);
        return;
      }

      commoditiesPanel.showRetrying();
      this.scheduleDelayedTask('market:commodities:retry:1', 20_000, 'finnhub', async () => {
        const retry = await loadOnce();
        if (retry.some(d => d.price !== null)) {
          commoditiesPanel.renderCommodities(retry);
          return;
        }
        commoditiesPanel.showRetrying();
        this.scheduleDelayedTask('market:commodities:retry:2', 20_000, 'finnhub', async () => {
          const finalRetry = await loadOnce();
          commoditiesPanel.renderCommodities(finalRetry);
        });
      });
    } catch {
      commoditiesPanel.showRetrying();
    }
  }

  private scheduleDelayedTask(name: string, delayMs: number, group: string, run: () => Promise<void>): void {
    if (this.scheduledDelayedTasks.has(name)) return;
    this.scheduledDelayedTasks.add(name);
    setTimeout(() => {
      void dataTaskScheduler.schedule(name, run, { priority: 'low', group })
        .catch(() => {})
        .finally(() => this.scheduledDelayedTasks.delete(name));
    }, delayMs);
  }

  private async loadCryptoPanel(): Promise<void> {
    try {
      let crypto = await fetchCrypto();
      if (crypto.length === 0) {
        (this.ctx.panels['crypto'] as CryptoPanel).showRetrying();
        this.scheduleDelayedTask('market:crypto:retry', 20_000, 'coingecko', async () => {
          crypto = await fetchCrypto();
          (this.ctx.panels['crypto'] as CryptoPanel).renderCrypto(crypto);
          this.ctx.statusPanel?.updateApi('CoinGecko', { status: crypto.length > 0 ? 'ok' : 'error' });
        });
        this.ctx.statusPanel?.updateApi('CoinGecko', { status: 'error' });
        return;
      }
      (this.ctx.panels['crypto'] as CryptoPanel).renderCrypto(crypto);
      this.ctx.statusPanel?.updateApi('CoinGecko', { status: 'ok' });
    } catch {
      this.ctx.statusPanel?.updateApi('CoinGecko', { status: 'error' });
    }
  }

  async loadPredictions(): Promise<void> {
    try {
      const predictions = await fetchPredictions();
      this.ctx.intelligenceStore.setPredictions(predictions);
      (this.ctx.panels['polymarket'] as PredictionPanel).renderPredictions(predictions);
      this.deps.publishSupplementalSignals({
        sourceId: 'predictions_deep',
        sourceName: 'Prediction Markets',
        signals: this.buildPredictionSignals(predictions),
        dataSourceId: undefined,
        baseline: { mean: 2, stdDev: 1 },
      });

      this.ctx.statusPanel?.updateFeed('Polymarket', { status: 'ok', itemCount: predictions.length });
      this.ctx.statusPanel?.updateApi('Polymarket', { status: 'ok' });
      dataFreshness.recordUpdate('polymarket', predictions.length);
      dataFreshness.recordUpdate('predictions', predictions.length);

      void this.runCorrelationAnalysis();
    } catch (error) {
      this.ctx.statusPanel?.updateFeed('Polymarket', { status: 'error', errorMessage: String(error) });
      this.ctx.statusPanel?.updateApi('Polymarket', { status: 'error' });
      supplementalBus.clear('predictions_deep');
      dataFreshness.recordError('polymarket', String(error));
      dataFreshness.recordError('predictions', String(error));
    }
  }

  async loadFredData(): Promise<void> {
    const economicPanel = this.ctx.panels['economic'] as EconomicPanel;
    const cbInfo = getCircuitBreakerCooldownInfo('FRED Economic');
    if (cbInfo.onCooldown) {
      economicPanel?.showRetrying(undefined, cbInfo.remainingSeconds);
      this.ctx.statusPanel?.updateApi('FRED', { status: 'error' });
      return;
    }

    try {
      economicPanel?.setLoading(true);
      const data = await fetchFredData();

      const postInfo = getCircuitBreakerCooldownInfo('FRED Economic');
      if (postInfo.onCooldown) {
        economicPanel?.showRetrying(undefined, postInfo.remainingSeconds);
        this.ctx.statusPanel?.updateApi('FRED', { status: 'error' });
        return;
      }

      if (data.length === 0) {
        if (!isFeatureAvailable('economicFred')) {
          economicPanel?.showConfigError(getMissingSecretMessage('FRED_API_KEY'));
          this.ctx.statusPanel?.updateApi('FRED', { status: 'error' });
          return;
        }
        economicPanel?.showRetrying();
        this.scheduleDelayedTask('economic:fred:retry', 20_000, 'economic', async () => {
          const retryData = await fetchFredData();
          if (retryData.length === 0) {
            economicPanel?.showError();
            this.ctx.statusPanel?.updateApi('FRED', { status: 'error' });
            return;
          }
          economicPanel?.update(retryData);
          this.ctx.statusPanel?.updateApi('FRED', { status: 'ok' });
          dataFreshness.recordUpdate('economic', retryData.length);
        });
        return;
      }

      economicPanel?.update(data);
      this.ctx.statusPanel?.updateApi('FRED', { status: 'ok' });
      dataFreshness.recordUpdate('economic', data.length);
    } catch {
      if (isFeatureAvailable('economicFred')) {
        economicPanel?.showRetrying();
        this.scheduleDelayedTask('economic:fred:retry', 20_000, 'economic', async () => {
          try {
            const retryData = await fetchFredData();
            if (retryData.length > 0) {
              economicPanel?.update(retryData);
              this.ctx.statusPanel?.updateApi('FRED', { status: 'ok' });
              dataFreshness.recordUpdate('economic', retryData.length);
              return;
            }
          } catch { /* fall through */ }
          this.ctx.statusPanel?.updateApi('FRED', { status: 'error' });
          economicPanel?.showError();
          economicPanel?.setLoading(false);
        });
        return;
      }
      this.ctx.statusPanel?.updateApi('FRED', { status: 'error' });
      economicPanel?.showError();
      economicPanel?.setLoading(false);
    }
  }

  async loadOilAnalytics(): Promise<void> {
    const economicPanel = this.ctx.panels['economic'] as EconomicPanel;
    try {
      const data = await fetchOilAnalytics();
      economicPanel?.updateOil(data);
      const hasData = !!(data.wtiPrice || data.brentPrice || data.usProduction || data.usInventory);
      this.ctx.statusPanel?.updateApi('EIA', { status: hasData ? 'ok' : 'error' });
      if (hasData) {
        const metricCount = [data.wtiPrice, data.brentPrice, data.usProduction, data.usInventory].filter(Boolean).length;
        dataFreshness.recordUpdate('oil', metricCount || 1);
      } else {
        dataFreshness.recordError('oil', 'Oil analytics returned no values');
      }
    } catch (e) {
      console.error('[App] Oil analytics failed:', e);
      this.ctx.statusPanel?.updateApi('EIA', { status: 'error' });
      dataFreshness.recordError('oil', String(e));
    }
  }

  async loadGovernmentSpending(): Promise<void> {
    const economicPanel = this.ctx.panels['economic'] as EconomicPanel;
    try {
      const data = await fetchRecentAwards({ daysBack: 7, limit: 15 });
      economicPanel?.updateSpending(data);
      this.ctx.statusPanel?.updateApi('USASpending', { status: data.awards?.length > 0 ? 'ok' : 'error' });
      if (data.awards?.length > 0) {
        dataFreshness.recordUpdate('spending', data.awards.length);
      } else {
        dataFreshness.recordError('spending', 'No awards returned');
      }
    } catch (e) {
      console.error('[App] Government spending failed:', e);
      this.ctx.statusPanel?.updateApi('USASpending', { status: 'error' });
      dataFreshness.recordError('spending', String(e));
    }
  }

  async loadBisData(): Promise<void> {
    const economicPanel = this.ctx.panels['economic'] as EconomicPanel;
    try {
      const data = await fetchBisData();
      economicPanel?.updateBis(data);
      const hasData = data.policyRates?.length > 0;
      this.ctx.statusPanel?.updateApi('BIS', { status: hasData ? 'ok' : 'error' });
      if (hasData) {
        dataFreshness.recordUpdate('bis', data.policyRates?.length ?? 0);
      }
    } catch (e) {
      console.error('[App] BIS data failed:', e);
      this.ctx.statusPanel?.updateApi('BIS', { status: 'error' });
      dataFreshness.recordError('bis', String(e));
    }
  }

  async loadTradePolicy(): Promise<void> {
    const tradePanel = this.ctx.panels['trade-policy'] as TradePolicyPanel | undefined;
    if (!tradePanel) return;

    try {
      const [restrictions, tariffs, flows, barriers] = await Promise.all([
        fetchTradeRestrictions([], 50),
        fetchTariffTrends('840', '156', '', 10),
        fetchTradeFlows('840', '156', 10),
        fetchTradeBarriers([], '', 50),
      ]);

      tradePanel.updateRestrictions(restrictions);
      tradePanel.updateTariffs(tariffs);
      tradePanel.updateFlows(flows);
      tradePanel.updateBarriers(barriers);

      const totalItems = restrictions.restrictions.length + (tariffs.datapoints?.length ?? 0) + flows.flows.length + barriers.barriers.length;
      const anyUnavailable = restrictions.upstreamUnavailable || tariffs.upstreamUnavailable || flows.upstreamUnavailable || barriers.upstreamUnavailable;

      this.ctx.statusPanel?.updateApi('WTO', { status: anyUnavailable ? 'warning' : totalItems > 0 ? 'ok' : 'error' });

      if (totalItems > 0) {
        dataFreshness.recordUpdate('wto_trade', totalItems);
      } else if (anyUnavailable) {
        dataFreshness.recordError('wto_trade', 'WTO upstream temporarily unavailable');
      }
    } catch (e) {
      console.error('[App] Trade policy failed:', e);
      this.ctx.statusPanel?.updateApi('WTO', { status: 'error' });
      dataFreshness.recordError('wto_trade', String(e));
    }
  }

  async loadSupplyChain(): Promise<void> {
    const scPanel = this.ctx.panels['supply-chain'] as SupplyChainPanel | undefined;
    if (!scPanel) return;

    try {
      const [shipping, chokepoints, minerals] = await Promise.allSettled([
        fetchShippingRates(),
        fetchChokepointStatus(),
        fetchCriticalMinerals(),
      ]);

      const shippingData = shipping.status === 'fulfilled' ? shipping.value : null;
      const chokepointData = chokepoints.status === 'fulfilled' ? chokepoints.value : null;
      const mineralsData = minerals.status === 'fulfilled' ? minerals.value : null;

      if (shippingData) scPanel.updateShippingRates(shippingData);
      if (chokepointData) scPanel.updateChokepointStatus(chokepointData);
      if (mineralsData) scPanel.updateCriticalMinerals(mineralsData);

      const chokepointSignals = chokepointData ? this.buildChokepointSignals(chokepointData) : [];
      const shippingSignals = shippingData ? this.buildShippingSignals(shippingData) : [];
      this.deps.publishSupplementalSignals({
        sourceId: 'chokepoints',
        sourceName: 'Chokepoint Status',
        signals: chokepointSignals,
        dataSourceId: undefined,
        baseline: { mean: 4, stdDev: 1.5 },
        itemCount: (chokepointData?.chokepoints.length || 0) + (shippingData?.indices.length || 0) + (mineralsData?.minerals.length || 0),
      });
      this.deps.publishSupplementalSignals({
        sourceId: 'shipping',
        sourceName: 'Shipping Rates',
        signals: shippingSignals,
        dataSourceId: undefined,
        baseline: { mean: 2, stdDev: 1 },
      });

      const totalItems = (shippingData?.indices.length || 0) + (chokepointData?.chokepoints.length || 0) + (mineralsData?.minerals.length || 0);
      const anyUnavailable = shippingData?.upstreamUnavailable || chokepointData?.upstreamUnavailable || mineralsData?.upstreamUnavailable;

      this.ctx.statusPanel?.updateApi('SupplyChain', { status: anyUnavailable ? 'warning' : totalItems > 0 ? 'ok' : 'error' });

      if (totalItems > 0) {
        dataFreshness.recordUpdate('supply_chain', totalItems);
      } else if (anyUnavailable) {
        dataFreshness.recordError('supply_chain', 'Supply chain upstream temporarily unavailable');
      }
    } catch (e) {
      console.error('[App] Supply chain failed:', e);
      this.ctx.statusPanel?.updateApi('SupplyChain', { status: 'error' });
      this.deps.clearSupplementalSignals('chokepoints', 'supply_chain', String(e));
      supplementalBus.clear('shipping');
    }
  }

  async loadSanctions(): Promise<void> {
    const panel = this.ctx.panels['sanctions-tracker'] as SanctionsTrackerPanel | undefined;
    if (!panel) return;

    try {
      const entities = await fetchSanctions();
      panel.setEntities(entities);
      this.deps.updateSearchIndex();
      this.ctx.statusPanel?.updateApi('Sanctions', { status: entities.length > 0 ? 'ok' : 'warning' });
      this.deps.publishSupplementalSignals({
        sourceId: 'sanctions',
        sourceName: 'Sanctions Radar',
        signals: this.buildSanctionsSignals(entities),
        dataSourceId: 'sanctions',
        baseline: { mean: 4, stdDev: 1.5 },
        itemCount: entities.length,
      });

      const sancMap = new Map<string, 'severe' | 'high' | 'moderate'>();
      for (const entity of entities) {
        for (const code of entity.countries) {
          if (!sancMap.has(code)) {
            sancMap.set(code, 'moderate');
          }
        }
      }
      const { SANCTIONED_COUNTRIES } = await import('@/config/geo');
      const NUMERIC_TO_ALPHA2: Record<number, string> = {
        408: 'KP', 728: 'SS', 760: 'SY', 364: 'IR', 643: 'RU',
        112: 'BY', 862: 'VE', 104: 'MM', 178: 'CG',
      };
      for (const [numKey, level] of Object.entries(SANCTIONED_COUNTRIES)) {
        const alpha2 = NUMERIC_TO_ALPHA2[Number(numKey)];
        if (alpha2) {
          sancMap.set(alpha2, level as 'severe' | 'high' | 'moderate');
        }
      }
      this.ctx.map?.setSanctionsCountries(sancMap);
    } catch (error) {
      console.error('[App] Sanctions load failed:', error);
      this.ctx.statusPanel?.updateApi('Sanctions', { status: 'error' });
      this.deps.clearSupplementalSignals('sanctions', 'sanctions', String(error));
    }
  }

  async loadSolarWeather(): Promise<void> {
    const panel = this.ctx.panels['solar-weather'] as { setData?: (data: SolarWeatherSnapshot) => void } | undefined;
    if (!panel) return;

    try {
      const snapshot = await fetchSolarWeather();
      panel.setData?.(snapshot);
      this.ctx.statusPanel?.updateApi('NOAA SWPC', { status: 'ok' });
      this.deps.publishSupplementalSignals({
        sourceId: 'solar',
        sourceName: 'Solar Weather',
        signals: this.buildSolarWeatherSignals(snapshot),
        dataSourceId: 'solar_weather',
        baseline: { mean: 1, stdDev: 0.75 },
        itemCount: snapshot.alerts.length || 1,
      });
    } catch (error) {
      console.error('[App] Solar weather failed:', error);
      this.ctx.statusPanel?.updateApi('NOAA SWPC', { status: 'error' });
      this.deps.clearSupplementalSignals('solar', 'solar_weather', String(error));
    }
  }

  async loadSatelliteFires(): Promise<void> {
    try {
      const fireResult = await fetchAllFires(1);
      if (fireResult.skipped) {
        this.ctx.panels['satellite-fires']?.showConfigError(
          getMissingFeatureSecretMessage('nasaFirms') ?? t('panels.satelliteFires.noData')
        );
        this.ctx.statusPanel?.updateApi('FIRMS', { status: 'error' });
        return;
      }
      const { regions, totalCount } = fireResult;
      if (totalCount > 0) {
        const flat = flattenFires(regions);
        const stats = computeRegionStats(regions);
        const satelliteFires = flat.map(f => ({
          lat: f.location?.latitude ?? 0,
          lon: f.location?.longitude ?? 0,
          brightness: f.brightness,
          frp: f.frp,
          region: f.region,
          acq_date: new Date(f.detectedAt).toISOString().slice(0, 10),
        }));

        signalAggregator.ingestSatelliteFires(satelliteFires);
        ingestSatelliteFiresForCII(satelliteFires);
        this.deps.refreshCiiAndBrief();

        this.ctx.map?.setFires(toMapFires(flat));

        (this.ctx.panels['satellite-fires'] as SatelliteFiresPanel)?.update(stats, totalCount);

        dataFreshness.recordUpdate('firms', totalCount);
      } else {
        ingestSatelliteFiresForCII([]);
        this.deps.refreshCiiAndBrief();
        (this.ctx.panels['satellite-fires'] as SatelliteFiresPanel)?.update([], 0);
      }
      this.ctx.statusPanel?.updateApi('FIRMS', { status: 'ok' });
    } catch (e) {
      console.warn('[App] FIRMS load failed:', e);
      (this.ctx.panels['satellite-fires'] as SatelliteFiresPanel)?.update([], 0);
      this.ctx.statusPanel?.updateApi('FIRMS', { status: 'error' });
      dataFreshness.recordError('firms', String(e));
    }
  }

  async loadPizzInt(): Promise<void> {
    try {
      const [status, tensions] = await Promise.all([
        fetchPizzIntStatus(),
        fetchGdeltTensions()
      ]);

      if (status.locationsMonitored === 0) {
        this.ctx.pizzintIndicator?.hide();
        this.ctx.statusPanel?.updateApi('PizzINT', { status: 'error' });
        dataFreshness.recordError('pizzint', 'No monitored locations returned');
        return;
      }

      this.ctx.pizzintIndicator?.show();
      this.ctx.pizzintIndicator?.updateStatus(status);
      this.ctx.pizzintIndicator?.updateTensions(tensions);
      this.ctx.statusPanel?.updateApi('PizzINT', { status: 'ok' });
      dataFreshness.recordUpdate('pizzint', Math.max(status.locationsMonitored, tensions.length));
    } catch (error) {
      console.error('[App] PizzINT load failed:', error);
      this.ctx.pizzintIndicator?.hide();
      this.ctx.statusPanel?.updateApi('PizzINT', { status: 'error' });
      dataFreshness.recordError('pizzint', String(error));
    }
  }

  updateMonitorResults(): void {
    const monitorPanel = this.ctx.panels['monitors'] as import('@/components').MonitorPanel;
    monitorPanel.renderResults(this.ctx.newsStore.allNews);
  }

  async runCorrelationAnalysis(): Promise<void> {
    try {
      if (this.ctx.intelligenceStore.latestClusters.length === 0 && this.ctx.newsStore.allNews.length > 0) {
        const { mlWorker } = await import('@/services/ml-worker');
        const { analysisWorker } = await import('@/services/analysis-worker');
        this.ctx.intelligenceStore.setClusters(mlWorker.isAvailable
          ? await import('@/services/clustering').then(({ clusterNewsHybrid }) => clusterNewsHybrid(this.ctx.newsStore.allNews))
          : await analysisWorker.clusterNews(this.ctx.newsStore.allNews));
      }

      if (this.ctx.intelligenceStore.latestClusters.length > 0) {
        const { ingestNewsForCII } = await import('@/services/country-instability');
        ingestNewsForCII(this.ctx.intelligenceStore.latestClusters);
        dataFreshness.recordUpdate('gdelt', this.ctx.intelligenceStore.latestClusters.length);
        this.deps.refreshCiiAndBrief();
      }

      const { analysisWorker } = await import('@/services/analysis-worker');
      const signals = await analysisWorker.analyzeCorrelations(
        this.ctx.intelligenceStore.latestClusters,
        this.ctx.intelligenceStore.latestPredictions,
        this.ctx.intelligenceStore.latestMarkets
      );

      let geoSignals: ReturnType<typeof import('@/services/geo-convergence').geoConvergenceToSignal>[] = [];
      const { isInLearningMode } = await import('@/services/country-instability');
      if (!isInLearningMode()) {
        const { detectGeoConvergence, geoConvergenceToSignal } = await import('@/services/geo-convergence');
        const geoAlerts = detectGeoConvergence(this.ctx.seenGeoAlerts);
        geoSignals = geoAlerts.map(geoConvergenceToSignal);
      }

      const { drainTrendingSignals } = await import('@/services/trending-keywords');
      const keywordSpikeSignals = drainTrendingSignals();
      const coreSignals = [...signals, ...geoSignals];
      const allSignals = [...coreSignals, ...keywordSpikeSignals];
      if (allSignals.length > 0) {
        const { addToSignalHistory } = await import('@/services/correlation');
        addToSignalHistory(allSignals);
      }
      const { showShellNotification } = await import('@/app/shell-notifications');
      for (const spike of keywordSpikeSignals) {
        showShellNotification(spike.title, 'info', 7000, 'top');
        this.ctx.notificationCenter?.addTrendingSpike(spike);
      }
      if (coreSignals.length > 0) {
        this.ctx.signalModal?.show(coreSignals);
      }
    } catch (error) {
      console.error('[App] Correlation analysis failed:', error);
    }
  }

  private buildSanctionsSignals(entities: Awaited<ReturnType<typeof fetchSanctions>>): SupplementalSignal[] {
    const byCountry = new Map<string, number>();
    for (const entity of entities) {
      for (const country of entity.countries) {
        if (!country || country === 'UNKNOWN') continue;
        byCountry.set(country, (byCountry.get(country) ?? 0) + 1);
      }
    }

    return [...byCountry.entries()].map(([country, count]) => ({
      sourceId: 'sanctions',
      sourceName: 'Sanctions Radar',
      country,
      value: Math.min(100, count * 20),
      severity: count >= 3 ? 'critical' : count >= 2 ? 'high' : 'medium',
      label: `${count} sanctioned entities`,
      timestamp: new Date(),
      tags: ['geopolitical', 'sanctions'],
    }));
  }

  private buildChokepointSignals(data: GetChokepointStatusResponse): SupplementalSignal[] {
    const fallbackCountries: Record<string, string> = {
      suez: 'EG',
      panama: 'PA',
      hormuz: 'IR',
      malacca: 'MY',
      'bab el-mandeb': 'YE',
    };

    return data.chokepoints.map(cp => {
      const matchedCountry = matchCountryNamesInText(`${cp.name} ${cp.affectedRoutes.join(' ')}`)[0]
        || Object.entries(fallbackCountries).find(([key]) => cp.name.toLowerCase().includes(key))?.[1]
        || 'XX';
      const severity: SupplementalSignal['severity'] = cp.disruptionScore >= 80 ? 'critical'
        : cp.disruptionScore >= 60 ? 'high'
        : cp.disruptionScore >= 40 ? 'medium'
        : 'low';
      return {
        sourceId: 'chokepoints',
        sourceName: 'Chokepoint Status',
        country: matchedCountry,
        value: cp.disruptionScore,
        severity,
        label: `${cp.name} disruption score ${cp.disruptionScore}`,
        timestamp: new Date(),
        lat: cp.lat,
        lon: cp.lon,
        tags: ['supply_chain'],
      };
    });
  }

  private buildShippingSignals(data: GetShippingRatesResponse): SupplementalSignal[] {
    const laneCountries: Array<{ match: RegExp; countries: string[] }> = [
      { match: /china.*us west/i, countries: ['CN', 'US'] },
      { match: /china.*us east/i, countries: ['CN', 'US'] },
      { match: /china.*europe/i, countries: ['CN', 'DE'] },
      { match: /europe.*us east/i, countries: ['DE', 'US'] },
    ];

    return data.indices.flatMap(index => {
      const route = laneCountries.find(entry => entry.match.test(index.name));
      const severity: SupplementalSignal['severity'] = index.changePct >= 50 ? 'critical'
        : index.changePct >= 20 || index.spikeAlert ? 'high'
        : index.changePct >= 10 ? 'medium'
        : 'low';
      return (route?.countries ?? ['XX']).map(country => ({
        sourceId: 'shipping',
        sourceName: 'Shipping Rates',
        country,
        value: Math.max(0, Math.min(100, index.changePct + 50)),
        severity,
        label: `${index.name} ${index.changePct >= 0 ? '+' : ''}${index.changePct.toFixed(1)}%`,
        timestamp: new Date(),
        tags: ['supply_chain'],
      }));
    });
  }

  private buildPredictionSignals(predictions: PredictionMarket[]): SupplementalSignal[] {
    return predictions
      .filter(prediction => (prediction.volume ?? 0) >= 1_000_000)
      .flatMap(prediction => {
        const countries = matchCountryNamesInText(prediction.title);
        if (countries.length === 0) return [];

        const lower = prediction.title.toLowerCase();
        const instabilitySignal = /(war|conflict|ceasefire|election|sanction|regime|collapse|invasion|strike)/.test(lower);
        if (!instabilitySignal) return [];

        const severity: SupplementalSignal['severity'] = (prediction.volume ?? 0) >= 5_000_000 ? 'critical' : 'high';
        return countries.map(country => ({
          sourceId: 'predictions_deep',
          sourceName: 'Prediction Markets',
          country,
          value: Math.min(100, Math.round(prediction.yesPrice)),
          severity,
          label: `${Math.round(prediction.yesPrice)}% · ${(prediction.volume ?? 0) >= 1_000_000 ? `$${((prediction.volume ?? 0) / 1_000_000).toFixed(1)}M` : 'high volume'}`,
          timestamp: new Date(),
          tags: ['signal', 'markets'],
        }));
      });
  }

  private buildSolarWeatherSignals(snapshot: SolarWeatherSnapshot): SupplementalSignal[] {
    const severity: SupplementalSignal['severity'] = snapshot.kpIndex >= 7 ? 'critical'
      : snapshot.kpIndex >= 5 ? 'high'
      : snapshot.kpIndex >= 4 ? 'medium'
      : 'low';

    return [{
      sourceId: 'solar',
      sourceName: 'Solar Weather',
      country: 'XX',
      value: Math.min(100, snapshot.kpIndex * 12),
      severity,
      label: `Kp ${snapshot.kpIndex.toFixed(1)}${snapshot.solarWindSpeed ? ` · wind ${snapshot.solarWindSpeed.toFixed(0)} km/s` : ''}`,
      timestamp: new Date(snapshot.fetchedAt),
      tags: ['space', 'infra'],
    }];
  }
}
