import type { AppContext } from '@/app/app-context';
import type { SupplementalSignal } from '@/services/supplemental-signal-bus';
import type { DataSourceId } from '@/services/data-freshness';
import {
  fetchInternetOutages,
  fetchProtestEvents,
  getProtestStatus,
  fetchMilitaryFlights,
  fetchMilitaryVessels,
  initMilitaryVesselStream,
  isMilitaryVesselTrackingConfigured,
  fetchUSNIFleetReport,
  fetchUcdpClassifications,
  fetchHapiSummary,
  fetchUcdpEvents,
  deduplicateAgainstAcled,
  fetchUnhcrPopulation,
  fetchClimateAnomalies,
  fetchIranEvents,
  fetchAisSignals,
  getAisStatus,
  fetchCableActivity,
  fetchCableHealth,
  fetchFlightDelays,
  fetchCyberThreats,
  fetchCachedTheaterPosture,
} from '@/services';
import { fetchGpsInterference } from '@/services/gps-interference';
import { fetchOrefAlerts } from '@/services/oref-alerts';
import { fetchSecurityAdvisories } from '@/services/security-advisories';
import { fetchTelegramFeed } from '@/services/telegram-intel';
import { fetchLiveAnomalies } from '@/services/temporal-baseline';
import { dispatchOrefBreakingAlert } from '@/services/breaking-news-alerts';
import { signalAggregator } from '@/services/signal-aggregator';
import { supplementalBus } from '@/services/supplemental-signal-bus';
import { dataFreshness } from '@/services/data-freshness';
import {
  resetHotspotActivity,
  ingestOutagesForCII,
  ingestProtestsForCII,
  ingestUcdpForCII,
  ingestHapiForCII,
  ingestMilitaryForCII,
  ingestDisplacementForCII,
  ingestClimateForCII,
  ingestStrikesForCII,
  ingestOrefForCII,
  ingestAviationForCII,
  ingestAdvisoriesForCII,
  ingestGpsJammingForCII,
  ingestAisDisruptionsForCII,
  ingestCyberThreatsForCII,
  ingestTemporalAnomaliesForCII,
  ingestGovernanceBaselines,
  ingestEconomicVulnerability,
  ingestVDemForCII,
  ingestPolityForCII,
  hasIntelligenceSignalsLoaded,
  isInLearningMode,
  markCoreIntelligenceSourceSettled,
  calculateCII,
} from '@/services/country-instability';
import { ingestFlights, ingestVessels, ingestProtests } from '@/services/geo-convergence';
import { analyzeFlightsForSurge, surgeAlertToSignal, detectForeignMilitaryPresence, foreignPresenceToSignal } from '@/services/military-surge';
import { updateAndCheck } from '@/services/temporal-baseline';
import { addToSignalHistory } from '@/services/correlation';
import { enrichEventsWithExposure } from '@/services/population-exposure';
import { onOrefAlertsUpdate, startOrefPolling, stopOrefPolling } from '@/services/oref-alerts';
import { savePersistedLiveCountryScores } from '@/services/cached-risk-scores';
import { isDesktopRuntime } from '@/services/runtime';
import { getMissingFeatureSecretMessage } from '@/services/runtime-config';
import { debounce } from '@/utils';
import { getHydratedData } from '@/services/bootstrap';
import type { UcdpEventsPanel, StrategicPosturePanel, CIIPanel } from '@/components';

const CYBER_LAYER_ENABLED = import.meta.env.VITE_ENABLE_CYBER_LAYER === 'true';

export interface SignalPublisherDeps {
  callPanel: (key: string, method: string, ...args: unknown[]) => void;
  shouldFetchIntelligenceSource: (source: string, isStatic?: boolean) => boolean;
  markIntelligenceSourceFetched: (source: string) => void;
  refreshCiiAndBrief: (forceLocal?: boolean) => void;
  refreshOpenCountryBrief?: () => void;
  updateSearchIndex: () => void;
  renderCriticalBanner?: (postures: unknown[]) => void;
}

export interface PublishSupplementalOptions {
  sourceId: string;
  sourceName: string;
  signals: SupplementalSignal[];
  dataSourceId?: DataSourceId;
  baseline?: { mean: number; stdDev: number };
  itemCount?: number;
}

export class SignalPublisher {
  private ctx: AppContext;
  private deps: SignalPublisherDeps;
  private readonly debouncedRefreshCiiAndBrief: (...args: unknown[]) => void;
  private supplementalListenersWired = false;

  constructor(ctx: AppContext, deps: SignalPublisherDeps) {
    this.ctx = ctx;
    this.deps = deps;
    this.debouncedRefreshCiiAndBrief = debounce((...args: unknown[]) => {
      const [forceLocal = false] = args as [boolean?];
      this.refreshCiiAndBriefInternal(forceLocal);
    }, 500);
  }

  init(): void {
    if (!this.supplementalListenersWired) {
      this.supplementalListenersWired = true;
      supplementalBus.onEmit((sourceId, signals) => {
        signalAggregator.ingestGeneric(sourceId, signals);
      });
      supplementalBus.onEmit((_sourceId, signals) => {
        signals
          .filter(signal => signal.severity === 'high' || signal.severity === 'critical')
          .slice(0, 12)
          .forEach(signal => {
            import('@/services/cross-module-integration').then(({ createSupplementalAlert }) => {
              createSupplementalAlert(signal);
            });
          });
      });
    }
  }

  destroy(): void {
    stopOrefPolling();
  }

  publishSupplementalSignals(options: PublishSupplementalOptions): void {
    if (options.baseline) {
      supplementalBus.registerBaseline(options.sourceId, options.baseline.mean, options.baseline.stdDev, options.sourceName);
    }
    supplementalBus.emit(options.sourceId, options.signals);
    if (options.dataSourceId) {
      const itemCount = options.itemCount ?? options.signals.length;
      if (itemCount > 0) {
        dataFreshness.recordUpdate(options.dataSourceId, itemCount);
      }
    }
  }

  clearSupplementalSignals(sourceId: string, dataSourceId: DataSourceId | undefined, error: string): void {
    supplementalBus.clear(sourceId);
    if (dataSourceId) dataFreshness.recordError(dataSourceId, error);
  }

  private shouldShowIntelligenceNotifications(): boolean {
    return !this.ctx.isMobile;
  }

