import { createLocalDocumentStore, LOCAL_DB_STORES } from './local-db';
import type { LocalDbDocument } from './local-db';

interface AuditEntry extends LocalDbDocument {
  workflow_id: string;
  event: string;
  detail: string;
  created_at: string;
}

const store = createLocalDocumentStore<AuditEntry>(LOCAL_DB_STORES.workflowAudit);

export async function auditWorkflow(workflowId: string, event: string, detail = ''): Promise<void> {
  await store.put({
    id: `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    workflow_id: workflowId,
    event,
    detail,
    created_at: new Date().toISOString(),
  });
}
