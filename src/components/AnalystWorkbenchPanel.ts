import { Panel } from './Panel';
import type { BreakingAlert } from '@/services/breaking-news-alerts';
import type { NewsItem } from '@/types';
import { buildSignalEvidenceFromNews } from '@/services/evidence';
import { loadAlertRules, normalizeAlertRule, saveAlertRules, type AlertRule } from '@/services/alert-rules';
import { escapeHtml } from '@/utils/sanitize';

interface WorkbenchWatch {
  id: string;
  label: string;
  query: string;
  createdAt: number;
}

interface WorkbenchOptions {
  getNews: () => NewsItem[];
  openCountryBrief?: (code: string) => void;
}

const WATCHES_KEY = 'wm-analyst-workbench-watches-v1';
const COMMAND_HISTORY_KEY = 'wm-analyst-workbench-history-v1';

const COUNTRY_ALIASES: Record<string, string> = {
  iran: 'IR',
  china: 'CN',
  russia: 'RU',
  ukraine: 'UA',
  israel: 'IL',
  taiwan: 'TW',
  india: 'IN',
  pakistan: 'PK',
  turkey: 'TR',
  'united states': 'US',
  usa: 'US',
  us: 'US',
  germany: 'DE',
  france: 'FR',
  japan: 'JP',
  'south korea': 'KR',
  korea: 'KR',
  'saudi arabia': 'SA',
  egypt: 'EG',
  mexico: 'MX',
  brazil: 'BR',
};

function loadJsonArray<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]') as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeQuery(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function dateLabel(value: Date | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function resolveCountryCode(input: string): string | null {
  const normalized = input.trim().toLowerCase();
  if (/^[a-z]{2}$/i.test(normalized)) return normalized.toUpperCase();
  return COUNTRY_ALIASES[normalized] || null;
}

function matchesNews(item: NewsItem, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  const text = `${item.title} ${item.source} ${item.locationName ?? ''}`.toLowerCase();
  return tokens.every(token => text.includes(token));
}

function buildBriefMarkdown(query: string, items: NewsItem[], rules: AlertRule[]): string {
  const evidence = buildSignalEvidenceFromNews(items);
  const headlines = items.slice(0, 8).map((item, index) => `${index + 1}. ${item.title} (${item.source})`).join('\n');
  const ruleLines = rules.slice(0, 5).map(rule => `- ${rule.name}: ${rule.keywords.join(', ') || 'no keywords'}; evidence=${rule.evidenceRequirement}`).join('\n');
  return [
    `# World Monitor Analyst Brief: ${query}`,
    '',
    `Generated: ${new Date().toISOString()}`,
    `Verification: ${evidence.verificationState}`,
    `Confidence: ${Math.round(evidence.confidence * 100)}%`,
    `Corroboration: ${evidence.corroborationCount} source(s), best tier ${evidence.sourceTier}`,
    '',
    '## Top Headlines',
    headlines || 'No matching headlines in the current dashboard cache.',
    '',
    '## Active Rules In Scope',
    ruleLines || 'No active alert rules configured.',
    '',
    '## Source URLs',
    evidence.sourceUrls.slice(0, 12).map(url => `- ${url}`).join('\n') || 'No source URLs available.',
  ].join('\n');
}

export class AnalystWorkbenchPanel extends Panel {
  private watches: WorkbenchWatch[] = [];
  private rules: AlertRule[] = [];
  private commandHistory: string[] = [];
  private lastOutput = 'Type a command or use one of the actions above.';
  private breakingAlerts: BreakingAlert[] = [];
  private readonly getNews: () => NewsItem[];
  private readonly openCountryBrief?: (code: string) => void;
  private readonly onBreaking = (event: Event) => {
    const alert = (event as CustomEvent<BreakingAlert>).detail;
    if (!alert?.id || this.breakingAlerts.some(entry => entry.id === alert.id)) return;
    this.breakingAlerts.unshift(alert);
    this.breakingAlerts = this.breakingAlerts.slice(0, 8);
    this.renderPanel();
  };

