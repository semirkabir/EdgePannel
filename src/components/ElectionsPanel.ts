/**
 * ElectionsPanel — Track US federal/state/local and major international elections.
 * Multi-tab: Upcoming, Candidates, Results, Map.
 *
 * Phase 1: Seed data. Phase 2+: API integration (OpenFEC, Democracy Works, etc.)
 */

import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import { getCountryFlag } from '@/utils/country-flags';
import {
  fetchElections,
  formatCurrency,
  formatVotes,
  partyAbbreviation,
} from '@/services/elections';
import type { Election, ElectionStatus } from '@/types/elections';

type ElectionsTab = 'upcoming' | 'candidates' | 'results';

const TABS: ElectionsTab[] = ['upcoming', 'candidates', 'results'];
const TAB_LABELS: Record<ElectionsTab, string> = {
  upcoming: 'Upcoming',
  candidates: 'Candidates',
  results: 'Results',
};

const STATUS_ORDER: Record<ElectionStatus, number> = {
  upcoming: 0,
  active: 1,
  completed: 2,
  cancelled: 3,
};

export class ElectionsPanel extends Panel {
  private elections: Election[] = [];
  private activeTab: ElectionsTab = 'upcoming';
  private selectedElectionId: string | null = null;
  private loading = false;
  private lastFetch = 0;
  private readonly REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // 6h

  static readonly panelKey = 'elections';

  constructor() {
    super({
      id: 'elections',
      title: 'Elections',
      showCount: true,
      trackActivity: true,
      infoTooltip: 'Track elections, candidates, funding, and results across US and major international races.',
    });
  }

  public async refresh(): Promise<void> {
    if (this.loading) return;
    if (Date.now() - this.lastFetch < this.REFRESH_INTERVAL && this.elections.length > 0) {
      return;
    }

    this.loading = true;
    this.showFetchingState();

    try {
      const elections = await fetchElections();
      if (!this.element?.isConnected) return;

      this.elections = elections;
      this.lastFetch = Date.now();
      this.setCount(this.elections.length);
      this.renderContent();
    } catch (error) {
      if (!this.element?.isConnected) return;
      console.error('[ElectionsPanel] Error fetching data:', error);
      this.showError('Failed to load election data');
    } finally {
      this.loading = false;
    }
  }

  private showFetchingState(): void {
    this.setContent(`
      <div class="elections-fetch-progress">
        <div class="elections-fetch-icon">
          <div class="elections-ballot-ring"></div>
          <span class="elections-ballot">🗳️</span>
        </div>
        <div class="elections-fetch-title">Loading election data…</div>
      </div>
    `);
  }

