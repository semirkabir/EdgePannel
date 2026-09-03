import {
  getAgentGatewayStatus,
  saveAgentAlertDrafts,
  sendAgentChat,
  type AgentGatewayStatus,
} from '@/services/agent-gateway';
import {
  applyAgentMapToolEvents,
  type AgentMapAccessors,
} from '@/services/map-agent-bridge';
import { escapeHtml } from '@/utils/sanitize';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Provenance shown under assistant replies: which model answered, how many live tools it hit. */
  meta?: { model?: string; sourceCount?: number };
}

export class AgentChatPanel {
  private overlay: HTMLElement;
  private panel: HTMLElement;
  private messagesEl: HTMLElement;
  private inputEl: HTMLTextAreaElement;
  private connectorSelect: HTMLSelectElement;
  private statusEl: HTMLElement;
  private messages: ChatMessage[] = [];
  private status: AgentGatewayStatus | null = null;
  private isSending = false;

  /** Injected by event-handlers; lets agent map tools drive the live map. */
  private mapAccessors: AgentMapAccessors | null = null;

  public setMapAccessors(accessors: AgentMapAccessors): void {
    this.mapAccessors = accessors;
  }

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'agent-chat-overlay';
    this.overlay.hidden = true;

    this.panel = document.createElement('aside');
    this.panel.className = 'agent-chat-panel';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-label', 'Agent chat');

    this.panel.innerHTML = `
      <header class="agent-chat-header">
        <div>
          <h2>Agent Chat</h2>
          <p>Connected to EdgePannel live tools</p>
        </div>
        <button type="button" class="agent-chat-close" aria-label="Close">×</button>
      </header>
      <div class="agent-chat-controls">
        <select class="agent-chat-connector" aria-label="Agent connector"></select>
        <span class="agent-chat-status">Loading…</span>
      </div>
      <div class="agent-chat-messages"></div>
      <form class="agent-chat-form">
        <textarea class="agent-chat-input" rows="3" placeholder="Ask an agent to inspect live signals…"></textarea>
        <button type="submit" class="agent-chat-send">Send</button>
      </form>
    `;

    this.overlay.appendChild(this.panel);
    document.body.appendChild(this.overlay);

