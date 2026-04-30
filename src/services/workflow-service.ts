import { createEventBus } from '@/app/event-bus';
import { auditWorkflow } from './audit-logger';
import { executeWorkflow } from './workflow-executor';
import { workflowRepository } from './workflow-repository';
import { executeWorkflowInWorker } from './workflow-worker';
import type { WorkflowDef, WorkflowRunLog } from './workflow-types';

export class WorkflowService {
  public readonly events = createEventBus();

  public async list_workflows(): Promise<WorkflowDef[]> {
    const workflows = await workflowRepository.list_workflows();
    if (workflows.length > 0) return workflows;
    return [await this.createStarterWorkflow()];
  }

  public async get_workflow(id: string): Promise<WorkflowDef | null> {
    return workflowRepository.get_workflow(id);
  }

  public async save_workflow(workflow: Parameters<typeof workflowRepository.save_workflow>[0]): Promise<WorkflowDef> {
    const saved = await workflowRepository.save_workflow(workflow);
    this.events.emit('workflow:saved', saved);
    await auditWorkflow(saved.id, 'workflow_saved');
    return saved;
  }

  public async delete_workflow(id: string): Promise<void> {
    await workflowRepository.delete_workflow(id);
    this.events.emit('workflow:deleted', id);
  }

  public export_json(workflow: WorkflowDef): string {
    return `${JSON.stringify(workflow, null, 2)}\n`;
  }

  public async import_json(payload: unknown): Promise<WorkflowDef> {
    if (typeof payload !== 'object' || payload === null) throw new Error('Invalid workflow JSON');
    const wf = payload as WorkflowDef;
    if (!Array.isArray(wf.nodes) || !Array.isArray(wf.edges)) throw new Error('Workflow JSON must include nodes and edges');
    const saved = await this.save_workflow(wf);
    this.events.emit('workflow:imported', saved);
    return saved;
  }

  public async execute(workflow: WorkflowDef): Promise<WorkflowRunLog> {
    const running = await this.save_workflow({ ...workflow, status: 'Running' });
    this.events.emit('workflow:execution_started', running);
    const run = running.nodes.length > 20
      ? await executeWorkflowInWorker(running)
      : await executeWorkflow(running);
    const saved = await this.save_workflow({
      ...running,
      status: run.status,
      last_run: run,
      run_history: [run, ...running.run_history].slice(0, 20),
    });
    this.events.emit('workflow:node_execution_completed', run);
    this.events.emit('workflow:execution_completed', saved);
    await auditWorkflow(saved.id, 'workflow_executed', run.status);
    return run;
  }

  private async createStarterWorkflow(): Promise<WorkflowDef> {
    return this.save_workflow({
      name: 'RSI alert to webhook',
      description: 'Starter workflow using manual trigger, quote lookup, and results display.',
      status: 'Draft',
      nodes: [
        { id: 'n_manual', type: 'trigger.manual', label: 'Manual Trigger', x: 80, y: 110, params: {} },
        { id: 'n_quote', type: 'market.get_quote', label: 'Get Quote', x: 320, y: 110, params: { symbol: 'SPY' } },
        { id: 'n_output', type: 'output.results_display', label: 'Results Display', x: 560, y: 110, params: {} },
      ],
      edges: [
        { id: 'e1', from_node: 'n_manual', from_port: 'out', to_node: 'n_quote', to_port: 'in', type: 'Main' },
        { id: 'e2', from_node: 'n_quote', from_port: 'out', to_node: 'n_output', to_port: 'in', type: 'Main' },
      ],
      run_history: [],
    });
  }
}

export const workflowService = new WorkflowService();