  private refreshCiiAndBriefInternal(forceLocal = false): void {
    const panel = this.ctx.panels['cii'] as CIIPanel | undefined;
    panel?.refresh(forceLocal);
    this.deps.refreshOpenCountryBrief?.();
    const scores = calculateCII();
    if (hasIntelligenceSignalsLoaded() && scores.some((score) => score.score > 0)) {
      savePersistedLiveCountryScores(scores);
    }
    this.ctx.mapStore.map?.setCIIScores(scores.map(s => ({ code: s.code, score: s.score, level: s.level })));
    this.ctx.mapStore.map?.setLayerReady('ciiChoropleth', scores.length > 0);
  }

  refreshCiiAndBrief(forceLocal = false): void {
    (this.debouncedRefreshCiiAndBrief as ReturnType<typeof debounce> & { cancel?: () => void }).cancel?.();
    this.debouncedRefreshCiiAndBrief(forceLocal);
  }

  async loadIntelligenceSignals(): Promise<void> {
    resetHotspotActivity();
    const tasks: Promise<void>[] = [];
    const hydratedUcdp = getHydratedData('ucdpEvents') as import('@/generated/client/worldmonitor/conflict/v1/service_client').ListUcdpEventsResponse | undefined;

    tasks.push((async () => {
      let ok = false;
      let itemCount = 0;
      try {
        const outages = await fetchInternetOutages();
        this.ctx.intelligenceStore.updateCache({ outages });
        ingestOutagesForCII(outages);
        signalAggregator.ingestOutages(outages);
        ok = true;
        itemCount = outages.length;
        dataFreshness.recordUpdate('outages', outages.length);
        if (this.ctx.mapLayers.outages) {
          this.ctx.mapStore.map?.setOutages(outages);
          this.ctx.mapStore.map?.setLayerReady('outages', outages.length > 0);
          this.ctx.statusPanel?.updateFeed('NetBlocks', { status: 'ok', itemCount: outages.length });
        }
      } catch (error) {
        console.error('[Intelligence] Outages fetch failed:', error);
        dataFreshness.recordError('outages', String(error));
      } finally {
        markCoreIntelligenceSourceSettled('outages', { ok, itemCount });
      }
    })());

    const protestsTask = (async (): Promise<import('@/types').SocialUnrestEvent[]> => {
      let ok = false;
      let itemCount = 0;
      try {
        const protestData = await fetchProtestEvents();
        this.ctx.intelligenceStore.updateCache({ protests: protestData });
        ingestProtests(protestData.events);
        ingestProtestsForCII(protestData.events);
        signalAggregator.ingestProtests(protestData.events);
        ok = true;
        itemCount = protestData.events.length;
        const protestCount = protestData.sources.acled + protestData.sources.gdelt;
        if (protestCount > 0) dataFreshness.recordUpdate('acled', protestCount);
        if (protestData.sources.gdelt > 0) dataFreshness.recordUpdate('gdelt', protestData.sources.gdelt);
        if (protestData.sources.gdelt > 0) dataFreshness.recordUpdate('gdelt_doc', protestData.sources.gdelt);
        if (this.ctx.mapLayers.protests) {
          this.ctx.mapStore.map?.setProtests(protestData.events);
          this.ctx.mapStore.map?.setLayerReady('protests', protestData.events.length > 0);
          const status = getProtestStatus();
          this.ctx.statusPanel?.updateFeed('Protests', {
            status: 'ok',
            itemCount: protestData.events.length,
            errorMessage: status.acledConfigured === false ? 'ACLED not configured - using GDELT only' : undefined,
          });
        }
        return protestData.events;
      } catch (error) {
        console.error('[Intelligence] Protests fetch failed:', error);
        dataFreshness.recordError('acled', String(error));
        return [];
      } finally {
        markCoreIntelligenceSourceSettled('protests', { ok, itemCount });
      }
    })();
    tasks.push(protestsTask.then(() => undefined));

    tasks.push((async () => {
      if (!this.deps.shouldFetchIntelligenceSource('ucdp', true)) return;
      try {
        const classifications = await fetchUcdpClassifications(hydratedUcdp);
        this.deps.markIntelligenceSourceFetched('ucdp');
        ingestUcdpForCII(classifications);
        if (classifications.size > 0) dataFreshness.recordUpdate('ucdp', classifications.size);
      } catch (error) {
        console.error('[Intelligence] UCDP fetch failed:', error);
        dataFreshness.recordError('ucdp', String(error));
      }
    })());

    tasks.push((async () => {
      if (!this.deps.shouldFetchIntelligenceSource('hapi', true)) return;
      try {
        const summaries = await fetchHapiSummary();
        this.deps.markIntelligenceSourceFetched('hapi');
        ingestHapiForCII(summaries);
        if (summaries.size > 0) dataFreshness.recordUpdate('hapi', summaries.size);
      } catch (error) {
        console.error('[Intelligence] HAPI fetch failed:', error);
        dataFreshness.recordError('hapi', String(error));
      }
    })());

    tasks.push((async () => {
      let ok = false;
      let itemCount = 0;
      try {
        if (isMilitaryVesselTrackingConfigured()) {
          initMilitaryVesselStream();
        }
        const [flightData, vesselData] = await Promise.all([
          fetchMilitaryFlights(),
          fetchMilitaryVessels(),
        ]);
        this.ctx.intelligenceStore.updateCache({ military: {
          flights: flightData.flights,
          flightClusters: flightData.clusters,
          vessels: vesselData.vessels,
          vesselClusters: vesselData.clusters,
        } });
        fetchUSNIFleetReport().then((report) => {
          if (report) this.ctx.intelligenceStore.updateCache({ usniFleet: report });
        }).catch(() => {});
        ingestFlights(flightData.flights);
        ingestVessels(vesselData.vessels);
        ingestMilitaryForCII(flightData.flights, vesselData.vessels);
        signalAggregator.ingestFlights(flightData.flights);
        signalAggregator.ingestVessels(vesselData.vessels);
        ok = true;
        itemCount = flightData.flights.length + vesselData.vessels.length;
        dataFreshness.recordUpdate('opensky', flightData.flights.length);
        updateAndCheck([
          { type: 'military_flights', region: 'global', count: flightData.flights.length },
          { type: 'vessels', region: 'global', count: vesselData.vessels.length },
        ]).then(anomalies => {
          if (anomalies.length > 0) {
            signalAggregator.ingestTemporalAnomalies(anomalies);
            ingestTemporalAnomaliesForCII(anomalies);
            this.deps.refreshCiiAndBrief();
          }
        }).catch(() => { });
        if (this.ctx.mapLayers.military) {
          this.ctx.mapStore.map?.setMilitaryFlights(flightData.flights, flightData.clusters);
          this.ctx.mapStore.map?.setMilitaryVessels(vesselData.vessels, vesselData.clusters);
          this.ctx.mapStore.map?.updateMilitaryForEscalation(flightData.flights, vesselData.vessels);
          const militaryCount = flightData.flights.length + vesselData.vessels.length;
          this.ctx.statusPanel?.updateFeed('Military', {
            status: militaryCount > 0 ? 'ok' : 'warning',
            itemCount: militaryCount,
          });
        }
        if (!isInLearningMode()) {
          const surgeAlerts = analyzeFlightsForSurge(flightData.flights);
          if (surgeAlerts.length > 0) {
            const surgeSignals = surgeAlerts.map(surgeAlertToSignal);
            addToSignalHistory(surgeSignals);
            if (this.shouldShowIntelligenceNotifications()) this.ctx.signalModal?.show(surgeSignals);
          }
          const foreignAlerts = detectForeignMilitaryPresence(flightData.flights);
          if (foreignAlerts.length > 0) {
            const foreignSignals = foreignAlerts.map(foreignPresenceToSignal);
            addToSignalHistory(foreignSignals);
            if (this.shouldShowIntelligenceNotifications()) this.ctx.signalModal?.show(foreignSignals);
          }
        }
      } catch (error) {
        console.error('[Intelligence] Military fetch failed:', error);
        dataFreshness.recordError('opensky', String(error));
      } finally {
        markCoreIntelligenceSourceSettled('military', { ok, itemCount });
      }
    })());

    tasks.push((async () => {
      try {
        const protestEvents = await protestsTask;
        let result = await fetchUcdpEvents(hydratedUcdp);
        for (let attempt = 1; attempt < 3 && !result.success; attempt++) {
          await new Promise(r => setTimeout(r, 15_000));
          result = await fetchUcdpEvents();
        }
        if (!result.success) {
          dataFreshness.recordError('ucdp_events', 'UCDP events unavailable (retaining prior event state)');
          return;
        }
        const acledEvents = protestEvents.map(e => ({
          latitude: e.lat, longitude: e.lon, event_date: e.time.toISOString(), fatalities: e.fatalities ?? 0,
        }));
        const events = deduplicateAgainstAcled(result.data, acledEvents);
        (this.ctx.panels['ucdp-events'] as UcdpEventsPanel)?.setEvents(events);
        if (this.ctx.mapLayers.ucdpEvents) {
          this.ctx.mapStore.map?.setUcdpEvents(events);
        }
        if (events.length > 0) dataFreshness.recordUpdate('ucdp_events', events.length);
      } catch (error) {
        console.error('[Intelligence] UCDP events fetch failed:', error);
        dataFreshness.recordError('ucdp_events', String(error));
      }
    })());

    tasks.push((async () => {
      try {
        const unhcrResult = await fetchUnhcrPopulation();
        if (!unhcrResult.ok) {
          dataFreshness.recordError('unhcr', 'UNHCR displacement unavailable (retaining prior displacement state)');
          return;
        }
        const data = unhcrResult.data;
        this.deps.callPanel('displacement', 'setData', data);
        ingestDisplacementForCII(data.countries);
        if (this.ctx.mapLayers.displacement && data.topFlows) {
          this.ctx.mapStore.map?.setDisplacementFlows(data.topFlows);
        }
        if (data.countries.length > 0) dataFreshness.recordUpdate('unhcr', data.countries.length);
      } catch (error) {
        console.error('[Intelligence] UNHCR displacement fetch failed:', error);
        dataFreshness.recordError('unhcr', String(error));
      }
    })());

    tasks.push((async () => {
      try {
        const climateResult = await fetchClimateAnomalies();
        if (!climateResult.ok) {
          dataFreshness.recordError('climate', 'Climate anomalies unavailable (retaining prior climate state)');
          return;
        }
        const anomalies = climateResult.anomalies;
        this.deps.callPanel('climate', 'setAnomalies', anomalies);
        ingestClimateForCII(anomalies);
        if (this.ctx.mapLayers.climate) {
          this.ctx.mapStore.map?.setClimateAnomalies(anomalies);
        }
        if (anomalies.length > 0) dataFreshness.recordUpdate('climate', anomalies.length);
      } catch (error) {
        console.error('[Intelligence] Climate anomalies fetch failed:', error);
        dataFreshness.recordError('climate', String(error));
      }
    })());

    tasks.push(this.loadSecurityAdvisories());
    tasks.push(this.loadTelegramIntel());

    tasks.push((async () => {
      try {
        const data = await fetchOrefAlerts();
        this.deps.callPanel('oref-sirens', 'setData', data);
        const alertCount = data.alerts?.length ?? 0;
        const historyCount24h = data.historyCount24h ?? 0;
        ingestOrefForCII(alertCount, historyCount24h);
        this.ctx.intelligenceStore.updateCache({ orefAlerts: { alertCount, historyCount24h } });
        if (data.alerts?.length) dispatchOrefBreakingAlert(data.alerts);
        onOrefAlertsUpdate((update) => {
          this.deps.callPanel('oref-sirens', 'setData', update);
          const updAlerts = update.alerts?.length ?? 0;
          const updHistory = update.historyCount24h ?? 0;
          ingestOrefForCII(updAlerts, updHistory);
          this.ctx.intelligenceStore.updateCache({ orefAlerts: { alertCount: updAlerts, historyCount24h: updHistory } });
          if (update.alerts?.length) dispatchOrefBreakingAlert(update.alerts);
        });
        startOrefPolling();
      } catch (error) {
        console.error('[Intelligence] OREF alerts fetch failed:', error);
      }
    })());

    if (!isDesktopRuntime()) {
      tasks.push((async () => {
        try {
          const data = await fetchGpsInterference();
          if (!data) {
            ingestGpsJammingForCII([]);
            this.ctx.mapStore.map?.setLayerReady('gpsJamming', false);
            return;
          }
          ingestGpsJammingForCII(data.hexes);
          if (this.ctx.mapLayers.gpsJamming) {
            this.ctx.mapStore.map?.setGpsJamming(data.hexes);
            this.ctx.mapStore.map?.setLayerReady('gpsJamming', data.hexes.length > 0);
          }
          this.ctx.statusPanel?.updateFeed('GPS Jam', { status: 'ok', itemCount: data.hexes.length });
          dataFreshness.recordUpdate('gpsjam', data.hexes.length);
        } catch (error) {
          this.ctx.mapStore.map?.setLayerReady('gpsJamming', false);
          this.ctx.statusPanel?.updateFeed('GPS Jam', { status: 'error' });
          dataFreshness.recordError('gpsjam', String(error));
        }
      })());
    }

    await Promise.allSettled(tasks);

    try {
      const ucdpEvts = (this.ctx.panels['ucdp-events'] as UcdpEventsPanel)?.getEvents?.() || [];
      const events = [
        ...(this.ctx.intelligenceStore.cache.protests?.events || []).slice(0, 10).map(e => ({
          id: e.id, lat: e.lat, lon: e.lon, type: 'conflict' as const, name: e.title || 'Protest',
        })),
        ...ucdpEvts.slice(0, 10).map(e => ({
          id: e.id, lat: e.latitude, lon: e.longitude, type: e.type_of_violence as string, name: `${e.side_a} vs ${e.side_b}`,
        })),
      ];
      if (events.length > 0) {
        const exposures = await enrichEventsWithExposure(events);
        this.deps.callPanel('population-exposure', 'setExposures', exposures);
        if (exposures.length > 0) dataFreshness.recordUpdate('worldpop', exposures.length);
      } else {
        this.deps.callPanel('population-exposure', 'setExposures', []);
      }
    } catch (error) {
      console.error('[Intelligence] Population exposure fetch failed:', error);
      dataFreshness.recordError('worldpop', String(error));
    }

    this.deps.refreshCiiAndBrief(true);
    console.log('[Intelligence] All signals loaded for CII calculation');
  }

