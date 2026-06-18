import { NewsPanel } from './NewsPanel';
import { escapeHtml } from '@/utils/sanitize';
import { fetchKnownExploitedVulns, type KnownExploitedVulnerability } from '@/services/cyber/kev';
import { isNamedSourceEnabled } from '@/services/source-control';

export class SecurityNewsPanel extends NewsPanel {
  private kevStrip: HTMLElement;
  private kevEntries: KnownExploitedVulnerability[] = [];
  private kevLoaded = false;
  private kevError = '';
  private kevRequestId = 0;
  private boundKevSourcesChangedHandler: ((event: Event) => void) | null = null;
  private boundKevClickHandler: ((event: Event) => void) | null = null;

  constructor(id: string, title: string) {
    super(id, title);

    this.kevStrip = document.createElement('div');
    this.kevStrip.className = 'security-kev-strip';
    this.kevStrip.setAttribute('aria-label', 'CISA Known Exploited Vulnerabilities');
    this.element.insertBefore(this.kevStrip, this.content);

    this.boundKevSourcesChangedHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ source?: string }>).detail;
      if (detail?.source !== 'CISA KEV') return;
      this.kevLoaded = false;
      this.kevEntries = [];
      this.kevError = '';
      void this.loadKevStrip();
    };
    window.addEventListener('worldmonitor:sources-changed', this.boundKevSourcesChangedHandler);

    this.boundKevClickHandler = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-kev-retry]')) return;
      void this.loadKevStrip();
    };
    this.kevStrip.addEventListener('click', this.boundKevClickHandler);

    void this.loadKevStrip();
  }

  public destroy(): void {
    if (this.boundKevSourcesChangedHandler) {
      window.removeEventListener('worldmonitor:sources-changed', this.boundKevSourcesChangedHandler);
      this.boundKevSourcesChangedHandler = null;
    }
    if (this.boundKevClickHandler) {
      this.kevStrip.removeEventListener('click', this.boundKevClickHandler);
      this.boundKevClickHandler = null;
    }
    super.destroy();
  }

  private async loadKevStrip(): Promise<void> {
    const requestId = ++this.kevRequestId;

    if (!isNamedSourceEnabled('CISA KEV')) {
      this.kevLoaded = true;
      this.kevEntries = [];
      this.kevError = '';
      this.renderKevStrip();
      return;
    }

    this.kevLoaded = false;
    this.kevError = '';
    this.renderKevStrip();

    try {
      const entries = await fetchKnownExploitedVulns(10);
      if (requestId !== this.kevRequestId) return;
      this.kevEntries = entries;
    } catch (error) {
      if (requestId !== this.kevRequestId) return;
      this.kevEntries = [];
      this.kevError = error instanceof Error ? error.message : 'CISA KEV catalog unavailable';
    } finally {
      if (requestId !== this.kevRequestId) return;
      this.kevLoaded = true;
      this.renderKevStrip();
    }
  }

  private renderKevStrip(): void {
    if (!isNamedSourceEnabled('CISA KEV')) {
      this.kevStrip.innerHTML = '';
      this.kevStrip.style.display = 'none';
      return;
    }

    this.kevStrip.style.display = '';

    if (!this.kevLoaded) {
      this.kevStrip.innerHTML = this.renderKevShell('<div class="security-kev-state">Loading CISA KEV catalog...</div>');
      return;
    }

    if (this.kevError) {
      this.kevStrip.innerHTML = this.renderKevShell(`
        <div class="security-kev-state security-kev-error">
          <span>${escapeHtml(this.kevError)}</span>
          <button type="button" class="security-kev-retry" data-kev-retry>Retry</button>
        </div>
      `);
      return;
    }

    if (this.kevEntries.length === 0) {
      this.kevStrip.innerHTML = this.renderKevShell('<div class="security-kev-state">No exploited vulnerabilities returned right now.</div>');
      return;
    }

    const cards = this.kevEntries.map((entry) => {
      const ransomware = entry.knownRansomwareCampaignUse
        && entry.knownRansomwareCampaignUse.toLowerCase() !== 'unknown'
        ? `<span class="security-kev-tag">${escapeHtml(entry.knownRansomwareCampaignUse)}</span>`
        : '';
      const due = entry.dueDate ? `<span class="security-kev-meta">Due ${escapeHtml(entry.dueDate)}</span>` : '';
      const added = entry.dateAdded ? `<span class="security-kev-meta">Added ${escapeHtml(entry.dateAdded)}</span>` : '';
      const cwe = entry.cwe ? `<span class="security-kev-meta">${escapeHtml(entry.cwe)}</span>` : '';
      const subtitle = [entry.vendorProject, entry.product].filter(Boolean).join(' - ');
      const cveUrl = `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(entry.cveId)}`;

      return `
        <article class="security-kev-card">
          <div class="security-kev-card-head">
            <a class="security-kev-cve" href="${cveUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.cveId)}</a>
            ${ransomware}
          </div>
          <div class="security-kev-title">${escapeHtml(entry.vulnerabilityName || subtitle || entry.cveId)}</div>
          ${subtitle ? `<div class="security-kev-subtitle">${escapeHtml(subtitle)}</div>` : ''}
          <div class="security-kev-foot">${added}${due}${cwe}</div>
        </article>
      `;
    }).join('');

    this.kevStrip.innerHTML = this.renderKevShell(`<div class="security-kev-grid">${cards}</div>`);
  }

  private renderKevShell(body: string): string {
    return `
      <div class="security-kev-header">
        <span class="security-kev-label">CISA Known Exploited Vulnerabilities</span>
        <span class="security-kev-source">cisa.gov/kev</span>
      </div>
      ${body}
    `;
  }
}
