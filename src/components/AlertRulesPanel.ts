import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import { getAgentAlertDrafts, setAgentAlertDrafts, type AgentAlertDraft } from '@/services/agent-gateway';
import { loadAlertRules, normalizeAlertRule, saveAlertRules, type AlertRule, type AlertRuleChannel } from '@/services/alert-rules';
import { getAlertRuleFireState, deliveryPending } from '@/services/alert-rule-engine';
import { loadStoredDrawnZones, type DrawnZone } from './map-draw/geometry';
import { canAccessFeature } from '@/services/feature-flags';

export class AlertRulesPanel extends Panel {
  private rules: AlertRule[] = [];
  private drafts: AgentAlertDraft[] = [];
  /** Rule id currently open in the inline editor, if any. */
  private editingId: string | null = null;
  private zones: DrawnZone[] = [];
  private readonly draftsHandler = () => {
    this.loadDrafts();
    this.renderPanel();
  };
  /** Repaint so the rule's "last fired" line updates the moment it triggers. */
  private readonly firedHandler = () => {
    if (this.editingId) return; // don't blow away a half-typed edit
    this.renderPanel();
  };

  constructor() {
    super({ id: 'alert-rules', title: '🔔 Alert Rules Engine' });
    this.loadRules();
    this.loadDrafts();
    window.addEventListener('wm-agent-alert-drafts-changed', this.draftsHandler);
    document.addEventListener('wm:alert-rule-fired', this.firedHandler);
    
    this.content.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      const addBtn = target.closest('.btn-add-rule');
      if (addBtn) {
        this.addRule();
        return;
      }
      
      const toggleBtn = target.closest('.rule-toggle-btn') as HTMLElement;
      if (toggleBtn?.dataset.id) {
        this.toggleRule(toggleBtn.dataset.id);
        return;
      }
      
      const deleteBtn = target.closest('.rule-delete-btn') as HTMLElement;
      if (deleteBtn?.dataset.id) {
        this.deleteRule(deleteBtn.dataset.id);
        return;
      }

      const editBtn = target.closest('.rule-edit-btn') as HTMLElement;
      if (editBtn?.dataset.id) {
        this.editingId = this.editingId === editBtn.dataset.id ? null : editBtn.dataset.id;
        this.zones = loadStoredDrawnZones();
        this.renderPanel();
        return;
      }

      if (target.closest('.rule-edit-cancel')) {
        this.editingId = null;
        this.renderPanel();
        return;
      }

      const saveBtn = target.closest('.rule-edit-save') as HTMLElement;
      if (saveBtn?.dataset.id) {
        this.saveEdit(saveBtn.dataset.id);
        return;
      }

      const approveDraftBtn = target.closest('.draft-approve-btn') as HTMLElement;
      if (approveDraftBtn?.dataset.id) {
        this.approveDraft(approveDraftBtn.dataset.id);
        return;
      }

      const rejectDraftBtn = target.closest('.draft-reject-btn') as HTMLElement;
      if (rejectDraftBtn?.dataset.id) {
        this.rejectDraft(rejectDraftBtn.dataset.id);
        return;
      }
    });

    // A drawn zone overrides the coarse region, so reflect that live.
    this.content.addEventListener('change', (e) => {
      const target = e.target as HTMLElement;

      const zoneSel = target.closest('.edit-zone') as HTMLSelectElement | null;
      if (zoneSel) {
        const form = zoneSel.closest('.rule-edit-form');
        const regionSel = form?.querySelector<HTMLSelectElement>('.edit-region');
        if (regionSel) regionSel.disabled = Boolean(zoneSel.value);
        return;
      }

      // Toggling a channel checkbox shows/hides its destination input.
      const emailToggle = target.closest('.edit-channel-email') as HTMLInputElement | null;
      if (emailToggle) {
        const field = emailToggle.closest('.rule-edit-form')?.querySelector<HTMLElement>('.edit-email-field');
        if (field) field.style.display = emailToggle.checked ? '' : 'none';
        return;
      }
      const webhookToggle = target.closest('.edit-channel-webhook') as HTMLInputElement | null;
      if (webhookToggle) {
        const field = webhookToggle.closest('.rule-edit-form')?.querySelector<HTMLElement>('.edit-webhook-field');
        if (field) field.style.display = webhookToggle.checked ? '' : 'none';
      }
    });

    this.renderPanel();
  }

  public override destroy(): void {
    window.removeEventListener('wm-agent-alert-drafts-changed', this.draftsHandler);
    document.removeEventListener('wm:alert-rule-fired', this.firedHandler);
    super.destroy();
  }

  private loadRules() {
    this.rules = loadAlertRules();
    if (this.rules.length === 0) {
      this.rules = [
        normalizeAlertRule({
          id: '1',
          name: 'Critical Oil Infrastructure',
          keywords: ['oil', 'refinery', 'pipeline', 'attack', 'strike'],
          severity: 'high',
          region: 'mena',
          signalTypes: ['news', 'infrastructure'],
          threshold: 65,
          evidenceRequirement: 'corroborated',
        }),
        normalizeAlertRule({
          id: '2',
          name: 'Taiwan Strait Tensions',
          keywords: ['taiwan strait', 'pla', 'military', 'incursion'],
          severity: 'all',
          region: 'asia',
          signalTypes: ['news', 'military'],
          threshold: 60,
          evidenceRequirement: 'any',
        }),
      ];
      this.saveRules();
    }
  }

  private saveRules() {
    try { saveAlertRules(this.rules); } catch { /* ignore */ }
  }

  private loadDrafts() {
    this.drafts = getAgentAlertDrafts();
  }

  private addRule() {
    const rule = normalizeAlertRule({
      id: Date.now().toString(),
      name: 'New Custom Rule',
      keywords: [],
      severity: 'high',
      region: 'global',
      notifications: true,
      signalTypes: ['news'],
      threshold: 60,
      evidenceRequirement: 'any',
    });
    this.rules.push(rule);
    this.saveRules();
    // Open straight into the editor — a rule with no keywords can't match anything.
    this.editingId = rule.id;
    this.zones = loadStoredDrawnZones();
    this.renderPanel();
  }

  /** Read the inline editor's fields back into the rule. */
  private saveEdit(id: string) {
    const rule = this.rules.find(r => r.id === id);
    const form = this.content.querySelector<HTMLElement>(`.rule-edit-form[data-id="${CSS.escape(id)}"]`);
    if (!rule || !form) return;

    const value = (sel: string): string =>
      form.querySelector<HTMLInputElement | HTMLSelectElement>(sel)?.value.trim() ?? '';
    const checked = (sel: string): boolean =>
      form.querySelector<HTMLInputElement>(sel)?.checked ?? false;

    const zoneId = value('.edit-zone');
    const zone = zoneId ? this.zones.find(z => z.id === zoneId) : null;

    const channels: AlertRuleChannel[] = [
      ...(checked('.edit-channel-banner') ? ['banner' as const] : []),
      ...(checked('.edit-channel-desktop') ? ['desktop' as const] : []),
      ...(checked('.edit-channel-email') ? ['email' as const] : []),
      ...(checked('.edit-channel-webhook') ? ['webhook' as const] : []),
    ];

    const updated = normalizeAlertRule({
      ...rule,
      name: value('.edit-name') || rule.name,
      keywords: value('.edit-keywords'),
      matchMode: value('.edit-match-mode'),
      severity: value('.edit-severity'),
      region: value('.edit-region'),
      threshold: Number(value('.edit-threshold')),
      channels,
      email: value('.edit-email'),
      webhookUrl: value('.edit-webhook-url'),
      // Snapshot the ring so the rule survives the drawing being edited/removed.
      zone: zone ? { id: zone.id, name: zone.name, ring: zone.ring } : null,
      updatedAt: Date.now(),
    });

    this.rules = this.rules.map(r => (r.id === id ? updated : r));
    this.saveRules();
    this.editingId = null;
    this.renderPanel();
  }

  private toggleRule(id: string) {
    const rule = this.rules.find(r => r.id === id);
    if (rule) {
      rule.active = !rule.active;
      rule.updatedAt = Date.now();
      this.saveRules();
      this.renderPanel();
    }
  }

  private deleteRule(id: string) {
    this.rules = this.rules.filter(r => r.id !== id);
    this.saveRules();
    this.renderPanel();
  }

  private approveDraft(id: string) {
    const draft = this.drafts.find(d => d.id === id);
    if (!draft) return;
    this.rules.push(normalizeAlertRule({
      id: Date.now().toString(),
      name: draft.name,
      keywords: draft.keywords,
      severity: draft.severity,
      region: draft.region,
      notifications: draft.notifications,
      entities: draft.entities,
      signalTypes: draft.signalTypes,
      threshold: draft.threshold,
      cooldownMinutes: draft.cooldownMinutes,
      channels: draft.channels,
      evidenceRequirement: draft.evidenceRequirement,
    }));
    this.saveRules();
    this.drafts = this.drafts.filter(d => d.id !== id);
    setAgentAlertDrafts(this.drafts);
    this.renderPanel();
  }

  private rejectDraft(id: string) {
    this.drafts = this.drafts.filter(d => d.id !== id);
    setAgentAlertDrafts(this.drafts);
    this.renderPanel();
  }

  /** Inline editor. Zones come from shapes drawn with the map's Draw tool. */
  private renderEditForm(rule: AlertRule): string {
    const opt = (value: string, label: string, selected: boolean) =>
      `<option value="${escapeHtml(value)}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;

    const regions: Array<[string, string]> = [
      ['global', 'Global'], ['mena', 'MENA'], ['europe', 'Europe'],
      ['asia', 'Asia'], ['americas', 'Americas'], ['africa', 'Africa'],
    ];

    // A zone saved on the rule may no longer exist as a drawing; keep it listed
    // so editing an unrelated field doesn't silently drop the geofence.
    const zoneOptions = [...this.zones];
    if (rule.zone && !zoneOptions.some(z => z.id === rule.zone!.id)) {
      zoneOptions.push({ id: rule.zone.id, name: `${rule.zone.name} (saved)`, ring: rule.zone.ring });
    }

    const webhookLocked = !canAccessFeature('webhook-alerts');
    const has = (ch: AlertRuleChannel) => rule.channels.includes(ch);
    const channelCheckbox = (cls: string, ch: AlertRuleChannel, label: string, locked = false) => `
      <label class="rule-edit-field rule-edit-checkbox${locked ? ' rule-edit-checkbox-locked' : ''}">
        <input type="checkbox" class="${cls}"${has(ch) ? ' checked' : ''}${locked ? ' disabled' : ''}>
        <span>${label}${locked ? ' <small>(Analyst plan required)</small>' : ''}</span>
      </label>
    `;

    return `
      <div class="rule-edit-form" data-id="${rule.id}">
        <label class="rule-edit-field">
          <span>Name</span>
          <input class="edit-name" type="text" value="${escapeHtml(rule.name)}" maxlength="96">
        </label>
        <label class="rule-edit-field">
          <span>Keywords <small>(comma-separated)</small></span>
          <input class="edit-keywords" type="text" value="${escapeHtml(rule.keywords.join(', '))}"
                 placeholder="oil, pipeline, strike">
        </label>
        <div class="rule-edit-row">
          <label class="rule-edit-field">
            <span>Match</span>
            <select class="edit-match-mode">
              ${opt('any', 'Any keyword', rule.matchMode === 'any')}
              ${opt('all', 'All keywords', rule.matchMode === 'all')}
            </select>
          </label>
          <label class="rule-edit-field">
            <span>Severity</span>
            <select class="edit-severity">
              ${opt('all', 'All', rule.severity === 'all')}
              ${opt('high', 'High', rule.severity === 'high')}
              ${opt('critical', 'Critical', rule.severity === 'critical')}
            </select>
          </label>
          <label class="rule-edit-field">
            <span>Score ≥</span>
            <input class="edit-threshold" type="number" min="1" max="100" value="${rule.threshold}">
          </label>
        </div>
        <div class="rule-edit-row">
          <label class="rule-edit-field">
            <span>Region</span>
            <select class="edit-region"${rule.zone ? ' disabled' : ''}>
              ${regions.map(([v, l]) => opt(v, l, rule.region === v)).join('')}
            </select>
          </label>
          <label class="rule-edit-field">
            <span>Drawn zone <small>(overrides region)</small></span>
            <select class="edit-zone">
              ${opt('', zoneOptions.length ? 'None — use region' : 'None — draw a zone on the map', !rule.zone)}
              ${zoneOptions.map(z => opt(z.id, z.name, rule.zone?.id === z.id)).join('')}
            </select>
          </label>
        </div>
        <div class="rule-edit-row rule-edit-channels">
          <span class="rule-edit-channels-label">Deliver via</span>
          ${channelCheckbox('edit-channel-banner', 'banner', 'Banner')}
          ${channelCheckbox('edit-channel-desktop', 'desktop', 'Desktop')}
          ${channelCheckbox('edit-channel-email', 'email', 'Email')}
          ${channelCheckbox('edit-channel-webhook', 'webhook', 'Webhook', webhookLocked)}
        </div>
        <label class="rule-edit-field edit-email-field" style="${has('email') ? '' : 'display:none;'}">
          <span>Email address</span>
          <input class="edit-email" type="email" value="${escapeHtml(rule.email)}" placeholder="you@example.com">
        </label>
        <label class="rule-edit-field edit-webhook-field" style="${has('webhook') && !webhookLocked ? '' : 'display:none;'}">
          <span>Webhook URL</span>
          <input class="edit-webhook-url" type="url" value="${escapeHtml(rule.webhookUrl)}" placeholder="https://...">
        </label>
        <div class="rule-edit-actions">
          <button class="btn btn-sm rule-edit-save" data-id="${rule.id}">Save</button>
          <button class="btn btn-sm btn-ghost rule-edit-cancel">Cancel</button>
        </div>
      </div>
    `;
  }

  private renderPanel(): void {
    if (this.rules.length === 0 && this.drafts.length === 0) {
      this.setContent(`
        <div class="alerts-container">
          <div class="alerts-empty">
            <div class="alerts-empty-icon">🔔</div>
            <div class="alerts-empty-title">No Alert Rules Configured</div>
            <div class="alerts-empty-text">Create rules to receive desktop notifications and highlight critical events on the map based on your specific requirements.</div>
            <button class="btn btn-add-rule">+ Create Alert Rule</button>
          </div>
        </div>
      `);
      return;
    }

    const draftHtml = this.drafts.length > 0 ? `
      <div class="alerts-header">
        <span class="alerts-count">${this.drafts.length} Agent Draft${this.drafts.length === 1 ? '' : 's'} Pending</span>
      </div>
      <div class="alerts-list">
        ${this.drafts.map(draft => `
          <div class="alert-rule-card staged">
            <div class="rule-header">
              <span class="rule-name">${escapeHtml(draft.name)}</span>
              <div class="rule-actions">
                <button class="rule-action-btn draft-approve-btn" data-id="${draft.id}" title="Approve draft">Approve</button>
                <button class="rule-action-btn draft-reject-btn" data-id="${draft.id}" title="Reject draft">Reject</button>
              </div>
            </div>
            <div class="rule-details">
              <div class="rule-detail-row">
                <span class="rule-label">Keywords:</span>
                <div class="rule-tags">${draft.keywords.map(k => `<span class="rule-tag">${escapeHtml(k)}</span>`).join('')}</div>
              </div>
              <div class="rule-detail-row">
                <span class="rule-label">Evidence:</span>
                <span class="rule-value">${escapeHtml(draft.evidenceRequirement || 'any')}</span>
                <span class="rule-label" style="margin-left:12px;">Signals:</span>
                <span class="rule-value">${escapeHtml((draft.signalTypes || ['news']).join(', '))}</span>
              </div>
              <div class="rule-detail-row">
                <span class="rule-label">Severity:</span>
                <span class="rule-value severity-${draft.severity}">${escapeHtml(draft.severity.toUpperCase())}</span>
                <span class="rule-label" style="margin-left:12px;">Region:</span>
                <span class="rule-value">${escapeHtml(draft.region.toUpperCase())}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    ` : '';

    // Channels the rules ask for that have no delivery path yet. Saying so
    // beats letting someone believe an email went out.
    const pendingChannels = [...new Set(
      this.rules.filter(r => r.active).flatMap(r => deliveryPending(r)),
    )];
    const undeliverableNote = pendingChannels.length > 0 ? `
      <div class="rule-pending-note">
        ⚠ ${escapeHtml(pendingChannels.join(', '))} delivery isn't wired up yet — these rules still alert via banner and the notification inbox.
      </div>
    ` : '';

    const html = `
      <div class="alerts-container">
        ${draftHtml}
        ${undeliverableNote}
        <div class="alerts-header">
          <span class="alerts-count">${this.rules.filter(r => r.active).length} Active Rules</span>
          <button class="btn btn-sm btn-add-rule">+ New Rule</button>
        </div>
        <div class="alerts-list">
          ${this.rules.map(rule => `
            <div class="alert-rule-card ${!rule.active ? 'inactive' : ''}">
              <div class="rule-header">
                <span class="rule-name">${escapeHtml(rule.name)}</span>
                <div class="rule-actions">
                  <button class="rule-action-btn rule-edit-btn" data-id="${rule.id}" title="Edit rule">
                    ✏️
                  </button>
                  <button class="rule-action-btn rule-toggle-btn" data-id="${rule.id}" title="Toggle active">
                    ${rule.active ? '🟢' : '⚫'}
                  </button>
                  <button class="rule-action-btn rule-delete-btn" data-id="${rule.id}" title="Delete rule">
                    🗑️
                  </button>
                </div>
              </div>
              ${this.editingId === rule.id ? this.renderEditForm(rule) : `
              <div class="rule-details">
                <div class="rule-detail-row">
                  <span class="rule-label">Keywords:</span>
                  <div class="rule-tags">
                    ${rule.keywords.length
                      ? rule.keywords.map(k => `<span class="rule-tag">${escapeHtml(k)}</span>`).join('')
                      : '<span class="rule-value rule-value-muted">none — edit to add</span>'}
                  </div>
                  ${rule.keywords.length > 1 ? `<span class="rule-match-mode">match ${escapeHtml(rule.matchMode)}</span>` : ''}
                </div>
                <div class="rule-detail-row">
                  <span class="rule-label">Signals:</span>
                  <span class="rule-value">${escapeHtml(rule.signalTypes.join(', '))}</span>
                  <span class="rule-label" style="margin-left:12px;">Evidence:</span>
                  <span class="rule-value">${escapeHtml(rule.evidenceRequirement)}</span>
                </div>
                <div class="rule-detail-row">
                  <span class="rule-label">Severity:</span>
                  <span class="rule-value severity-${rule.severity}">${escapeHtml(rule.severity.toUpperCase())}</span>

                  <span class="rule-label" style="margin-left:12px;">Area:</span>
                  <span class="rule-value">${rule.zone
                    ? `<span class="rule-zone-chip" title="Geofenced to a drawn zone">⬡ ${escapeHtml(rule.zone.name)}</span>`
                    : escapeHtml(rule.region.toUpperCase())}</span>
                  <span class="rule-label" style="margin-left:12px;">Score:</span>
                  <span class="rule-value">${rule.threshold}</span>
                </div>
                ${this.renderRuleStatus(rule)}
              </div>
              `}
            </div>
          `).join('')}
        </div>
        <div class="alerts-footer">
          <small>Active rules are evaluated against incoming news on every refresh, over a rolling 60-minute window. Turn on browser notifications to get alerts while the tab is in the background.</small>
        </div>
      </div>
    `;

    this.setContent(html);
  }

  /** "Armed" / "last fired" line — makes it visible that a rule is actually live. */
  private renderRuleStatus(rule: AlertRule): string {
    if (!rule.active) {
      return '<div class="rule-status rule-status-idle">Paused</div>';
    }
    if (rule.keywords.length === 0 && rule.entities.length === 0) {
      return '<div class="rule-status rule-status-warn">No keywords — this rule can never match. Edit to add some.</div>';
    }

    const state = getAlertRuleFireState(rule.id);
    if (!state) {
      return `<div class="rule-status rule-status-armed">Armed · watching for matches</div>`;
    }

    const mins = Math.max(0, Math.round((Date.now() - state.lastFiredAt) / 60000));
    const when = mins < 1 ? 'just now'
      : mins < 60 ? `${mins}m ago`
      : mins < 1440 ? `${Math.round(mins / 60)}h ago`
      : `${Math.round(mins / 1440)}d ago`;
    const matched = state.signature ? ` · matched ${escapeHtml(state.signature)}` : '';
    const cooling = mins < rule.cooldownMinutes
      ? ` · cooling down for ${rule.cooldownMinutes - mins}m`
      : '';
    return `<div class="rule-status rule-status-fired">Last fired ${when}${matched}${cooling}</div>`;
  }
}