  async loadMilitary(): Promise<void> {
    if (this.ctx.intelligenceStore.cache.military) {
      const { flights, flightClusters, vessels, vesselClusters } = this.ctx.intelligenceStore.cache.military;
      this.ctx.mapStore.map?.setMilitaryFlights(flights, flightClusters);
      this.ctx.mapStore.map?.setMilitaryVessels(vessels, vesselClusters);
      this.ctx.mapStore.map?.updateMilitaryForEscalation(flights, vessels);
      this.loadCachedPosturesForBanner();
      const insightsPanel = this.ctx.panels['insights'] as import('@/components').InsightsPanel | undefined;
      insightsPanel?.setMilitaryFlights(flights);
      const hasData = flights.length > 0 || vessels.length > 0;
      this.ctx.mapStore.map?.setLayerReady('military', hasData);
      const militaryCount = flights.length + vessels.length;
      this.ctx.statusPanel?.updateFeed('Military', {
        status: militaryCount > 0 ? 'ok' : 'warning',
        itemCount: militaryCount,
        errorMessage: militaryCount === 0 ? 'No military activity in view' : undefined,
      });
      this.ctx.statusPanel?.updateApi('OpenSky', { status: 'ok' });
      return;
    }
    try {
      if (isMilitaryVesselTrackingConfigured()) {
        initMilitaryVesselStream();
      }
      const [flightData, vesselData] = await Promise.all([
        fetchMilitaryFlights(),
        fetchMilitaryVessels(),
      ]);
      this.ctx.intelligenceStore.updateCache({ military: {
        flights: flightData.flights,
        flightClusters: flightData.clusters,
        vessels: vesselData.vessels,
        vesselClusters: vesselData.clusters,
      } });
      fetchUSNIFleetReport().then((report) => {
        if (report) this.ctx.intelligenceStore.updateCache({ usniFleet: report });
      }).catch(() => {});
      this.ctx.mapStore.map?.setMilitaryFlights(flightData.flights, flightData.clusters);
      this.ctx.mapStore.map?.setMilitaryVessels(vesselData.vessels, vesselData.clusters);
      ingestFlights(flightData.flights);
      ingestVessels(vesselData.vessels);
      ingestMilitaryForCII(flightData.flights, vesselData.vessels);
      signalAggregator.ingestFlights(flightData.flights);
      signalAggregator.ingestVessels(vesselData.vessels);
      updateAndCheck([
        { type: 'military_flights', region: 'global', count: flightData.flights.length },
        { type: 'vessels', region: 'global', count: vesselData.vessels.length },
      ]).then(anomalies => {
        if (anomalies.length > 0) {
          signalAggregator.ingestTemporalAnomalies(anomalies);
          ingestTemporalAnomaliesForCII(anomalies);
          this.deps.refreshCiiAndBrief();
        }
      }).catch(() => { });
      this.ctx.mapStore.map?.updateMilitaryForEscalation(flightData.flights, vesselData.vessels);
      this.deps.refreshCiiAndBrief();
      if (!isInLearningMode()) {
        const surgeAlerts = analyzeFlightsForSurge(flightData.flights);
        if (surgeAlerts.length > 0) {
          const surgeSignals = surgeAlerts.map(surgeAlertToSignal);
          addToSignalHistory(surgeSignals);
          if (this.shouldShowIntelligenceNotifications()) this.ctx.signalModal?.show(surgeSignals);
        }
        const foreignAlerts = detectForeignMilitaryPresence(flightData.flights);
        if (foreignAlerts.length > 0) {
          const foreignSignals = foreignAlerts.map(foreignPresenceToSignal);
          addToSignalHistory(foreignSignals);
          if (this.shouldShowIntelligenceNotifications()) this.ctx.signalModal?.show(foreignSignals);
        }
      }

      this.loadCachedPosturesForBanner();
      const insightsPanel = this.ctx.panels['insights'] as import('@/components').InsightsPanel | undefined;
      insightsPanel?.setMilitaryFlights(flightData.flights);

      const hasData = flightData.flights.length > 0 || vesselData.vessels.length > 0;
      this.ctx.mapStore.map?.setLayerReady('military', hasData);
      const militaryCount = flightData.flights.length + vesselData.vessels.length;
      this.ctx.statusPanel?.updateFeed('Military', {
        status: militaryCount > 0 ? 'ok' : 'warning',
        itemCount: militaryCount,
        errorMessage: militaryCount === 0 ? 'No military activity in view' : undefined,
      });
      this.ctx.statusPanel?.updateApi('OpenSky', { status: 'ok' });
      dataFreshness.recordUpdate('opensky', flightData.flights.length);
    } catch (error) {
      this.ctx.mapStore.map?.setLayerReady('military', false);
      this.ctx.statusPanel?.updateFeed('Military', { status: 'error', errorMessage: String(error) });
      this.ctx.statusPanel?.updateApi('OpenSky', { status: 'error' });
      dataFreshness.recordError('opensky', String(error));
    }
  }