  private renderContent(): void {
    if (this.elections.length === 0) {
      this.showError('No election data available');
      return;
    }

    // Stats summary
    const upcoming = this.elections.filter(e => e.status === 'upcoming' || e.status === 'active');
    const completed = this.elections.filter(e => e.status === 'completed');
    const usRaces = this.elections.filter(e => e.country === 'US');
    const intlRaces = this.elections.filter(e => e.country !== 'US');

    const statsHtml = `
      <div class="elections-stats-grid">
        <div class="elections-stat-box elections-stat-upcoming">
          <span class="elections-stat-value">${upcoming.length}</span>
          <span class="elections-stat-label">Upcoming</span>
        </div>
        <div class="elections-stat-box elections-stat-completed">
          <span class="elections-stat-value">${completed.length}</span>
          <span class="elections-stat-label">Completed</span>
        </div>
        <div class="elections-stat-box elections-stat-us">
          <span class="elections-stat-value">🇺🇸 ${usRaces.length}</span>
          <span class="elections-stat-label">US Races</span>
        </div>
        <div class="elections-stat-box elections-stat-intl">
          <span class="elections-stat-value">🌍 ${intlRaces.length}</span>
          <span class="elections-stat-label">International</span>
        </div>
      </div>
    `;

    // Tabs
    const tabsHtml = `
      <div class="panel-tabs panel-tabs--wrap">
        ${TABS.map(tab => `<button class="panel-tab ${this.activeTab === tab ? 'active' : ''}" data-tab="${tab}">${TAB_LABELS[tab]}</button>`).join('')}
      </div>
    `;

    // Tab content
    let contentHtml: string;
    switch (this.activeTab) {
      case 'upcoming':
        contentHtml = this.renderUpcoming();
        break;
      case 'candidates':
        contentHtml = this.renderCandidates();
        break;
      case 'results':
        contentHtml = this.renderResults();
        break;
    }

    // Write directly for immediate tab listeners
    this.content.innerHTML = `
      <div class="elections-panel-content">
        ${statsHtml}
        ${tabsHtml}
        ${contentHtml}
      </div>
    `;

    // Attach tab listeners
    this.content.querySelectorAll('.panel-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = (btn as HTMLElement).dataset.tab as ElectionsTab;
        this.renderContent();
      });
    });

    // Attach election item click listeners (for candidate detail)
    this.content.querySelectorAll('.elections-item[data-election-id]').forEach(item => {
      item.addEventListener('click', () => {
        const id = (item as HTMLElement).dataset.electionId;
        if (id) {
          this.selectedElectionId = this.selectedElectionId === id ? null : id;
          this.renderContent();
        }
      });
    });
  }

  private renderUpcoming(): string {
    const sorted = [...this.elections]
      .filter(e => e.status === 'upcoming' || e.status === 'active')
      .sort((a, b) => a.date.localeCompare(b.date));

    if (sorted.length === 0) {
      return `<div class="elections-empty">No upcoming elections in dataset</div>`;
    }

    const items = sorted.map(election => {
      const flag = this.getFlag(election.country);
      const dateStr = new Date(election.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const levelLabel = election.level.charAt(0).toUpperCase() + election.level.slice(1);
      const isExpanded = this.selectedElectionId === election.id;

      const candidateBars = election.candidates.map(c => {
        const abbr = partyAbbreviation(c.party);
        const fundingStr = c.fundingTotal ? formatCurrency(c.fundingTotal) : '';
        const incumbentBadge = c.incumbency ? '<span class="elections-incumbent-badge">(I)</span>' : '';
        return `
          <div class="elections-candidate-row">
            <span class="elections-candidate-party" style="background: ${c.partyColor}20; color: ${c.partyColor}; border: 1px solid ${c.partyColor}40;">${abbr}</span>
            <span class="elections-candidate-name">${escapeHtml(c.name)} ${incumbentBadge}</span>
            ${fundingStr ? `<span class="elections-candidate-funding">${fundingStr}</span>` : ''}
          </div>
        `;
      }).join('');

      return `
        <div class="elections-item ${isExpanded ? 'elections-item-expanded' : ''}" data-election-id="${escapeHtml(election.id)}">
          <div class="elections-item-header">
            <span class="elections-flag">${flag}</span>
            <div class="elections-item-info">
              <span class="elections-item-name">${escapeHtml(election.name)}</span>
              <span class="elections-item-meta">${levelLabel} · ${escapeHtml(election.office)}${election.district && election.district !== 'Statewide' ? ` · ${escapeHtml(election.district)}` : ''}</span>
            </div>
            <span class="elections-date">${dateStr}</span>
            <span class="elections-status-chip ${election.status}">${election.status}</span>
          </div>
          ${isExpanded ? `<div class="elections-item-detail"><div class="elections-candidates-list">${candidateBars}</div></div>` : ''}
        </div>
      `;
    }).join('');

    return `<div class="elections-list">${items}</div>`;
  }

  private renderCandidates(): string {
    // Show all candidates from all elections, grouped by election
    const sorted = [...this.elections].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

    const sections = sorted.map(election => {
      const flag = this.getFlag(election.country);
      const statusBadge = election.status === 'completed'
        ? `<span class="elections-status-chip completed">completed</span>`
        : election.status === 'active'
          ? `<span class="elections-status-chip active">active</span>`
          : `<span class="elections-status-chip upcoming">upcoming</span>`;

      const candidates = election.candidates.map(c => {
        const abbr = partyAbbreviation(c.party);
        const fundingInfo = c.fundingTotal
          ? `<span class="elections-candidate-funding">Raised: ${formatCurrency(c.fundingTotal)}</span>`
          : '';
        const spentInfo = c.fundingSpent
          ? `<span class="elections-candidate-funding">Spent: ${formatCurrency(c.fundingSpent)}</span>`
          : '';
        const incumbentBadge = c.incumbency ? '<span class="elections-incumbent-badge">(I)</span>' : '';

        return `
          <div class="elections-candidate-card">
            <div class="elections-candidate-card-header">
              <span class="elections-candidate-party" style="background: ${c.partyColor}20; color: ${c.partyColor}; border: 1px solid ${c.partyColor}40;">${abbr}</span>
              <span class="elections-candidate-name">${escapeHtml(c.name)} ${incumbentBadge}</span>
            </div>
            <div class="elections-candidate-card-meta">
              ${fundingInfo}
              ${spentInfo}
            </div>
            ${c.policies && c.policies.length > 0 ? this.renderPolicies(c.policies) : ''}
          </div>
        `;
      }).join('');

      return `
        <div class="elections-group">
          <div class="elections-group-header">
            <span class="elections-flag">${flag}</span>
            <span class="elections-group-title">${escapeHtml(election.name)}</span>
            ${statusBadge}
          </div>
          <div class="elections-candidates-grid">${candidates}</div>
        </div>
      `;
    }).join('');

    return `<div class="elections-candidates-view">${sections}</div>`;
  }

  private renderPolicies(policies: import('@/types/elections').Policy[]): string {
    const items = policies.map(p => `
      <div class="elections-policy-item">
        <span class="elections-policy-category">${escapeHtml(p.category)}</span>
        <span class="elections-policy-position">${escapeHtml(p.position)}</span>
      </div>
    `).join('');
    return `<div class="elections-policies">${items}</div>`;
  }

  private renderResults(): string {
    const completed = this.elections.filter(e => e.status === 'completed' && e.results);

    if (completed.length === 0) {
      return `<div class="elections-empty">No completed election results in dataset</div>`;
    }

    const items = completed.map(election => {
      const flag = this.getFlag(election.country);
      const isExpanded = this.selectedElectionId === election.id;

      // Find winner
      const winner = election.results?.find(r => r.winner);
      const winnerCandidate = winner ? election.candidates.find(c => c.id === winner.candidateId) : null;

      const resultBars = (election.results ?? []).map(r => {
        const candidate = election.candidates.find(c => c.id === r.candidateId);
        const name = candidate ? candidate.name : 'Unknown';
        const party = candidate ? candidate.party : 'Other';
        const partyColor = candidate ? candidate.partyColor : '#6b7280';
        const abbr = partyAbbreviation(party);
        const winnerStar = r.winner ? ' ★' : '';

        return `
          <div class="elections-result-bar">
            <div class="elections-result-bar-header">
              <span class="elections-candidate-party" style="background: ${partyColor}20; color: ${partyColor}; border: 1px solid ${partyColor}40;">${abbr}</span>
              <span class="elections-result-name">${escapeHtml(name)}${winnerStar}</span>
              <span class="elections-result-pct" style="color: ${partyColor}">${r.percentage.toFixed(1)}%</span>
            </div>
            <div class="elections-result-bar-track">
              <div class="elections-result-bar-fill" style="width: ${r.percentage}%; background: ${partyColor};"></div>
            </div>
            <div class="elections-result-votes">${formatVotes(r.votes)} votes</div>
          </div>
        `;
      }).join('');

      return `
        <div class="elections-item ${isExpanded ? 'elections-item-expanded' : ''}" data-election-id="${escapeHtml(election.id)}">
          <div class="elections-item-header">
            <span class="elections-flag">${flag}</span>
            <div class="elections-item-info">
              <span class="elections-item-name">${escapeHtml(election.name)}</span>
              ${winnerCandidate ? `<span class="elections-winner">Winner: ${escapeHtml(winnerCandidate.name)}</span>` : ''}
            </div>
            <span class="elections-status-chip completed">completed</span>
          </div>
          ${isExpanded ? `<div class="elections-item-detail"><div class="elections-results-list">${resultBars}</div></div>` : ''}
        </div>
      `;
    }).join('');

    return `<div class="elections-list">${items}</div>`;
  }

  private getFlag(countryCode: string): string {
    return getCountryFlag(countryCode);
  }
}
