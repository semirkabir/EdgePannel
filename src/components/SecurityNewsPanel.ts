import { NewsPanel } from './NewsPanel';
import { escapeHtml } from '@/utils/sanitize';
import { fetchKnownExploitedVulns, type KnownExploitedVulnerability } from '@/services/cyber/kev';
import { isNamedSourceEnabled } from '@/services/source-control';

export class SecurityNewsPanel extends NewsPanel {
  private kevStrip: HTMLElement;
  private kevEntries: KnownExploitedVulnerability[] = [];
  private kevLoaded = false;
  private boundKevSourcesChangedHandler: ((event: Event) => void) | null = null;

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
      void this.loadKevStrip();
    };
    window.addEventListener('worldmonitor:sources-changed', this.boundKevSourcesChangedHandler);

    void this.loadKevStrip();
  }

  public destroy(): void {
    if (this.boundKevSourcesChangedHandler) {
      window.removeEventListener('worldmonitor:sources-changed', this.boundKevSourcesChangedHandler);
      this.boundKevSourcesChangedHandler = null;
    }
    super.destroy();
  }

  private async loadKevStrip(): Promise<void> {
    if (!isNamedSourceEnabled('CISA KEV')) {
      this.kevLoaded = true;
      this.kevEntries = [];
      this.renderKevStrip();
      return;
    }
    try {
      this.kevEntries = await fetchKnownExploitedVulns(10);
    } catch {
      this.kevEntries = [];
    } finally {
      this.kevLoaded = true;
      this.renderKevStrip();
    }
  }

  private renderKevStrip(): void {
    if (!this.kevLoaded) {
      this.kevStrip.innerHTML = '<div class="security-kev-loading">Loading CISA KEV catalog…</div>';
      return;
    }

    if (this.kevEntries.length === 0) {
      this.kevStrip.innerHTML = '';
      this.kevStrip.style.display = 'none';
      return;
    }

    this.kevStrip.style.display = '';
    const cards = this.kevEntries.map((entry) => {
      const ransomware = entry.knownRansomwareCampaignUse
        && entry.knownRansomwareCampaignUse.toLowerCase() !== 'unknown'
        ? `<span class="security-kev-tag">${escapeHtml(entry.knownRansomwareCampaignUse)}</span>`
        : '';
      const due = entry.dueDate ? `<span class="security-kev-meta">Due ${escapeHtml(entry.dueDate)}</span>` : '';
      const added = entry.dateAdded ? `<span class="security-kev-meta">Added ${escapeHtml(entry.dateAdded)}</span>` : '';
      const cwe = entry.cwe ? `<span class="security-kev-meta">${escapeHtml(entry.cwe)}</span>` : '';
      const subtitle = [entry.vendorProject, entry.product].filter(Boolean).join(' · ');
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

    this.kevStrip.innerHTML = `
      <div class="security-kev-header">
        <span class="security-kev-label">CISA Known Exploited Vulnerabilities</span>
        <span class="security-kev-source">cisa.gov/kev</span>
      </div>
      <div class="security-kev-grid">${cards}</div>
    `;
  }
}