  async loadProtests(): Promise<void> {
    if (this.ctx.intelligenceStore.cache.protests) {
      const protestData = this.ctx.intelligenceStore.cache.protests;
      this.ctx.mapStore.map?.setProtests(protestData.events);
      this.ctx.mapStore.map?.setLayerReady('protests', protestData.events.length > 0);
      const status = getProtestStatus();
      this.ctx.statusPanel?.updateFeed('Protests', {
        status: 'ok',
        itemCount: protestData.events.length,
        errorMessage: status.acledConfigured === false ? 'ACLED not configured - using GDELT only' : undefined,
      });
      if (status.acledConfigured === true) {
        this.ctx.statusPanel?.updateApi('ACLED', { status: 'ok' });
      } else if (status.acledConfigured === null) {
        this.ctx.statusPanel?.updateApi('ACLED', { status: 'warning' });
      }
      this.ctx.statusPanel?.updateApi('GDELT Doc', { status: 'ok' });
      if (protestData.sources.gdelt > 0) dataFreshness.recordUpdate('gdelt_doc', protestData.sources.gdelt);
      return;
    }
    try {
      const protestData = await fetchProtestEvents();
      this.ctx.intelligenceStore.updateCache({ protests: protestData });
      this.ctx.mapStore.map?.setProtests(protestData.events);
      this.ctx.mapStore.map?.setLayerReady('protests', protestData.events.length > 0);
      ingestProtests(protestData.events);
      ingestProtestsForCII(protestData.events);
      signalAggregator.ingestProtests(protestData.events);
      const protestCount = protestData.sources.acled + protestData.sources.gdelt;
      if (protestCount > 0) dataFreshness.recordUpdate('acled', protestCount);
      if (protestData.sources.gdelt > 0) dataFreshness.recordUpdate('gdelt', protestData.sources.gdelt);
      if (protestData.sources.gdelt > 0) dataFreshness.recordUpdate('gdelt_doc', protestData.sources.gdelt);
      this.deps.refreshCiiAndBrief();
      const status = getProtestStatus();
      this.ctx.statusPanel?.updateFeed('Protests', {
        status: 'ok',
        itemCount: protestData.events.length,
        errorMessage: status.acledConfigured === false ? 'ACLED not configured - using GDELT only' : undefined,
      });
      if (status.acledConfigured === true) {
        this.ctx.statusPanel?.updateApi('ACLED', { status: 'ok' });
      } else if (status.acledConfigured === null) {
        this.ctx.statusPanel?.updateApi('ACLED', { status: 'warning' });
      }
      this.ctx.statusPanel?.updateApi('GDELT Doc', { status: 'ok' });
    } catch (error) {
      this.ctx.mapStore.map?.setLayerReady('protests', false);
      this.ctx.statusPanel?.updateFeed('Protests', { status: 'error', errorMessage: String(error) });
      this.ctx.statusPanel?.updateApi('ACLED', { status: 'error' });
      this.ctx.statusPanel?.updateApi('GDELT Doc', { status: 'error' });
      dataFreshness.recordError('gdelt_doc', String(error));
    }
  }

