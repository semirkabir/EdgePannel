import type { WorkflowDef, WorkflowRunLog } from './workflow-types';

export async function executeWorkflowInWorker(workflow: WorkflowDef): Promise<WorkflowRunLog> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/workflow.worker.ts', import.meta.url), { type: 'module' });
    const id = `wf_${Date.now().toString(36)}`;
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('Workflow worker timed out'));
    }, 60_000);
    worker.onmessage = (event: MessageEvent<{ type: string; id?: string; run?: WorkflowRunLog; error?: string }>) => {
      if (event.data.type === 'ready') {
        worker.postMessage({ type: 'execute', id, workflow });
        return;
      }
      clearTimeout(timeout);
      worker.terminate();
      if (event.data.type === 'error') reject(new Error(event.data.error ?? 'Workflow worker failed'));
      else resolve(event.data.run!);
    };
    worker.onerror = (error) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error(error.message));
    };
  });
}
