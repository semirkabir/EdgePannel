/**
 * AirspaceControls — operational UI for the live aircraft viewport.
 *
 * Provides center lat/lon, radius, refresh, and provider attribution display.
 * Calls `setAircraftViewportBounds` / `radiusToBounds` from `./live` to
 * control which aircraft the live stream fetches.
 *
 * Designed as a self-contained panel that mounts into a container element
 * (e.g. the DeckGLMap layers panel). Follows the AviationCommandBar lifecycle
 * pattern: construct → mount(container) → destroy().
 */

import {
  setAircraftViewportBounds,
  getAircraftViewportBounds,
  radiusToBounds,
  getAircraftLiveStatus,
  isAircraftLiveConfigured,
} from './live';
import { getProviderAttribution } from './providers';
import { getAviationCredentialsStatus } from './index';

export class AirspaceControls {
  private panel: HTMLElement | null = null;
  private latInput: HTMLInputElement | null = null;
  private lonInput: HTMLInputElement | null = null;
  private radiusInput: HTMLInputElement | null = null;
  private statusEl: HTMLElement | null = null;
  private attributionEl: HTMLElement | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  mount(container: HTMLElement): void {
    if (this.panel) return;

    this.panel = document.createElement('div');
    this.panel.className = 'airspace-controls';
    this.panel.innerHTML = `
      <div class="airspace-controls-header">
        <span class="airspace-controls-title">Airspace</span>
        <button class="airspace-controls-collapse" type="button" aria-expanded="true" aria-label="Collapse airspace">-</button>
      </div>
      <div class="airspace-controls-body">
        <div class="airspace-field">
          <label>Center Lat</label>
          <input class="airspace-lat" type="number" step="0.1" min="-90" max="90" placeholder="e.g. 40.0" aria-label="Center latitude">
        </div>
        <div class="airspace-field">
          <label>Center Lon</label>
          <input class="airspace-lon" type="number" step="0.1" min="-180" max="180" placeholder="e.g. 30.0" aria-label="Center longitude">
        </div>
        <div class="airspace-field">
          <label>Radius (km)</label>
          <input class="airspace-radius" type="number" step="10" min="10" max="2000" placeholder="e.g. 200" aria-label="Radius in kilometers">
        </div>
        <div class="airspace-controls-actions">
          <button class="airspace-apply" type="button">Apply Airspace</button>
          <button class="airspace-refresh" type="button" title="Refresh aircraft">Refresh</button>
          <button class="airspace-clear" type="button" title="Clear airspace">Clear</button>
        </div>
        <div class="airspace-status"></div>
        <div class="airspace-attribution"></div>
      </div>`;

    container.appendChild(this.panel);

    this.latInput = this.panel.querySelector('.airspace-lat') as HTMLInputElement;
    this.lonInput = this.panel.querySelector('.airspace-lon') as HTMLInputElement;
    this.radiusInput = this.panel.querySelector('.airspace-radius') as HTMLInputElement;
    this.statusEl = this.panel.querySelector('.airspace-status') as HTMLElement;
    this.attributionEl = this.panel.querySelector('.airspace-attribution') as HTMLElement;

    this.populateFromCurrentBounds();

    this.panel.querySelector('.airspace-apply')?.addEventListener('click', () => this.applyAirspace());
    this.panel.querySelector('.airspace-refresh')?.addEventListener('click', () => this.refresh());
    this.panel.querySelector('.airspace-clear')?.addEventListener('click', () => this.clearAirspace());

    const collapseBtn = this.panel.querySelector('.airspace-controls-collapse') as HTMLButtonElement;
    const body = this.panel.querySelector('.airspace-controls-body') as HTMLElement;
    collapseBtn.addEventListener('click', () => {
      const collapsed = body.classList.toggle('collapsed');
      collapseBtn.textContent = collapsed ? '+' : '-';
      collapseBtn.setAttribute('aria-expanded', String(!collapsed));
    });

    this.addStyles();
    this.updateStatus();

    this.refreshTimer = setInterval(() => this.updateStatus(), 5000);
  }

  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.panel?.remove();
    this.panel = null;
    this.latInput = null;
    this.lonInput = null;
    this.radiusInput = null;
    this.statusEl = null;
    this.attributionEl = null;
  }

  public refresh(): void {
    const bounds = getAircraftViewportBounds();
    if (bounds) {
      setAircraftViewportBounds(bounds);
    } else {
      this.updateStatus();
    }
  }

  public applyAirspace(): void {
    const lat = parseFloat(this.latInput?.value ?? '');
    const lon = parseFloat(this.lonInput?.value ?? '');
    const radiusKm = parseFloat(this.radiusInput?.value ?? '');

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radiusKm)) {
      this.setStatus('Enter valid lat, lon, and radius', true);
      return;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      this.setStatus('Lat must be -90..90, lon -180..180', true);
      return;
    }
    if (radiusKm < 10 || radiusKm > 2000) {
      this.setStatus('Radius must be 10..2000 km', true);
      return;
    }

    const bounds = radiusToBounds(lat, lon, radiusKm);
    setAircraftViewportBounds(bounds);
    this.updateStatus();
  }

  public clearAirspace(): void {
    setAircraftViewportBounds(null);
    if (this.latInput) this.latInput.value = '';
    if (this.lonInput) this.lonInput.value = '';
    if (this.radiusInput) this.radiusInput.value = '';
    this.updateStatus();
  }

  private populateFromCurrentBounds(): void {
    const bounds = getAircraftViewportBounds();
    if (!bounds) return;
    const lat = ((bounds.swLat + bounds.neLat) / 2).toFixed(2);
    const lon = ((bounds.swLon + bounds.neLon) / 2).toFixed(2);
    const latSpan = bounds.neLat - bounds.swLat;
    const radiusKm = Math.round(latSpan * 111 / 2);
    if (this.latInput) this.latInput.value = lat;
    if (this.lonInput) this.lonInput.value = lon;
    if (this.radiusInput) this.radiusInput.value = String(Math.max(10, radiusKm));
  }

  private updateStatus(): void {
    if (!this.statusEl) return;

    if (!isAircraftLiveConfigured()) {
      this.setStatus('Live stream unavailable — configure OpenSky in Settings', true);
      this.setAttribution('');
      return;
    }

    const status = getAircraftLiveStatus();
    if (status.connected) {
      this.setStatus(`Live · ${status.aircraft} aircraft tracked`, false);
    } else {
      const bounds = getAircraftViewportBounds();
      if (bounds) {
        this.setStatus('Connecting…', false);
      } else {
        this.setStatus('No airspace set — enter center + radius', false);
      }
    }

    const creds = getAviationCredentialsStatus();
    const providerId = creds.openSkyConfigured ? 'opensky' : 'adsb.lol';
    this.setAttribution(getProviderAttribution(providerId));
  }

  private setStatus(text: string, isError: boolean): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = text;
    this.statusEl.classList.toggle('airspace-status-error', isError);
  }

  private setAttribution(text: string): void {
    if (!this.attributionEl) return;
    this.attributionEl.textContent = text;
    this.attributionEl.style.display = text ? '' : 'none';
  }

  private addStyles(): void {
    if (document.getElementById('airspace-controls-styles')) return;
    const style = document.createElement('style');
    style.id = 'airspace-controls-styles';
    style.textContent = `
      .airspace-controls { border-top:1px solid var(--border,#2a2a2a); padding:8px 10px; font-size:12px; }
      .airspace-controls-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
      .airspace-controls-title { font-weight:600; color:var(--text,#e8e8e8); font-size:12px; }
      .airspace-controls-collapse { background:none; border:none; color:#6b7280; cursor:pointer; font-size:16px; line-height:1; padding:0; }
      .airspace-controls-body.collapsed { display:none; }
      .airspace-field { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
      .airspace-field label { min-width:80px; color:#9ca3af; font-size:11px; }
      .airspace-field input { flex:1; background:rgba(255,255,255,.05); border:1px solid var(--border,#2a2a2a); border-radius:4px; color:var(--text,#e8e8e8); font-size:12px; padding:4px 6px; outline:none; width:100%; box-sizing:border-box; }
      .airspace-field input:focus { border-color:var(--accent,#60a5fa); }
      .airspace-controls-actions { display:flex; gap:6px; margin-top:6px; flex-wrap:wrap; }
      .airspace-controls-actions button { background:rgba(255,255,255,.05); border:1px solid var(--border,#2a2a2a); border-radius:4px; color:var(--text,#e8e8e8); cursor:pointer; font-size:11px; padding:4px 8px; }
      .airspace-controls-actions button:hover { background:rgba(255,255,255,.1); border-color:var(--accent,#60a5fa); }
      .airspace-apply { flex:1; }
      .airspace-status { margin-top:6px; font-size:11px; color:#9ca3af; }
      .airspace-status-error { color:#ef4444; }
      .airspace-attribution { margin-top:4px; font-size:10px; color:#6b7280; }
    `;
    document.head.appendChild(style);
  }
}
