import { createLocalDocumentStore, LOCAL_DB_STORES } from './local-db';
import type { WorkflowDef } from './workflow-types';

function nowIso(): string {
  return new Date().toISOString();
}

function id(): string {
  return `wf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class WorkflowRepository {
  private readonly store = createLocalDocumentStore<WorkflowDef>(LOCAL_DB_STORES.workflows);

  public async list_workflows(): Promise<WorkflowDef[]> {
    return (await this.store.list()).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  public async get_workflow(workflowId: string): Promise<WorkflowDef | null> {
    return this.store.get(workflowId);
  }

  public async save_workflow(workflow: Omit<WorkflowDef, 'id' | 'created_at' | 'updated_at' | 'status' | 'run_history'> & Partial<WorkflowDef>): Promise<WorkflowDef> {
    const existing = workflow.id ? await this.store.get(workflow.id) : null;
    const saved: WorkflowDef = {
      id: workflow.id ?? id(),
      name: workflow.name,
      description: workflow.description ?? '',
      status: workflow.status ?? existing?.status ?? 'Draft',
      nodes: workflow.nodes ?? [],
      edges: workflow.edges ?? [],
      created_at: existing?.created_at ?? nowIso(),
      updated_at: nowIso(),
      last_run: workflow.last_run ?? existing?.last_run,
      run_history: workflow.run_history ?? existing?.run_history ?? [],
    };
    await this.store.put(saved);
    return saved;
  }

  public async delete_workflow(workflowId: string): Promise<void> {
    await this.store.delete(workflowId);
  }
}

export const workflowRepository = new WorkflowRepository();
