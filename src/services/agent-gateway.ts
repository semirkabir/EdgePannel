import { getApiBaseUrl, isDesktopRuntime } from '@/services/runtime';
import { tryInvokeTauri } from '@/services/tauri-bridge';

export type AgentConnectorType = 'openai-compatible' | 'mcp-server' | 'openclaw-mcp';

export interface AgentConnector {
  id: string;
  name: string;
  type: AgentConnectorType;
  endpoint: string;
  model?: string;
  apiKey?: string;
  scopes: string[];
  enabled: boolean;
}

export interface AgentGatewayStatus {
  ok: boolean;
  transport: string;
  mcpPath: string;
  defaultScopes: string[];
  optionalScopes: string[];
  connectors: Array<Omit<AgentConnector, 'apiKey'> & { hasApiKey: boolean }>;
  tools: Array<{ name: string; description: string; scopes: string[]; risk: string }>;
}

export interface AgentChatResponse {
  content: string;
  toolEvents?: Array<{ name: string; args?: Record<string, unknown>; result?: unknown; error?: string }>;
  alertDrafts?: AgentAlertDraft[];
  error?: string;
}

export interface AgentAlertDraft {
  id: string;
  name: string;
  keywords: string[];
  severity: 'all' | 'high' | 'critical';
  region: 'global' | 'mena' | 'europe' | 'asia' | 'americas' | 'africa';
  notifications: boolean;
  entities?: string[];
  signalTypes?: Array<'news' | 'market' | 'military' | 'cyber' | 'infrastructure' | 'supply_chain' | 'weather'>;
  threshold?: number;
  cooldownMinutes?: number;
  channels?: Array<'banner' | 'desktop' | 'email' | 'webhook' | 'telegram'>;
  evidenceRequirement?: 'any' | 'corroborated' | 'official' | 'analyst-reviewed';
  active: false;
  pending: true;
  source: string;
  createdAt: number;
}

export const AGENT_CONNECTORS_SECRET_KEY = 'WM_AGENT_CONNECTORS';
export const AGENT_DRAFTS_STORAGE_KEY = 'wm-agent-alert-drafts-v1';

const DEFAULT_SCOPES = ['news', 'markets', 'intelligence', 'security', 'tracking', 'infrastructure', 'supply_chain'];

let localApiTokenPromise: Promise<string | null> | null = null;

async function getLocalApiToken(): Promise<string | null> {
  if (!isDesktopRuntime()) return null;
  if (!localApiTokenPromise) {
    localApiTokenPromise = tryInvokeTauri<string>('get_local_api_token')
      .then(token => token?.trim() || null)
      .catch(() => {
        localApiTokenPromise = null;
        return null;
      });
  }
  return localApiTokenPromise;
}

async function gatewayFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = await getLocalApiToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${getApiBaseUrl()}${path}`, { ...init, headers });
}

export function makeDefaultConnector(type: AgentConnectorType): AgentConnector {
  const id = `agent-${Date.now().toString(36)}`;
  return {
    id,
    name: type === 'openclaw-mcp' ? 'OpenClaw MCP' : type === 'mcp-server' ? 'MCP Server' : 'Agent API',
    type,
    endpoint: type === 'openai-compatible' ? 'http://127.0.0.1:1234/v1' : 'http://127.0.0.1:8765/mcp',
    model: type === 'openai-compatible' ? 'local-model' : '',
    apiKey: '',
    scopes: [...DEFAULT_SCOPES],
    enabled: true,
  };
}

export function loadAgentConnectors(raw?: string): AgentConnector[] {
  try {
    const parsed = JSON.parse(raw || localStorage.getItem('wm-agent-connectors-preview') || '[]') as Partial<AgentConnector>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(item => item && typeof item === 'object')
      .map((item) => ({
        id: String(item.id || `agent-${Date.now().toString(36)}`),
        name: String(item.name || 'Agent'),
        type: (item.type === 'mcp-server' || item.type === 'openclaw-mcp' || item.type === 'openai-compatible') ? item.type : 'openai-compatible',
        endpoint: String(item.endpoint || ''),
        model: String(item.model || ''),
        apiKey: String(item.apiKey || ''),
        scopes: Array.isArray(item.scopes) ? item.scopes.map(String) : [...DEFAULT_SCOPES],
        enabled: item.enabled !== false,
      }))
      .filter(item => item.endpoint);
  } catch {
    return [];
  }
}

export function serializeAgentConnectors(connectors: AgentConnector[]): string {
  return JSON.stringify(connectors, null, 2);
}

export async function getAgentGatewayStatus(): Promise<AgentGatewayStatus> {
  const response = await gatewayFetch('/api/agent-gateway/status');
  if (!response.ok) throw new Error(`Agent gateway status failed (${response.status})`);
  return response.json() as Promise<AgentGatewayStatus>;
}

export async function testAgentConnector(connector: AgentConnector): Promise<{ ok: boolean; message?: string; error?: string }> {
  const response = await gatewayFetch('/api/agent-gateway/test-connector', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connector }),
  });
  const payload = await response.json() as { ok: boolean; message?: string; error?: string };
  if (!response.ok && !payload.error) payload.error = `Connector test failed (${response.status})`;
  return payload;
}

export async function sendAgentChat(connectorId: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>): Promise<AgentChatResponse> {
  const response = await gatewayFetch('/api/agent-gateway/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectorId, messages }),
  });
  const payload = await response.json() as AgentChatResponse;
  if (!response.ok && !payload.error) payload.error = `Agent chat failed (${response.status})`;
  return payload;
}

export function saveAgentAlertDrafts(drafts: AgentAlertDraft[]): void {
  if (drafts.length === 0) return;
  const existing = getAgentAlertDrafts();
  const byId = new Map(existing.map(draft => [draft.id, draft]));
  for (const draft of drafts) byId.set(draft.id, draft);
  localStorage.setItem(AGENT_DRAFTS_STORAGE_KEY, JSON.stringify([...byId.values()]));
  window.dispatchEvent(new CustomEvent('wm-agent-alert-drafts-changed'));
}

export function getAgentAlertDrafts(): AgentAlertDraft[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(AGENT_DRAFTS_STORAGE_KEY) || '[]') as AgentAlertDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setAgentAlertDrafts(drafts: AgentAlertDraft[]): void {
  localStorage.setItem(AGENT_DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  window.dispatchEvent(new CustomEvent('wm-agent-alert-drafts-changed'));
}

export function buildOpenClawSnippet(baseUrl: string, token: string | null, connectorId?: string): string {
  const url = `${baseUrl}/api/agent-gateway/mcp${connectorId ? `?connectorId=${encodeURIComponent(connectorId)}` : ''}`;
  return `openclaw mcp set worldmonitor '{"url":"${url}","headers":{"Authorization":"Bearer ${token || '<LOCAL_API_TOKEN>'}"}}'`;
}