  constructor(options: WorkbenchOptions) {
    super({ id: 'analyst-workbench', title: 'Analyst Workbench', className: 'panel-wide' });
    this.getNews = options.getNews;
    this.openCountryBrief = options.openCountryBrief;
    this.loadState();
    this.content.addEventListener('click', (event) => this.handleClick(event));
    this.content.addEventListener('submit', (event) => this.handleSubmit(event));
    document.addEventListener('wm:breaking-news', this.onBreaking as EventListener);
    this.renderPanel();
  }

  public override destroy(): void {
    document.removeEventListener('wm:breaking-news', this.onBreaking as EventListener);
    super.destroy();
  }

  private loadState(): void {
    this.watches = loadJsonArray<WorkbenchWatch>(WATCHES_KEY);
    this.rules = loadAlertRules();
    this.commandHistory = loadJsonArray<string>(COMMAND_HISTORY_KEY).slice(0, 12);
  }

  private persistWatches(): void {
    saveJson(WATCHES_KEY, this.watches);
  }

  private persistCommand(command: string): void {
    this.commandHistory = [command, ...this.commandHistory.filter(entry => entry !== command)].slice(0, 12);
    saveJson(COMMAND_HISTORY_KEY, this.commandHistory);
  }

  private currentMatches(query: string): NewsItem[] {
    return this.getNews()
      .filter(item => matchesNews(item, query))
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 30);
  }

  private addWatch(query: string): void {
    const normalized = normalizeQuery(query);
    if (!normalized) return;
    const existing = this.watches.find(watch => watch.query.toLowerCase() === normalized.toLowerCase());
    if (existing) {
      this.lastOutput = `Watch already exists: ${existing.label}`;
      return;
    }
    this.watches.unshift({
      id: `watch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: normalized,
      query: normalized,
      createdAt: Date.now(),
    });
    this.watches = this.watches.slice(0, 24);
    this.persistWatches();
    this.lastOutput = `Watch added: ${normalized}`;
  }

  private createRuleFromTrackCommand(query: string): void {
    const normalized = normalizeQuery(query);
    if (!normalized) return;
    const rule = normalizeAlertRule({
      name: `Workbench: ${normalized}`,
      keywords: normalized.split(/\s*\+\s*|\s*,\s*/).filter(Boolean),
      severity: 'high',
      region: 'global',
      entities: normalized,
      signalTypes: ['news', 'market'],
      threshold: 65,
      evidenceRequirement: 'corroborated',
      channels: ['banner', 'desktop'],
    });
    this.rules.unshift(rule);
    saveAlertRules(this.rules);
    this.lastOutput = `Alert rule staged as active: ${rule.name}`;
  }

  private openBrief(query: string): void {
    const countryCode = resolveCountryCode(query);
    if (countryCode && this.openCountryBrief) {
      this.openCountryBrief(countryCode);
      this.lastOutput = `Opened country dossier: ${countryCode}`;
      return;
    }
    const matches = this.currentMatches(query);
    const evidence = buildSignalEvidenceFromNews(matches);
    this.lastOutput = [
      `Brief target: ${query}`,
      `Headlines: ${matches.length}`,
      `Verification: ${evidence.verificationState}`,
      `Confidence: ${Math.round(evidence.confidence * 100)}%`,
      matches.slice(0, 5).map(item => `- ${item.title} (${item.source})`).join('\n') || '- No matching headlines in cache.',
    ].join('\n');
  }

  private exportBrief(query: string): void {
    const matches = this.currentMatches(query);
    const markdown = buildBriefMarkdown(query, matches, this.rules.filter(rule => rule.active));
    void navigator.clipboard?.writeText(markdown).catch(() => {});
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `worldmonitor-brief-${query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export'}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.lastOutput = `Exported brief for ${query}. Markdown was also copied to clipboard when allowed.`;
  }

  private showConflicts(): void {
    const items = this.getNews().filter(item => /\b(denies|disputes|unconfirmed|conflicting reports|contradicts)\b/i.test(item.title)).slice(0, 12);
    this.lastOutput = items.length
      ? items.map(item => `- ${item.title} (${item.source})`).join('\n')
      : 'No conflicting-report headlines detected in the current cache.';
  }

  private executeCommand(raw: string): void {
    const command = normalizeQuery(raw);
    if (!command) return;
    this.persistCommand(command);
    const lower = command.toLowerCase();
    if (lower.startsWith('watch ')) this.addWatch(command.slice(6));
    else if (lower.startsWith('brief ')) this.openBrief(command.slice(6).replace(/\s+\d+h$/i, ''));
    else if (lower.startsWith('export ')) this.exportBrief(command.slice(7));
    else if (lower.startsWith('track ')) this.createRuleFromTrackCommand(command.slice(6));
    else if (lower === 'show conflicting reports' || lower === 'conflicts') this.showConflicts();
    else if (lower === 'help') this.lastOutput = 'Commands: watch <topic>, brief <country/topic>, export <topic>, track <A + B>, show conflicting reports.';
    else this.lastOutput = `Unknown command: ${command}\nTry: watch Taiwan Strait, brief Iran 24h, export Red Sea, track AAPL + oil + MENA.`;
    this.renderPanel();
  }

  private handleClick(event: Event): void {
    const target = event.target as HTMLElement;
    const commandBtn = target.closest<HTMLElement>('[data-aw-command]');
    if (commandBtn?.dataset.awCommand) {
      this.executeCommand(commandBtn.dataset.awCommand);
      return;
    }
    const removeWatchBtn = target.closest<HTMLElement>('[data-aw-remove-watch]');
    if (removeWatchBtn?.dataset.awRemoveWatch) {
      this.watches = this.watches.filter(watch => watch.id !== removeWatchBtn.dataset.awRemoveWatch);
      this.persistWatches();
      this.lastOutput = 'Watch removed.';
      this.renderPanel();
      return;
    }
    const exportBtn = target.closest<HTMLElement>('[data-aw-export]');
    if (exportBtn?.dataset.awExport) {
      this.exportBrief(exportBtn.dataset.awExport);
      this.renderPanel();
      return;
    }
    const explainBtn = target.closest<HTMLElement>('[data-aw-explain-alert]');
    if (explainBtn?.dataset.awExplainAlert) {
      const alert = this.breakingAlerts.find(entry => entry.id === explainBtn.dataset.awExplainAlert);
      if (alert) {
        this.lastOutput = [
          `Alert: ${alert.headline}`,
          `Severity: ${alert.threatLevel}`,
          `Origin: ${alert.origin}`,
          `Source: ${alert.source}`,
          `Seen: ${dateLabel(alert.timestamp)}`,
          alert.link ? `Source URL: ${alert.link}` : 'Source URL: not available',
        ].join('\n');
        this.renderPanel();
      }
    }
  }

  private handleSubmit(event: Event): void {
    const form = (event.target as HTMLElement).closest<HTMLFormElement>('.aw-terminal-form');
    if (!form) return;
    event.preventDefault();
    const input = form.querySelector<HTMLInputElement>('.aw-terminal-input');
    const command = input?.value.trim() || '';
    if (input) input.value = '';
    this.executeCommand(command);
  }

  private renderWatchCards(): string {
    if (this.watches.length === 0) return '<div class="aw-empty">No watches yet.</div>';
    return this.watches.map(watch => {
      const matches = this.currentMatches(watch.query);
      const evidence = matches.length ? buildSignalEvidenceFromNews(matches) : null;
      return `
        <div class="aw-watch">
          <div class="aw-watch-main">
            <strong>${escapeHtml(watch.label)}</strong>
            <span>${matches.length} live match${matches.length === 1 ? '' : 'es'}</span>
          </div>
          <div class="aw-watch-meta">
            <span>${evidence ? escapeHtml(evidence.verificationState) : 'no evidence'}</span>
            <span>${evidence ? `${Math.round(evidence.confidence * 100)}%` : '0%'}</span>
            <button type="button" data-aw-export="${escapeHtml(watch.query)}">Export</button>
            <button type="button" data-aw-remove-watch="${escapeHtml(watch.id)}" aria-label="Remove watch">x</button>
          </div>
        </div>
      `;
    }).join('');
  }

  private renderRules(): string {
    const activeRules = this.rules.filter(rule => rule.active).slice(0, 6);
    if (activeRules.length === 0) return '<div class="aw-empty">No active alert rules.</div>';
    return activeRules.map(rule => `
      <div class="aw-rule">
        <strong>${escapeHtml(rule.name)}</strong>
        <span>${escapeHtml(rule.signalTypes.join(', '))}</span>
        <span>${escapeHtml(rule.evidenceRequirement)}</span>
        <span>${rule.threshold}</span>
      </div>
    `).join('');
  }

  private renderBreakingAlerts(): string {
    if (this.breakingAlerts.length === 0) return '<div class="aw-empty">No breaking alerts captured this session.</div>';
    return this.breakingAlerts.slice(0, 5).map(alert => `
      <div class="aw-alert">
        <div class="aw-alert-main">
          <strong>${escapeHtml(alert.threatLevel.toUpperCase())}</strong>
          <span>${escapeHtml(alert.headline)}</span>
          <small>${escapeHtml(alert.source)} - ${dateLabel(alert.timestamp)}</small>
        </div>
        <div class="aw-watch-meta">
          <button type="button" data-aw-command="brief ${escapeHtml(alert.headline)}">Dossier</button>
          <button type="button" data-aw-explain-alert="${escapeHtml(alert.id)}">Explain</button>
          <button type="button" data-aw-command="watch ${escapeHtml(alert.headline)}">Watch</button>
          <button type="button" data-aw-export="${escapeHtml(alert.headline)}">Export</button>
        </div>
      </div>
    `).join('');
  }

  private renderPanel(): void {
    this.loadState();
    const news = this.getNews();
    const topEvidence = news.length ? buildSignalEvidenceFromNews(news.slice(0, 20)) : null;
    const history = this.commandHistory.map(command => `<button type="button" data-aw-command="${escapeHtml(command)}">${escapeHtml(command)}</button>`).join('');
    this.setContentNow(`
      <div class="analyst-workbench">
        <section class="aw-terminal">
          <div class="aw-terminal-head">
            <div>
              <div class="aw-kicker">Terminal Mode</div>
              <h3>Analyst command surface</h3>
            </div>
            <div class="aw-evidence-badge ${topEvidence ? `state-${topEvidence.verificationState}` : ''}">
              ${topEvidence ? `${escapeHtml(topEvidence.verificationState)} / ${Math.round(topEvidence.confidence * 100)}%` : 'no evidence'}
            </div>
          </div>
          <form class="aw-terminal-form">
            <input class="aw-terminal-input" autocomplete="off" spellcheck="false" placeholder="watch Taiwan Strait | brief Iran 24h | export Red Sea | track AAPL + oil + MENA">
            <button type="submit">Run</button>
          </form>
          <div class="aw-command-row">
            <button type="button" data-aw-command="watch Taiwan Strait">Watch Taiwan Strait</button>
            <button type="button" data-aw-command="brief Iran 24h">Brief Iran</button>
            <button type="button" data-aw-command="export Red Sea">Export Red Sea</button>
            <button type="button" data-aw-command="show conflicting reports">Conflicts</button>
          </div>
          <pre class="aw-output">${escapeHtml(this.lastOutput)}</pre>
          ${history ? `<div class="aw-history">${history}</div>` : ''}
        </section>

        <section class="aw-grid">
          <div class="aw-block">
            <div class="aw-block-head"><h4>Saved Watches</h4><span>${this.watches.length}</span></div>
            ${this.renderWatchCards()}
          </div>
          <div class="aw-block">
            <div class="aw-block-head"><h4>Alert Workflow</h4><span>${this.rules.filter(rule => rule.active).length} active</span></div>
            ${this.renderRules()}
          </div>
          <div class="aw-block">
            <div class="aw-block-head"><h4>Breaking Queue</h4><span>${this.breakingAlerts.length}</span></div>
            ${this.renderBreakingAlerts()}
          </div>
        </section>
      </div>
    `);
  }
}
