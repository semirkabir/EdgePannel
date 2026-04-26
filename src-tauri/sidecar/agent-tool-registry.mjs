export const AGENT_CONNECTORS_ENV_KEY = 'WM_AGENT_CONNECTORS';
export const AGENT_ALERT_DRAFTS_KEY = 'wm-agent-alert-drafts-v1';

export const DEFAULT_AGENT_SCOPES = [
  'news',
  'markets',
  'intelligence',
  'security',
  'tracking',
  'infrastructure',
  'supply_chain',
];

export const OPTIONAL_AGENT_SCOPES = [
  'alerts',
  'external_mcp',
];

const stringParam = (description, required = false) => ({ type: 'string', description, required });
const numberParam = (description, required = false) => ({ type: 'number', description, required });
const booleanParam = (description, required = false) => ({ type: 'boolean', description, required });

export const WORLD_MONITOR_TOOLS = [
  {
    name: 'list_feed_digest',
    description: 'Get curated live news digest across World Monitor categories.',
    scopes: ['news'],
    risk: 'read',
    endpoint: '/api/news/v1/list-feed-digest',
    inputSchema: {
      type: 'object',
      properties: {
        variant: stringParam('Site variant: full, tech, finance, happy, commodity.'),
      },
      required: [],
    },
  },
  {
    name: 'get_country_intel_brief',
    description: 'Get an AI-generated country intelligence brief.',
    scopes: ['intelligence'],
    risk: 'read',
    endpoint: '/api/intelligence/v1/get-country-intel-brief',
    inputSchema: {
      type: 'object',
      properties: {
        country_code: stringParam('ISO 3166-1 alpha-2 country code, for example US, CN, RU.', true),
      },
      required: ['country_code'],
    },
  },
  {
    name: 'get_risk_scores',
    description: 'Get current risk scores for countries and entities.',
    scopes: ['intelligence'],
    risk: 'read',
    endpoint: '/api/intelligence/v1/get-risk-scores',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_market_quotes',
    description: 'Get real-time stock and index quotes.',
    scopes: ['markets'],
    risk: 'read',
    endpoint: '/api/market/v1/list-market-quotes',
    inputSchema: {
      type: 'object',
      properties: {
        symbols: stringParam('Comma-separated symbols, for example SPY,QQQ,AAPL.'),
      },
      required: [],
    },
  },
  {
    name: 'list_crypto_quotes',
    description: 'Get real-time cryptocurrency quotes.',
    scopes: ['markets'],
    risk: 'read',
    endpoint: '/api/market/v1/list-crypto-quotes',
    inputSchema: {
      type: 'object',
      properties: {
        symbols: stringParam('Comma-separated crypto symbols, for example BTC,ETH,SOL.'),
      },
      required: [],
    },
  },
  {
    name: 'list_cyber_threats',
    description: 'List recent cyber security threats and incidents.',
    scopes: ['security'],
    risk: 'read',
    endpoint: '/api/cyber/v1/list-cyber-threats',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_internet_outages',
    description: 'List current global internet outages.',
    scopes: ['infrastructure'],
    risk: 'read',
    endpoint: '/api/infrastructure/v1/list-internet-outages',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_theater_posture',
    description: 'Get current military theater posture summary.',
    scopes: ['tracking', 'security'],
    risk: 'read',
    endpoint: '/api/military/v1/get-theater-posture',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_airport_delays',
    description: 'List current airport delays from aviation data sources.',
    scopes: ['tracking'],
    risk: 'read',
    endpoint: '/api/aviation/v1/list-airport-delays',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_vessel_snapshot',
    description: 'Get vessel tracking snapshot data.',
    scopes: ['tracking'],
    risk: 'read',
    endpoint: '/api/maritime/v1/get-vessel-snapshot',
    inputSchema: {
      type: 'object',
      properties: {
        mmsi: stringParam('Optional Maritime Mobile Service Identity number.'),
      },
      required: [],
    },
  },
  {
    name: 'get_chokepoint_status',
    description: 'Get global supply-chain chokepoint status.',
    scopes: ['supply_chain'],
    risk: 'read',
    endpoint: '/api/supply-chain/v1/get-chokepoint-status',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_critical_minerals',
    description: 'Get critical mineral supply and pricing data.',
    scopes: ['supply_chain'],
    risk: 'read',
    endpoint: '/api/supply-chain/v1/get-critical-minerals',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'create_alert_draft',
    description: 'Create a pending alert-rule draft. Drafts require user approval before becoming active.',
    scopes: ['alerts'],
    risk: 'write-draft',
    inputSchema: {
      type: 'object',
      properties: {
        name: stringParam('Short alert rule name.', true),
        keywords: stringParam('Comma-separated keywords or phrases.', true),
        severity: stringParam('all, high, or critical. Defaults to high.'),
        region: stringParam('global, mena, europe, asia, americas, or africa. Defaults to global.'),
        notifications: booleanParam('Whether notifications should be enabled after approval. Defaults to true.'),
      },
      required: ['name', 'keywords'],
    },
  },
];