  async loadOutages(): Promise<void> {
    if (this.ctx.intelligenceStore.cache.outages) {
      const outages = this.ctx.intelligenceStore.cache.outages;
      this.ctx.mapStore.map?.setOutages(outages);
      this.ctx.mapStore.map?.setLayerReady('outages', outages.length > 0);
      this.ctx.statusPanel?.updateFeed('NetBlocks', { status: 'ok', itemCount: outages.length });
      return;
    }
    try {
      const outages = await fetchInternetOutages();
      this.ctx.intelligenceStore.updateCache({ outages });
      this.ctx.mapStore.map?.setOutages(outages);
      this.ctx.mapStore.map?.setLayerReady('outages', outages.length > 0);
      ingestOutagesForCII(outages);
      signalAggregator.ingestOutages(outages);
      this.ctx.statusPanel?.updateFeed('NetBlocks', { status: 'ok', itemCount: outages.length });
      dataFreshness.recordUpdate('outages', outages.length);
    } catch (error) {
      this.ctx.mapStore.map?.setLayerReady('outages', false);
      this.ctx.statusPanel?.updateFeed('NetBlocks', { status: 'error' });
      dataFreshness.recordError('outages', String(error));
    }
  }

  async loadCyberThreats(): Promise<void> {
    if (!CYBER_LAYER_ENABLED) {
      this.ctx.mapLayers.cyberThreats = false;
      this.ctx.mapStore.map?.setLayerReady('cyberThreats', false);
      return;
    }

    if (this.ctx.intelligenceStore.cyberThreatsCache) {
      this.ctx.mapStore.map?.setCyberThreats(this.ctx.intelligenceStore.cyberThreatsCache);
      this.ctx.mapStore.map?.setLayerReady('cyberThreats', this.ctx.intelligenceStore.cyberThreatsCache.length > 0);
      ingestCyberThreatsForCII(this.ctx.intelligenceStore.cyberThreatsCache);
      this.deps.refreshCiiAndBrief();
      this.ctx.statusPanel?.updateFeed('Cyber Threats', { status: 'ok', itemCount: this.ctx.intelligenceStore.cyberThreatsCache.length });
      return;
    }

    try {
      const threats = await fetchCyberThreats({ limit: 500, days: 14 });
      this.ctx.intelligenceStore.cyberThreatsCache = threats;
      this.ctx.mapStore.map?.setCyberThreats(threats);
      this.ctx.mapStore.map?.setLayerReady('cyberThreats', threats.length > 0);
      ingestCyberThreatsForCII(threats);
      this.deps.refreshCiiAndBrief();
      this.ctx.statusPanel?.updateFeed('Cyber Threats', { status: 'ok', itemCount: threats.length });
      this.ctx.statusPanel?.updateApi('Cyber Threats API', { status: 'ok' });
      dataFreshness.recordUpdate('cyber_threats', threats.length);
    } catch (error) {
      this.ctx.mapStore.map?.setLayerReady('cyberThreats', false);
      this.ctx.statusPanel?.updateFeed('Cyber Threats', { status: 'error', errorMessage: String(error) });
      this.ctx.statusPanel?.updateApi('Cyber Threats API', { status: 'error' });
      dataFreshness.recordError('cyber_threats', String(error));
    }
  }

