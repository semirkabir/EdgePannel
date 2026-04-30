import { DetailPanelBase } from '../detail-panel/DetailPanelBase';
import { nodeRegistry } from '@/services/node-registry';
import { workflowService } from '@/services/workflow-service';
import type { WorkflowDef, WorkflowNode } from '@/services/workflow-types';
import { escapeHtml } from '@/utils/sanitize';

function downloadJson(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export class NodeEditorDetailPanel extends DetailPanelBase {
  private workflows: WorkflowDef[] = [];
  private workflow: WorkflowDef | null = null;
  private selectedNodeId: string | null = null;
  private autosaveTimer: ReturnType<typeof setInterval> | null = null;

  public constructor() {
    super({
      id: 'node-editor-detail-panel',
      ariaLabel: 'Node Editor',
      contentId: 'node-editor-detail-content',
      closeId: 'node-editor-detail-close',
      rootClassName: 'node-editor-detail-panel detail-panel',
      shellClassName: 'nd-shell dp-shell',
      closeClassName: 'nd-close dp-close',
      contentClassName: 'nd-panel-content dp-panel-content',
      closeText: '\u00d7',
    });
  }

  public async show(workflowId?: string, maximize = true): Promise<void> {
    this.workflows = await workflowService.list_workflows();
    this.workflow = workflowId
      ? await workflowService.get_workflow(workflowId)
      : this.workflows[0] ?? null;
    this.openPanel();
    if (maximize) this.maximize();
    this.startAutosave();
    this.render();
  }

  public hide(): void {
    this.stopAutosave();
    if (this.isMaximizedState) this.minimize();
    this.closePanel();
    this.onCloseCallback?.();
  }

  private startAutosave(): void {
    this.stopAutosave();
    this.autosaveTimer = setInterval(() => {
      if (this.workflow && this.isVisible()) void workflowService.save_workflow(this.workflow);
    }, 30_000);
  }

  private stopAutosave(): void {
    if (this.autosaveTimer) clearInterval(this.autosaveTimer);
    this.autosaveTimer = null;
  }

  private render(): void {
    if (!this.workflow) {
      this.content.innerHTML = '<div class="nd-empty">No workflow loaded.</div>';
      return;
    }

    const selected = this.workflow.nodes.find((node) => node.id === this.selectedNodeId) ?? null;
    this.content.innerHTML = `
      <header class="nd-titlebar">
        <input id="nd-name" value="${escapeHtml(this.workflow.name)}">
        <span class="nd-status">${escapeHtml(this.workflow.status)}</span>
        <div class="nd-toolbar">
          <button data-nd-action="save">SAVE</button>
          <button data-nd-action="load">LOAD</button>
          <button data-nd-action="clear">CLEAR</button>
          <button data-nd-action="import">IMPORT</button>
          <button data-nd-action="export">EXPORT</button>
          <button data-nd-action="templates">TEMPLATES</button>
          <button disabled title="Connect deployment backend">DEPLOY</button>
          <button data-nd-action="execute">EXECUTE</button>
          <button data-nd-max>${this.isMaximizedState ? '&minus;' : '&#9633;'}</button>
        </div>
      </header>
      <div class="nd-editor">
        <aside class="nd-palette">
          <input id="nd-search" placeholder="Search nodes">
          ${this.paletteHtml()}
        </aside>
        <main class="nd-canvas-wrap">
          ${this.canvasHtml()}
          <div class="nd-minimap">${this.workflow.nodes.length} nodes / ${this.workflow.edges.length} edges</div>
        </main>
        <aside class="nd-props">
          ${selected ? this.propertiesHtml(selected) : '<div class="nd-empty">Select a node.</div>'}
        </aside>
      </div>
      <footer class="nd-footer">READY</footer>
      <input id="nd-import-file" type="file" accept="application/json" hidden>
    `;
    this.bind();
  }

  private paletteHtml(): string {
    const grouped = nodeRegistry.byCategory();
    return Object.entries(grouped).map(([category, defs]) => `
      <details open>
        <summary>${escapeHtml(category)}</summary>
        ${defs.map((def) => `<button class="${def.implemented ? '' : 'nd-stub'}" data-node-type="${escapeHtml(def.type)}">${escapeHtml(def.label)}</button>`).join('')}
      </details>
    `).join('');
  }

  private canvasHtml(): string {
    const workflow = this.workflow!;
    const edgeLines = workflow.edges.map((edge) => {
      const from = workflow.nodes.find((node) => node.id === edge.from_node);
      const to = workflow.nodes.find((node) => node.id === edge.to_node);
      if (!from || !to) return '';
      const x1 = from.x + 180;
      const y1 = from.y + 34;
      const x2 = to.x;
      const y2 = to.y + 34;
      return `<path d="M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}" class="nd-edge"/>`;
    }).join('');
    const nodes = workflow.nodes.map((node) => {
      const def = nodeRegistry.get(node.type);
      return `
        <button class="nd-node${node.id === this.selectedNodeId ? ' nd-node-selected' : ''}" data-node-id="${escapeHtml(node.id)}" style="left:${node.x}px;top:${node.y}px">
          <strong>${escapeHtml(node.label)}</strong>
          <span>${escapeHtml(def?.category ?? node.type)}</span>
          <i>${def?.implemented ? 'READY' : 'STUB'}</i>
        </button>
      `;
    }).join('');
    return `<div class="nd-canvas"><svg>${edgeLines}</svg>${nodes}</div>`;
  }

  private propertiesHtml(node: WorkflowNode): string {
    const def = nodeRegistry.get(node.type);
    if (!def) return '<div class="nd-empty">Unknown node.</div>';
    const params = def.params.map((param) => `
      <label>${escapeHtml(param.label)}
        <input data-param="${escapeHtml(param.key)}" value="${escapeHtml(String(node.params[param.key] ?? param.default ?? ''))}">
      </label>
    `).join('');
    return `
      <h3>${escapeHtml(node.label)}</h3>
      <div class="nd-muted">${escapeHtml(node.type)}</div>
      <label>Name<input id="nd-node-label" value="${escapeHtml(node.label)}"></label>
      ${params}
      <label class="nd-check"><input id="nd-disabled" type="checkbox"${node.disabled ? ' checked' : ''}> Disabled</label>
      <label class="nd-check"><input id="nd-continue" type="checkbox"${node.continue_on_fail ? ' checked' : ''}> Continue on fail</label>
      <label class="nd-check"><input id="nd-retry" type="checkbox"${node.retry_on_fail ? ' checked' : ''}> Retry on fail</label>
      <label>Max tries<input id="nd-tries" type="number" value="${node.max_tries ?? 2}"></label>
      <button data-nd-action="delete-node">DELETE</button>
    `;
  }

  private bind(): void {
    this.content.querySelector<HTMLElement>('[data-nd-max]')?.addEventListener('click', () => {
      if (this.isMaximizedState) this.minimize();
      else this.maximize();
      this.render();
    });
    this.content.querySelectorAll<HTMLElement>('[data-node-type]').forEach((button) => {
      button.addEventListener('click', () => this.addNode(button.dataset.nodeType ?? 'trigger.manual'));
    });
    this.content.querySelectorAll<HTMLElement>('[data-node-id]').forEach((button) => {
      button.addEventListener('click', () => {
        this.selectedNodeId = button.dataset.nodeId ?? null;
        this.render();
      });
    });
    this.content.querySelectorAll<HTMLElement>('[data-nd-action]').forEach((button) => {
      button.addEventListener('click', () => void this.handleAction(button.dataset.ndAction ?? ''));
    });
    this.content.querySelector<HTMLInputElement>('#nd-name')?.addEventListener('change', (event) => {
      if (this.workflow) this.workflow.name = (event.currentTarget as HTMLInputElement).value;
    });
    this.content.querySelector<HTMLInputElement>('#nd-import-file')?.addEventListener('change', (event) => {
      void this.importWorkflowFile(event.currentTarget as HTMLInputElement);
    });
    this.bindPropertyInputs();
    this.content.addEventListener('keydown', (event) => {
      if (event.key === 'Delete') void this.handleAction('delete-node');
      if (event.ctrlKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void this.handleAction('save');
      }
    });
  }

  private bindPropertyInputs(): void {
    const node = this.workflow?.nodes.find((item) => item.id === this.selectedNodeId);
    if (!node) return;
    this.content.querySelector<HTMLInputElement>('#nd-node-label')?.addEventListener('change', (event) => {
      node.label = (event.currentTarget as HTMLInputElement).value;
      this.render();
    });
    this.content.querySelectorAll<HTMLInputElement>('[data-param]').forEach((input) => {
      input.addEventListener('change', () => {
        node.params[input.dataset.param ?? ''] = input.value;
      });
    });
    this.content.querySelector<HTMLInputElement>('#nd-disabled')?.addEventListener('change', (event) => { node.disabled = (event.currentTarget as HTMLInputElement).checked; });
    this.content.querySelector<HTMLInputElement>('#nd-continue')?.addEventListener('change', (event) => { node.continue_on_fail = (event.currentTarget as HTMLInputElement).checked; });
    this.content.querySelector<HTMLInputElement>('#nd-retry')?.addEventListener('change', (event) => { node.retry_on_fail = (event.currentTarget as HTMLInputElement).checked; });
    this.content.querySelector<HTMLInputElement>('#nd-tries')?.addEventListener('change', (event) => { node.max_tries = Number((event.currentTarget as HTMLInputElement).value); });
  }

  private addNode(type: string): void {
    if (!this.workflow) return;
    const def = nodeRegistry.get(type);
    const node: WorkflowNode = {
      id: `n_${Date.now().toString(36)}`,
      type,
      label: def?.label ?? type,
      x: 80 + ((this.workflow.nodes.length % 4) * 220),
      y: 90 + (Math.floor(this.workflow.nodes.length / 4) * 120),
      params: Object.fromEntries((def?.params ?? []).map((param) => [param.key, param.default ?? ''])),
    };
    const previous = this.workflow.nodes[this.workflow.nodes.length - 1];
    this.workflow.nodes.push(node);
    if (previous) {
      this.workflow.edges.push({ id: `e_${Date.now().toString(36)}`, from_node: previous.id, from_port: 'out', to_node: node.id, to_port: 'in', type: 'Main' });
    }
    this.selectedNodeId = node.id;
    this.render();
  }

  private async handleAction(action: string): Promise<void> {
    const workflow = this.workflow;
    if (!workflow) return;
    if (action === 'save') this.workflow = await workflowService.save_workflow(workflow);
    if (action === 'clear') {
      workflow.nodes = [];
      workflow.edges = [];
      this.selectedNodeId = null;
    }
    if (action === 'export') downloadJson(`${workflow.name.replace(/\s+/g, '_').toLowerCase()}.json`, workflowService.export_json(workflow));
    if (action === 'execute') {
      await workflowService.execute(workflow);
      this.workflows = await workflowService.list_workflows();
      this.workflow = await workflowService.get_workflow(workflow.id);
    }
    if (action === 'delete-node' && this.selectedNodeId) {
      workflow.nodes = workflow.nodes.filter((node) => node.id !== this.selectedNodeId);
      workflow.edges = workflow.edges.filter((edge) => edge.from_node !== this.selectedNodeId && edge.to_node !== this.selectedNodeId);
      this.selectedNodeId = null;
    }
    if (action === 'templates') window.open('/workflow-templates/rsi-alert.json', '_blank', 'noopener,noreferrer');
    if (action === 'load') {
      this.workflows = await workflowService.list_workflows();
      this.workflow = this.workflows[0] ?? this.workflow;
    }
    if (action === 'import') this.content.querySelector<HTMLInputElement>('#nd-import-file')?.click();
    this.render();
  }

  private async importWorkflowFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;
    const payload = JSON.parse(await file.text()) as unknown;
    this.workflow = await workflowService.import_json(payload);
    this.workflows = await workflowService.list_workflows();
    this.selectedNodeId = null;
    input.value = '';
    this.render();
  }
}

let singleton: NodeEditorDetailPanel | null = null;

export function getNodeEditorDetailPanel(): NodeEditorDetailPanel {
  singleton ??= new NodeEditorDetailPanel();
  return singleton;
}