    this.messagesEl = this.panel.querySelector<HTMLElement>('.agent-chat-messages')!;
    this.inputEl = this.panel.querySelector<HTMLTextAreaElement>('.agent-chat-input')!;
    this.connectorSelect = this.panel.querySelector<HTMLSelectElement>('.agent-chat-connector')!;
    this.statusEl = this.panel.querySelector<HTMLElement>('.agent-chat-status')!;

    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay || (event.target as HTMLElement).closest('.agent-chat-close')) {
        this.close();
      }
    });
    this.panel.querySelector<HTMLFormElement>('.agent-chat-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.send();
    });
  }

  public async open(): Promise<void> {
    this.overlay.hidden = false;
    this.overlay.classList.add('active');
    await this.refreshStatus();
    this.inputEl.focus();
  }

  public close(): void {
    this.overlay.classList.remove('active');
    this.overlay.hidden = true;
  }

  public destroy(): void {
    this.overlay.remove();
  }

  private async refreshStatus(): Promise<void> {
    try {
      this.status = await getAgentGatewayStatus();
      const chatConnectors = this.status.connectors.filter(connector => connector.type === 'openai-compatible' && connector.enabled);
      this.connectorSelect.innerHTML = chatConnectors.length
        ? chatConnectors.map(connector => `<option value="${escapeHtml(connector.id)}">${escapeHtml(connector.name)}</option>`).join('')
        : '<option value="">No chat connector configured</option>';
      if (chatConnectors.length) {
        const connectorLabel = `${chatConnectors.length} connector${chatConnectors.length === 1 ? '' : 's'}`;
        const toolCount = this.status.tools?.length ?? 0;
        this.statusEl.textContent = toolCount
          ? `${connectorLabel} · ${toolCount} live tool${toolCount === 1 ? '' : 's'}`
          : connectorLabel;
      } else {
        this.statusEl.textContent = 'Configure an Agent API in Settings';
      }
    } catch (error) {
      this.statusEl.textContent = error instanceof Error ? error.message : 'Agent gateway unavailable';
      this.connectorSelect.innerHTML = '<option value="">Unavailable</option>';
    }
  }

  private addMessage(message: ChatMessage): void {
    this.messages.push(message);
    this.renderMessages();
  }

  /** Human-readable model label for the currently selected connector. */
  private selectedModelLabel(): string {
    const connectorId = this.connectorSelect.value;
    const connector = this.status?.connectors.find(c => c.id === connectorId);
    return (connector?.model || connector?.name || '').trim();
  }

  private renderMessageMeta(meta?: ChatMessage['meta']): string {
    if (!meta) return '';
    const parts: string[] = [];
    if (meta.model) parts.push(`via ${escapeHtml(meta.model)}`);
    if (typeof meta.sourceCount === 'number') {
      parts.push(`${meta.sourceCount} live source${meta.sourceCount === 1 ? '' : 's'}`);
    }
    if (!parts.length) return '';
    return `<div class="agent-chat-meta">${parts.join(' · ')}</div>`;
  }

  private renderMessages(extraHtml = ''): void {
    const html = this.messages.map(message => `
      <div class="agent-chat-msg ${message.role}">
        <span class="agent-chat-role">${message.role === 'user' ? 'You' : 'Agent'}</span>
        <div class="agent-chat-bubble">${escapeHtml(message.content)}</div>
        ${message.role === 'assistant' ? this.renderMessageMeta(message.meta) : ''}
      </div>
    `).join('');
    this.messagesEl.innerHTML = html + extraHtml;
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private async send(): Promise<void> {
    if (this.isSending) return;
    const connectorId = this.connectorSelect.value;
    const content = this.inputEl.value.trim();
    if (!connectorId || !content) return;

    this.inputEl.value = '';
    this.addMessage({ role: 'user', content });
    this.isSending = true;
    this.renderMessages('<div class="agent-chat-tool-log">Agent is working…</div>');

    try {
      const response = await sendAgentChat(connectorId, this.messages);
      if (response.alertDrafts?.length) {
        saveAgentAlertDrafts(response.alertDrafts);
      }
      // Apply client-executed map tools (set_map_view, zoom_to_region,
      // toggle_map_layers) to the live map before rendering the reply.
      const mapSummary = applyAgentMapToolEvents(response.toolEvents, this.mapAccessors ?? {
        getMap: () => null, getCurrentLayers: () => ({}), commitLayers: () => {},
      });
      const toolHtml = (response.toolEvents || []).map(event => `
        <div class="agent-chat-tool-event ${event.error ? 'error' : ''}">
          ${escapeHtml(event.name)}${event.error ? ` · ${escapeHtml(event.error)}` : ''}
        </div>
      `).join('');
      if (response.error) {
        this.addMessage({ role: 'assistant', content: response.error });
      } else {
        this.addMessage({
          role: 'assistant',
          content: response.content || 'No response.',
          meta: { model: this.selectedModelLabel(), sourceCount: response.toolEvents?.length ?? 0 },
        });
      }
      const mapActionCount = mapSummary.movedCamera + mapSummary.toggledKeys.length;
      if (toolHtml || response.alertDrafts?.length || mapActionCount) {
        this.renderMessages(`
          <div class="agent-chat-tool-log">
            ${toolHtml}
            ${mapActionCount ? `<div class="agent-chat-tool-event">Updated map: ${[
              mapSummary.movedCamera ? `${mapSummary.movedCamera} camera move${mapSummary.movedCamera === 1 ? '' : 's'}` : '',
              mapSummary.toggledKeys.length ? `${mapSummary.toggledKeys.join(', ')} switched` : '',
            ].filter(Boolean).join(' · ')}</div>` : ''}
            ${response.alertDrafts?.length ? `<div class="agent-chat-tool-event">Created ${response.alertDrafts.length} alert draft${response.alertDrafts.length === 1 ? '' : 's'} pending approval</div>` : ''}
          </div>
        `);
      }
    } catch (error) {
      this.addMessage({ role: 'assistant', content: error instanceof Error ? error.message : 'Agent chat failed.' });
    } finally {
      this.isSending = false;
    }
  }
}