  async loadIranEvents(): Promise<void> {
    try {
      const events = await fetchIranEvents();
      this.ctx.intelligenceStore.updateCache({ iranEvents: events });
      this.ctx.mapStore.map?.setIranEvents(events);
      this.ctx.mapStore.map?.setLayerReady('iranAttacks', events.length > 0);
      const coerced = events.map(e => ({ ...e, timestamp: Number(e.timestamp) || 0 }));
      signalAggregator.ingestConflictEvents(coerced);
      ingestStrikesForCII(coerced);
      this.deps.refreshCiiAndBrief();
    } catch {
      this.ctx.mapStore.map?.setLayerReady('iranAttacks', false);
    }
  }

  async loadAisSignals(): Promise<void> {
    try {
      const { disruptions, density } = await fetchAisSignals();
      const aisStatus = getAisStatus();
      console.log('[Ships] Events:', { disruptions: disruptions.length, density: density.length, vessels: aisStatus.vessels, connected: aisStatus.connected });
      this.ctx.mapStore.map?.setAisData(disruptions, density);
      this.ctx.mapStore.map?.enableAisLiveTracking();
      setTimeout(() => {
        const afterStatus = getAisStatus();
        console.log('[Ships] After live tracking enabled:', { vessels: afterStatus.vessels, connected: afterStatus.connected });
      }, 5000);
      signalAggregator.ingestAisDisruptions(disruptions);
      ingestAisDisruptionsForCII(disruptions);
      this.deps.refreshCiiAndBrief();
      updateAndCheck([
        { type: 'ais_gaps', region: 'global', count: disruptions.length },
      ]).then(anomalies => {
        if (anomalies.length > 0) {
          signalAggregator.ingestTemporalAnomalies(anomalies);
          ingestTemporalAnomaliesForCII(anomalies);
          this.deps.refreshCiiAndBrief();
        }
      }).catch(() => { });

      const hasData = disruptions.length > 0 || density.length > 0;
      this.ctx.mapStore.map?.setLayerReady('ais', hasData);

      const shippingCount = disruptions.length + density.length;
      const shippingStatus = shippingCount > 0 ? 'ok' : (aisStatus.connected ? 'warning' : 'error');
      this.ctx.statusPanel?.updateFeed('Shipping', {
        status: shippingStatus,
        itemCount: shippingCount,
        errorMessage: !aisStatus.connected && shippingCount === 0 ? 'AIS snapshot unavailable' : undefined,
      });
      this.ctx.statusPanel?.updateApi('AISStream', {
        status: aisStatus.connected ? 'ok' : 'warning',
      });
      if (hasData) {
        dataFreshness.recordUpdate('ais', shippingCount);
      }
    } catch (error) {
      this.ctx.mapStore.map?.setLayerReady('ais', false);
      this.ctx.statusPanel?.updateFeed('Shipping', { status: 'error', errorMessage: String(error) });
      this.ctx.statusPanel?.updateApi('AISStream', { status: 'error' });
      dataFreshness.recordError('ais', String(error));
    }
  }

  waitForAisData(): void {
    const maxAttempts = 30;
    let attempts = 0;

    const checkData = () => {
      if (this.ctx.isDestroyed) return;
      attempts++;
      const status = getAisStatus();

      if (status.vessels > 0 || status.connected) {
        this.loadAisSignals();
        this.ctx.mapStore.map?.setLayerLoading('ais', false);
        return;
      }

      if (attempts >= maxAttempts) {
        this.ctx.mapStore.map?.setLayerLoading('ais', false);
        this.ctx.mapStore.map?.setLayerReady('ais', false);
        this.ctx.statusPanel?.updateFeed('Shipping', {
          status: 'error',
          errorMessage: 'Connection timeout'
        });
        return;
      }

      setTimeout(checkData, 1000);
    };

    checkData();
  }

  async loadCableActivity(): Promise<void> {
    try {
      const activity = await fetchCableActivity();
      this.ctx.mapStore.map?.setCableActivity(activity.advisories, activity.repairShips);
      const itemCount = activity.advisories.length + activity.repairShips.length;
      this.ctx.statusPanel?.updateFeed('CableOps', { status: 'ok', itemCount });
    } catch {
      this.ctx.statusPanel?.updateFeed('CableOps', { status: 'error' });
    }
  }

  async loadCableHealth(): Promise<void> {
    try {
      const healthData = await fetchCableHealth();
      this.ctx.mapStore.map?.setCableHealth(healthData.cables);
      const cableIds = Object.keys(healthData.cables);
      const faultCount = cableIds.filter((id) => healthData.cables[id]?.status === 'fault').length;
      const degradedCount = cableIds.filter((id) => healthData.cables[id]?.status === 'degraded').length;
      this.ctx.statusPanel?.updateFeed('CableHealth', { status: 'ok', itemCount: faultCount + degradedCount });
    } catch {
      this.ctx.statusPanel?.updateFeed('CableHealth', { status: 'error' });
    }
  }

