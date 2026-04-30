import { Panel } from './Panel';
import { workflowService } from '@/services/workflow-service';
import type { WorkflowDef } from '@/services/workflow-types';
import { getNodeEditorDetailPanel } from './node-editor/NodeEditorDetailPanel';
import { escapeHtml } from '@/utils/sanitize';

export class NodeEditorPanel extends Panel {
  private workflows: WorkflowDef[] = [];

  public constructor() {
    super({ id: 'node-editor', title: 'Node Editor' });
    void this.render();
  }

  public async render(): Promise<void> {
    this.workflows = await workflowService.list_workflows();
    this.setContentNow(`
      <div class="ne-panel-shell">
        <div class="ne-actions">
          <button id="ne-new">New Workflow</button>
          <button id="ne-open">Open Editor</button>
        </div>
        <section class="ne-card">
          <div class="ne-section-title">Workflows</div>
          ${this.workflows.map((workflow) => `
            <button class="ne-workflow" data-workflow="${escapeHtml(workflow.id)}">
              <span>${escapeHtml(workflow.name)}</span>
              <em>${escapeHtml(workflow.status)} | ${workflow.nodes.length} nodes | ${workflow.edges.length} edges</em>
            </button>
          `).join('')}
        </section>
        <section class="ne-card">
          <div class="ne-section-title">Recent Execution Log</div>
          ${this.workflows.flatMap((workflow) => workflow.run_history.slice(0, 5)).slice(0, 5).map((run) => `
            <div class="ne-log"><span>${escapeHtml(run.status)}</span><em>${run.duration_ms ?? 0}ms</em></div>
          `).join('') || '<div class="ne-empty">No runs yet.</div>'}
        </section>
      </div>
    `);
    this.bind();
  }

  private bind(): void {
    this.content.querySelector('#ne-open')?.addEventListener('click', () => void getNodeEditorDetailPanel().show(this.workflows[0]?.id));
    this.content.querySelector('#ne-new')?.addEventListener('click', async () => {
      const workflow = await workflowService.save_workflow({ name: 'Untitled Workflow', description: '', nodes: [], edges: [], run_history: [] });
      await getNodeEditorDetailPanel().show(workflow.id);
      await this.render();
    });
    this.content.querySelectorAll<HTMLElement>('[data-workflow]').forEach((button) => {
      button.addEventListener('click', () => void getNodeEditorDetailPanel().show(button.dataset.workflow));
    });
  }
}
