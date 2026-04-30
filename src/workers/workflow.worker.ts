import { executeWorkflow } from '@/services/workflow-executor';
import type { WorkflowDef } from '@/services/workflow-types';

type WorkerMessage = { type: 'execute'; id: string; workflow: WorkflowDef };

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  if (message.type !== 'execute') return;
  executeWorkflow(message.workflow)
    .then((run) => self.postMessage({ type: 'execute-result', id: message.id, run }))
    .catch((error) => self.postMessage({ type: 'error', id: message.id, error: String(error) }));
};

self.postMessage({ type: 'ready' });