  async loadFlightDelays(): Promise<void> {
    try {
      const delays = await fetchFlightDelays();
      this.ctx.mapStore.map?.setFlightDelays(delays);
      this.ctx.mapStore.map?.setLayerReady('flights', delays.length > 0);
      this.ctx.intelligenceStore.updateCache({ flightDelays: delays });
      const severe = delays.filter(d => d.severity === 'major' || d.severity === 'severe' || d.delayType === 'closure');
      if (severe.length > 0) ingestAviationForCII(severe);
      this.ctx.statusPanel?.updateFeed('Flights', {
        status: 'ok',
        itemCount: delays.length,
      });
      this.ctx.statusPanel?.updateApi('FAA', { status: 'ok' });
    } catch (error) {
      this.ctx.mapStore.map?.setLayerReady('flights', false);
      this.ctx.statusPanel?.updateFeed('Flights', { status: 'error', errorMessage: String(error) });
      this.ctx.statusPanel?.updateApi('FAA', { status: 'error' });
    }
  }

  async loadGovernanceBaselines(): Promise<void> {
    try {
      const { getGovernanceScores, getEconomicVulnerability } = await import('@/services/economic');
      const [governanceScores, vulnerabilityData] = await Promise.allSettled([
        getGovernanceScores(),
        getEconomicVulnerability(),
      ]);

      if (governanceScores.status === 'fulfilled' && governanceScores.value?.length) {
        ingestGovernanceBaselines(governanceScores.value);
        console.debug('[DataLoader] Governance baselines loaded:', governanceScores.value.length, 'countries');

        const { iso3ToIso2Code } = await import('@/services/country-geometry');
        const govMapScores = governanceScores.value
          .map(s => {
            const code = iso3ToIso2Code(s.countryCode) ?? s.countryCode;
            if (!code) return null;
            const idx = s.governanceIndex;
            const level = idx >= 80 ? 'excellent' : idx >= 60 ? 'good' : idx >= 40 ? 'moderate' : idx >= 20 ? 'weak' : 'failing';
            return { code, index: idx, level };
          })
          .filter((s): s is NonNullable<typeof s> => s != null);
        this.ctx.mapStore.map?.setGovernanceScores(govMapScores);
      }
      if (vulnerabilityData.status === 'fulfilled' && vulnerabilityData.value?.length) {
        ingestEconomicVulnerability(vulnerabilityData.value);
        console.debug('[DataLoader] Economic vulnerability loaded:', vulnerabilityData.value.length, 'countries');
      }

      const { fetchVDemScores, fetchPolityScores } = await import('@/services/data360');
      const [vdemResult, polityResult] = await Promise.allSettled([
        fetchVDemScores(),
        fetchPolityScores(),
      ]);

      if (vdemResult.status === 'fulfilled' && vdemResult.value?.length) {
        ingestVDemForCII(vdemResult.value);
        console.debug('[DataLoader] V-Dem electoral democracy loaded:', vdemResult.value.length, 'countries');
      } else {
        console.debug('[DataLoader] V-Dem data unavailable; CII will use WGI+Polity only or pure WGI fallback');
      }
      if (polityResult.status === 'fulfilled' && polityResult.value?.length) {
        ingestPolityForCII(polityResult.value);
        console.debug('[DataLoader] Polity scores loaded:', polityResult.value.length, 'countries');
      } else {
        console.debug('[DataLoader] Polity data unavailable; CII will use WGI+V-Dem only or pure WGI fallback');
      }

      if (vdemResult.status === 'fulfilled' && vdemResult.value?.length) {
        const demScores = vdemResult.value.map(s => ({
          code: s.countryCode,
          score: s.compositeScore,
          regimeType: s.regimeType,
        }));
        this.ctx.mapStore.map?.setDemocracyScores(demScores);
        console.debug('[DataLoader] Democracy Index choropleth loaded:', demScores.length, 'countries');
      }

      const { fetchGemRiskScores } = await import('@/services/data360');
      const gemResult = await fetchGemRiskScores().catch(err => {
        console.debug('[DataLoader] GEM Risk data unavailable:', err);
        return null;
      });
      if (gemResult?.length) {
        const gemScores = gemResult.map(s => ({
          code: s.countryCode,
          compositeRisk: s.compositeRisk,
          rank: s.rank,
        }));
        this.ctx.mapStore.map?.setGemRiskScores(gemScores);
        console.debug('[DataLoader] GEM Risk choropleth loaded:', gemScores.length, 'countries');
      }
    } catch (err) {
      console.warn('[DataLoader] Governance baselines failed (non-fatal):', err);
    }
  }

  async refreshTemporalBaseline(): Promise<void> {
    const { anomalies, trackedTypes } = await fetchLiveAnomalies();
    signalAggregator.ingestTemporalAnomalies(anomalies, trackedTypes);
    ingestTemporalAnomaliesForCII(anomalies);
    this.deps.refreshCiiAndBrief();
  }

  private async loadCachedPosturesForBanner(): Promise<void> {
    try {
      const data = await fetchCachedTheaterPosture();
      if (data && data.postures.length > 0) {
        this.deps.renderCriticalBanner?.(data.postures);
        const posturePanel = this.ctx.panels['strategic-posture'] as StrategicPosturePanel | undefined;
        posturePanel?.updatePostures(data);
      }
    } catch (error) {
      console.warn('[App] Failed to load cached postures for banner:', error);
    }
  }

  async loadSecurityAdvisories(): Promise<void> {
    try {
      const result = await fetchSecurityAdvisories();
      if (result.ok) {
        this.deps.callPanel('security-advisories', 'setData', result.advisories);
        this.ctx.intelligenceStore.updateCache({ advisories: result.advisories });
        ingestAdvisoriesForCII(result.advisories);
        this.deps.refreshCiiAndBrief();
      }
    } catch (error) {
      console.error('[App] Security advisories fetch failed:', error);
    }
  }

  async loadTelegramIntel(): Promise<void> {
    try {
      const result = await fetchTelegramFeed();
      this.deps.callPanel('telegram-intel', 'setData', result);
    } catch (error) {
      console.error('[App] Telegram intel fetch failed:', error);
    }
  }

