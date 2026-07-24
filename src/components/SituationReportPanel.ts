/**
 * SituationReportPanel — self-contained overlay that generates and renders a
 * full structured intelligence brief (BLUF → Key Developments → Regional →
 * Market Implications → Indicators to Watch).
 *
 * Mirrors the AgentChatPanel pattern: owns its own overlay, no grid/variant
 * registration. Content comes from the isolated `generateSituationReport()`
 * cloud pipeline; the terse Insights ticker is untouched.
 */
import { generateSituationReport } from '@/services/summarization';
import { isAnyAiProviderEnabled } from '@/services/ai-flow-settings';
import { isDesktopRuntime } from '@/services/runtime';
import { getPersistentCache, setPersistentCache } from '@/services/persistent-cache';
import { escapeHtml } from '@/utils/sanitize';

interface CachedReport {
  markdown: string;
  provider: string;
  model: string;
  generatedAt: number;
}

export class SituationReportPanel {
  private static readonly CACHE_KEY = 'situation-report:latest';
  private static readonly STALE_MS = 30 * 60 * 1000; // regenerate suggestion after 30m

  private overlay: HTMLElement;
  private bodyEl: HTMLElement;
  private metaEl: HTMLElement;
  private regenBtn: HTMLButtonElement;
  private headlinesProvider: () => string[] = () => [];
  private isGenerating = false;
  private cached: CachedReport | null = null;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'sitrep-overlay';
    this.overlay.hidden = true;

    const panel = document.createElement('aside');
    panel.className = 'sitrep-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Situation report');
    panel.innerHTML = `
      <header class="sitrep-header">
        <div>
          <h2>Situation Report</h2>
          <p class="sitrep-meta">Global intelligence brief</p>
        </div>
        <div class="sitrep-header-actions">
          <button type="button" class="sitrep-regen" aria-label="Regenerate report">Regenerate</button>
          <button type="button" class="sitrep-close" aria-label="Close">×</button>
        </div>
      </header>
      <div class="sitrep-body" aria-live="polite"></div>
    `;
    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);

    this.bodyEl = panel.querySelector<HTMLElement>('.sitrep-body')!;
    this.metaEl = panel.querySelector<HTMLElement>('.sitrep-meta')!;
    this.regenBtn = panel.querySelector<HTMLButtonElement>('.sitrep-regen')!;

    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay || (event.target as HTMLElement).closest('.sitrep-close')) {
        this.close();
      }
    });
    this.regenBtn.addEventListener('click', () => void this.generate(true));
  }

  /** Supply a live source of the current top headlines (called on each open). */
  public setHeadlinesProvider(provider: () => string[]): void {
    this.headlinesProvider = provider;
  }

  public async open(): Promise<void> {
    this.overlay.hidden = false;
    this.overlay.classList.add('active');

    if (!this.cached) {
      const entry = await getPersistentCache<CachedReport>(SituationReportPanel.CACHE_KEY);
      if (entry?.data?.markdown) this.cached = entry.data;
    }

    if (this.cached) {
      this.render(this.cached);
      // Auto-refresh silently if the cached report is stale.
      if (Date.now() - this.cached.generatedAt > SituationReportPanel.STALE_MS) {
        void this.generate(false);
      }
    } else {
      void this.generate(false);
    }
  }

  public close(): void {
    this.overlay.classList.remove('active');
    this.overlay.hidden = true;
  }

  public destroy(): void {
    this.overlay.remove();
  }

  private async generate(force: boolean): Promise<void> {
    if (this.isGenerating) return;

    if (!isDesktopRuntime() && !isAnyAiProviderEnabled()) {
      this.renderUnavailable();
      return;
    }

    const headlines = this.headlinesProvider()
      .map((h) => h.trim())
      .filter(Boolean)
      .slice(0, 12);

    if (headlines.length < 2) {
      this.bodyEl.innerHTML = `<div class="sitrep-empty">Not enough live headlines yet to build a report.</div>`;
      return;
    }

    this.isGenerating = true;
    this.regenBtn.disabled = true;
    // Keep any existing report visible behind the loading strip on a forced refresh.
    if (force || !this.cached) {
      this.bodyEl.innerHTML = `<div class="sitrep-loading">Generating situation report…</div>`;
    } else {
      this.bodyEl.querySelector('.sitrep-loading')?.remove();
      this.bodyEl.insertAdjacentHTML('afterbegin', `<div class="sitrep-loading">Refreshing…</div>`);
    }
    this.metaEl.textContent = 'Analyzing live signals…';

    try {
      const result = await generateSituationReport(headlines);
      if (result?.summary) {
        const report: CachedReport = {
          markdown: result.summary,
          provider: result.provider,
          model: result.model,
          generatedAt: Date.now(),
        };
        this.cached = report;
        void setPersistentCache(SituationReportPanel.CACHE_KEY, report);
        this.render(report);
      } else {
        this.renderError();
      }
    } catch {
      this.renderError();
    } finally {
      this.isGenerating = false;
      this.regenBtn.disabled = false;
    }
  }

  private render(report: CachedReport): void {
    this.bodyEl.innerHTML = renderReportMarkdown(report.markdown);
    const model = (report.model || report.provider || '').trim();
    const provenance = report.provider === 'cache'
      ? 'cached'
      : model ? `via ${model}` : '';
    this.metaEl.textContent = [provenance, `updated ${formatRelativeTime(report.generatedAt)}`]
      .filter(Boolean)
      .join(' · ');
  }

  private renderError(): void {
    this.bodyEl.innerHTML = `<div class="sitrep-empty">Couldn't generate a report right now. Try again in a moment.</div>`;
    this.metaEl.textContent = 'Generation failed';
  }

  private renderUnavailable(): void {
    this.bodyEl.innerHTML = `<div class="sitrep-empty">Enable an AI provider in Settings to generate situation reports.</div>`;
    this.metaEl.textContent = 'No AI provider enabled';
  }
}

/** Human-readable "N min ago" style relative time. */
function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * Minimal, safe Markdown→HTML for the constrained report format. Input is
 * escaped first, then a whitelist of inline/block transforms is applied — no
 * raw HTML from the model is ever emitted.
 */
function renderReportMarkdown(markdown: string): string {
  const inline = (text: string): string =>
    escapeHtml(text)
      .replace(/\[Confidence:\s*(HIGH|MODERATE|LOW)\]/gi, (_m, level: string) =>
        `<span class="sitrep-confidence sitrep-confidence-${level.toLowerCase()}">${level.toUpperCase()}</span>`)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let listOpen = false;
  const closeList = () => {
    if (listOpen) { html.push('</ul>'); listOpen = false; }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) { closeList(); continue; }

    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      closeList();
      html.push(`<h3 class="sitrep-section">${inline(heading[1] ?? '')}</h3>`);
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      if (!listOpen) { html.push('<ul class="sitrep-list">'); listOpen = true; }
      html.push(`<li>${inline(bullet[1] ?? '')}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return html.join('');
}