export function normalizeScopes(scopes) {
  if (!Array.isArray(scopes) || scopes.length === 0) return [...DEFAULT_AGENT_SCOPES];
  const valid = new Set([...DEFAULT_AGENT_SCOPES, ...OPTIONAL_AGENT_SCOPES]);
  return [...new Set(scopes.map(String).filter(scope => valid.has(scope)))];
}

export function toolAllowedByScopes(tool, scopes) {
  const scopeSet = new Set(normalizeScopes(scopes));
  return tool.scopes.some(scope => scopeSet.has(scope));
}

export function getScopedWorldMonitorTools(scopes) {
  return WORLD_MONITOR_TOOLS.filter(tool => toolAllowedByScopes(tool, scopes));
}

export function toMcpTool(tool) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: stripRequiredFlags(tool.inputSchema),
  };
}

export function toOpenAiTool(tool) {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: stripRequiredFlags(tool.inputSchema),
    },
  };
}

function stripRequiredFlags(schema) {
  const properties = {};
  for (const [key, value] of Object.entries(schema.properties ?? {})) {
    const { required: _required, ...rest } = value;
    properties[key] = rest;
  }
  return {
    type: 'object',
    properties,
    required: Array.isArray(schema.required) ? schema.required : [],
    additionalProperties: false,
  };
}

export function validateToolArguments(tool, args) {
  if (!tool) return { ok: false, error: 'Unknown tool' };
  const input = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
  for (const key of tool.inputSchema.required ?? []) {
    if (input[key] === undefined || input[key] === null || input[key] === '') {
      return { ok: false, error: `Missing required argument: ${key}` };
    }
  }
  for (const [key, value] of Object.entries(input)) {
    const def = tool.inputSchema.properties?.[key];
    if (!def) return { ok: false, error: `Unexpected argument: ${key}` };
    if (value == null) continue;
    if (def.type === 'number' && typeof value !== 'number') return { ok: false, error: `${key} must be a number` };
    if (def.type === 'boolean' && typeof value !== 'boolean') return { ok: false, error: `${key} must be a boolean` };
    if (def.type === 'string' && typeof value !== 'string') return { ok: false, error: `${key} must be a string` };
  }
  return { ok: true, args: input };
}

export function buildAlertDraft(args, source = 'agent') {
  const keywords = String(args.keywords || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean)
    .slice(0, 20);
  const severity = ['all', 'high', 'critical'].includes(args.severity) ? args.severity : 'high';
  const region = ['global', 'mena', 'europe', 'asia', 'americas', 'africa'].includes(args.region) ? args.region : 'global';
  return {
    id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(args.name || 'Agent alert').trim().slice(0, 80),
    keywords,
    severity,
    region,
    notifications: args.notifications !== false,
    active: false,
    pending: true,
    source,
    createdAt: Date.now(),
  };
}

export async function executeWorldMonitorTool(toolName, args, context) {
  const tool = WORLD_MONITOR_TOOLS.find(entry => entry.name === toolName);
  const validation = validateToolArguments(tool, args);
  if (!validation.ok) throw new Error(validation.error);

  if (tool.name === 'create_alert_draft') {
    return { alertDraft: buildAlertDraft(validation.args, context?.source || 'agent') };
  }

  const baseUrl = context?.baseUrl || 'http://127.0.0.1:46123';
  const url = new URL(tool.endpoint, baseUrl);
  for (const [key, value] of Object.entries(validation.args)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  const headers = {};
  if (context?.token) headers.Authorization = `Bearer ${context.token}`;
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(context?.timeoutMs ?? 30_000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`World Monitor API error ${response.status}${text ? `: ${text.slice(0, 180)}` : ''}`);
  }
  return response.json();
}