  async loadNatural(): Promise<void> {
    try {
      const { fetchEarthquakes, fetchNaturalEvents } = await import('@/services');
      const [earthquakeResult, eonetResult] = await Promise.allSettled([
        fetchEarthquakes(),
        fetchNaturalEvents(30),
      ]);

      if (earthquakeResult.status === 'fulfilled') {
        this.ctx.intelligenceStore.updateCache({ earthquakes: earthquakeResult.value });
        this.ctx.mapStore.map?.setEarthquakes(earthquakeResult.value);
        import('@/services/geo-convergence').then(({ ingestEarthquakes }) => ingestEarthquakes(earthquakeResult.value));
        this.ctx.statusPanel?.updateApi('USGS', { status: 'ok' });
        import('@/services/data-freshness').then(({ dataFreshness }) => dataFreshness.recordUpdate('usgs', earthquakeResult.value.length));
        this.deps.refreshCiiAndBrief();
      } else {
        this.ctx.intelligenceStore.updateCache({ earthquakes: [] });
        this.ctx.mapStore.map?.setEarthquakes([]);
        this.ctx.statusPanel?.updateApi('USGS', { status: 'error' });
        import('@/services/data-freshness').then(({ dataFreshness }) => dataFreshness.recordError('usgs', String(earthquakeResult.reason)));
      }

      if (eonetResult.status === 'fulfilled') {
        this.ctx.mapStore.map?.setNaturalEvents(eonetResult.value);
        this.ctx.statusPanel?.updateFeed('EONET', { status: 'ok', itemCount: eonetResult.value.length });
        this.ctx.statusPanel?.updateApi('NASA EONET', { status: 'ok' });
      } else {
        this.ctx.mapStore.map?.setNaturalEvents([]);
        this.ctx.statusPanel?.updateFeed('EONET', { status: 'error', errorMessage: String(eonetResult.reason) });
        this.ctx.statusPanel?.updateApi('NASA EONET', { status: 'error' });
      }

      const hasEarthquakes = earthquakeResult.status === 'fulfilled' && earthquakeResult.value.length > 0;
      const hasEonet = eonetResult.status === 'fulfilled' && eonetResult.value.length > 0;
      this.ctx.mapStore.map?.setLayerReady('natural', hasEarthquakes || hasEonet);
    } catch (error) {
      console.error('[SignalPublisher] loadNatural failed:', error);
    }
  }

  async loadWeatherAlerts(): Promise<void> {
    try {
      const { fetchWeatherAlerts } = await import('@/services');
      const alerts = await fetchWeatherAlerts();
      this.ctx.mapStore.map?.setWeatherAlerts(alerts);
      this.ctx.mapStore.map?.setLayerReady('weather', alerts.length > 0);
      this.ctx.statusPanel?.updateFeed('Weather', { status: 'ok', itemCount: alerts.length });
      import('@/services/data-freshness').then(({ dataFreshness }) => dataFreshness.recordUpdate('weather', alerts.length));
    } catch (error) {
      this.ctx.mapStore.map?.setLayerReady('weather', false);
      this.ctx.statusPanel?.updateFeed('Weather', { status: 'error' });
      import('@/services/data-freshness').then(({ dataFreshness }) => dataFreshness.recordError('weather', String(error)));
    }
  }

  async loadFirmsData(): Promise<void> {
    try {
      const { fetchAllFires, flattenFires, computeRegionStats, toMapFires } = await import('@/services/wildfires');
      const fireResult = await fetchAllFires(1);
      if (fireResult.skipped) {
        const { t } = await import('@/services/i18n');
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
        import('@/services/country-instability').then(({ ingestSatelliteFiresForCII }) => ingestSatelliteFiresForCII(satelliteFires));
        this.deps.refreshCiiAndBrief();

        this.ctx.mapStore.map?.setFires(toMapFires(flat));

        (this.ctx.panels['satellite-fires'] as import('@/components').SatelliteFiresPanel)?.update(stats, totalCount);

        import('@/services/data-freshness').then(({ dataFreshness }) => dataFreshness.recordUpdate('firms', totalCount));
      } else {
        import('@/services/country-instability').then(({ ingestSatelliteFiresForCII }) => ingestSatelliteFiresForCII([]));
        this.deps.refreshCiiAndBrief();
        (this.ctx.panels['satellite-fires'] as import('@/components').SatelliteFiresPanel)?.update([], 0);
      }
      this.ctx.statusPanel?.updateApi('FIRMS', { status: 'ok' });
    } catch (e) {
      console.warn('[SignalPublisher] FIRMS load failed:', e);
      (this.ctx.panels['satellite-fires'] as import('@/components').SatelliteFiresPanel)?.update([], 0);
      this.ctx.statusPanel?.updateApi('FIRMS', { status: 'error' });
      import('@/services/data-freshness').then(({ dataFreshness }) => dataFreshness.recordError('firms', String(e)));
    }
  }

  async loadPositiveEvents(): Promise<void> {
    try {
      const { fetchPositiveGeoEvents, geocodePositiveNewsItems } = await import('@/services/positive-events-geo');
      const { getHydratedData } = await import('@/services/bootstrap');
      const hydrated = getHydratedData('positiveGeoEvents') as { events?: Array<{ latitude: number; longitude: number; name: string; category: string; count: number; timestamp: number }> } | undefined;
      let gdeltEvents: import('@/services/positive-events-geo').PositiveGeoEvent[];
      if (hydrated?.events?.length) {
        gdeltEvents = hydrated.events.map(e => ({
          lat: e.latitude, lon: e.longitude, name: e.name,
          category: (e.category || 'humanity-kindness') as import('@/services/positive-classifier').HappyContentCategory,
          count: e.count, timestamp: e.timestamp,
        }));
      } else {
        gdeltEvents = await fetchPositiveGeoEvents();
      }
      const rssEvents = geocodePositiveNewsItems(
        this.ctx.happyAllItems.map(item => ({
          title: item.title,
          category: item.happyCategory,
        }))
      );
      const seen = new Set<string>();
      const merged = [...gdeltEvents, ...rssEvents].filter(e => {
        if (seen.has(e.name)) return false;
        seen.add(e.name);
        return true;
      });
      this.ctx.mapStore.map?.setPositiveEvents(merged);
    } catch (error) {
      console.error('[SignalPublisher] loadPositiveEvents failed:', error);
    }
  }

  loadKindnessData(): void {
    try {
      import('@/services/kindness-data').then(({ fetchKindnessData }) => {
        const kindnessItems = fetchKindnessData(
          this.ctx.happyAllItems.map(item => ({
            title: item.title,
            happyCategory: item.happyCategory,
          }))
        );
        this.ctx.mapStore.map?.setKindnessData(kindnessItems);
      });
    } catch (error) {
      console.error('[SignalPublisher] loadKindnessData failed:', error);
    }
  }
}
