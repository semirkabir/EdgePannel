// --- Client-executed map-control tools ------------------------------------
//
// These tools are offered to the LLM during agent chat, but unlike
// WORLD_MONITOR_TOOLS they are NOT executed in the sidecar: the gateway
// intercepts them, returns an acknowledgement, and reports them back to the
// frontend via `toolEvents`. The browser applies them against the live map
// (see src/services/map-agent-bridge.ts). They never appear on the MCP
// surface because a remote agent has no map to control.

/** Region anchor points for zoom_to_region: [lat, lon, defaultZoom]. */
export const MAP_REGION_ANCHORS = {
  global:      { lat: 25,   lon: 10,  zoom: 2 },
  mena:        { lat: 27,   lon: 40,  zoom: 4 },
  europe:      { lat: 52,   lon: 14,  zoom: 4 },
  asia:        { lat: 30,   lon: 105, zoom: 3 },
  americas:    { lat: 15,   lon: -90, zoom: 3 },
  africa:      { lat: 2,    lon: 20,  zoom: 3 },
  middle_east: { lat: 27,   lon: 45,  zoom: 5 },
  ukraine:     { lat: 49,   lon: 32,  zoom: 5.5 },
  taiwan_strait: { lat: 24, lon: 119.5, zoom: 7 },
  red_sea:     { lat: 19,   lon: 38.5, zoom: 6 },
  south_china_sea: { lat: 13, lon: 114, zoom: 5.5 },
  korea_peninsula: { lat: 38, lon: 127, zoom: 6.5 },
};

/** Plain-schema helpers kept local so this block has no load-order deps. */
const clientStringParam = (description, required = false) => ({ type: 'string', description, required });
const clientNumberParam = (description, required = false) => ({ type: 'number', description, required });

export const CLIENT_EXECUTED_TOOLS = [
  {
    name: 'set_map_view',
    description: 'Move the user\'s map/globe camera to a location. Use after discussing a place so the analyst sees it. Coordinates are WGS84 decimal degrees; latitude −90..90, longitude −180..180.',
    scopes: ['intelligence'],
    risk: 'client-map',
    inputSchema: {
      type: 'object',
      properties: {
        lat: clientNumberParam('Center latitude, WGS84 decimal degrees.', true),
        lon: clientNumberParam('Center longitude, WGS84 decimal degrees.', true),
        zoom: clientNumberParam('Map zoom 1-16. Roughly: 2 world, 4 region, 6 country, 9 metro, 12 city districts.'),
      },
      required: ['lat', 'lon'],
    },
  },
  {
    name: 'zoom_to_region',
    description: 'Move the user\'s map/globe camera to a named strategic region or theater. Prefer this over raw coordinates when the user names one of the supported regions.',
    scopes: ['intelligence'],
    risk: 'client-map',
    inputSchema: {
      type: 'object',
      properties: {
        region: clientStringParam(`One of: ${Object.keys(MAP_REGION_ANCHORS).join(', ')}.`, true),
      },
      required: ['region'],
    },
  },
  {
    name: 'toggle_map_layers',
    description: 'Switch map layers on or off on the user\'s dashboard. Only layers from list_map_layers can be toggled. Use to compose a view, e.g. enable cables and chokepoints while discussing maritime chokepoints.',
    scopes: ['intelligence'],
    risk: 'client-map',
    inputSchema: {
      type: 'object',
      properties: {
        enable: clientStringParam('Comma-separated layer keys to turn ON.', false),
        disable: clientStringParam('Comma-separated layer keys to turn OFF.', false),
      },
      required: [],
    },
  },
];

export function isClientExecutedTool(toolName) {
  return CLIENT_EXECUTED_TOOLS.some(tool => tool.name === toolName);
}

/** Validate + normalize args for client-executed tools. Returns {ok,error} or {ok,args}. */
export function validateClientToolArguments(toolName, args) {
  const normalized = args && typeof args === 'object' ? args : {};
  if (toolName === 'set_map_view') {
    const lat = Number(normalized.lat);
    const lon = Number(normalized.lon);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { ok: false, error: 'lat must be a number between -90 and 90.' };
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) return { ok: false, error: 'lon must be a number between -180 and 180.' };
    let zoom = Number(normalized.zoom);
    if (!Number.isFinite(zoom)) zoom = 7;
    zoom = Math.max(1, Math.min(16, Math.round(zoom * 2) / 2));
    return { ok: true, args: { lat, lon, zoom } };
  }
  if (toolName === 'zoom_to_region') {
    const region = String(normalized.region || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    const anchor = MAP_REGION_ANCHORS[region];
    if (!anchor) {
      return { ok: false, error: `Unknown region '${normalized.region}'. Supported: ${Object.keys(MAP_REGION_ANCHORS).join(', ')}.` };
    }
    return { ok: true, args: { region, ...anchor } };
  }
  if (toolName === 'toggle_map_layers') {
    const parseList = raw => String(raw || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .filter(key => MAP_LAYER_CATALOG.includes(key));
    const rejected = String(`${normalized.enable || ''},${normalized.disable || ''}`)
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .filter(key => !MAP_LAYER_CATALOG.includes(key));
    const enable = parseList(normalized.enable);
    const disable = parseList(normalized.disable);
    if (enable.length === 0 && disable.length === 0) {
      return { ok: false, error: `No valid layer keys supplied. Valid keys: ${MAP_LAYER_CATALOG.join(', ')}.` };
    }
    return { ok: true, args: { enable, disable, ...(rejected.length ? { rejected } : {}) } };
  }
  return { ok: false, error: `Unknown client tool: ${toolName}` };
}

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

const MAP_LAYER_CATALOG = [
  'conflicts', 'bases', 'cables', 'pipelines', 'hotspots', 'ais', 'flights', 'military',
  'natural', 'weather', 'outages', 'cyberThreats', 'datacenters', 'protests', 'fires',
  'ciiChoropleth', 'sanctions', 'minerals', 'tradeRoutes', 'stockExchanges',
];

export const WORLD_MONITOR_TOOLS = [
  {
    name: 'search_news',
    description: 'Search the live World Monitor news digest for a topic or entity.',
    scopes: ['news'],
    risk: 'read',
    endpoint: '/api/news/v1/list-feed-digest',
    inputSchema: {
      type: 'object',
      properties: {
        query: stringParam('Topic, entity, or region to search for.'),
        variant: stringParam('Site variant: full, tech, finance, happy, commodity.'),
      },
      required: [],
    },
  },
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
    name: 'list_portfolios',
    description: 'List browser-local portfolio workbench records available to the Portfolio panel.',
    scopes: ['markets'],
    risk: 'read',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_portfolio_summary',
    description: 'Describe how to retrieve a portfolio summary from the browser-local Portfolio panel ledger.',
    scopes: ['markets'],
    risk: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        portfolio_id: stringParam('Optional browser-local portfolio id.'),
      },
      required: [],
    },
  },
  {
    name: 'list_portfolio_transactions',
    description: 'Describe how to retrieve recent browser-local portfolio transactions.',
    scopes: ['markets'],
    risk: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        portfolio_id: stringParam('Optional browser-local portfolio id.'),
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
    name: 'list_alerts',
    description: 'List alert workflow capabilities and sidecar-visible alert drafts.',
    scopes: ['alerts'],
    risk: 'read',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_map_layers',
    description: 'List key World Monitor map layers. These can be switched on/off on the analyst\'s dashboard via toggle_map_layers.',
    scopes: ['intelligence', 'tracking', 'infrastructure'],
    risk: 'read',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_market_risk_signals',
    description: 'Get market and risk signal summaries through the intelligence risk endpoint.',
    scopes: ['markets', 'intelligence'],
    risk: 'read',
    endpoint: '/api/intelligence/v1/get-risk-scores',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'export_brief',
    description: 'Create a portable Markdown investigation brief from supplied analyst context.',
    scopes: ['intelligence'],
    risk: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        title: stringParam('Brief title or investigation target.', true),
        summary: stringParam('Short analytic summary.'),
        evidence: stringParam('Newline-separated evidence or source URLs.'),
      },
      required: ['title'],
    },
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
        entities: stringParam('Comma-separated entities the rule should monitor.'),
        signalTypes: stringParam('Comma-separated signal types: news, market, military, cyber, infrastructure, supply_chain, weather.'),
        threshold: numberParam('Trigger threshold from 1 to 100. Defaults by severity.'),
        cooldownMinutes: numberParam('Cooldown between repeated alerts. Defaults to 30.'),
        channels: stringParam('Comma-separated channels: banner, desktop, email, webhook, telegram.'),
        evidenceRequirement: stringParam('any, corroborated, official, or analyst-reviewed. Defaults to any.'),
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
  const signalTypes = String(args.signalTypes || 'news')
    .split(',')
    .map(item => item.trim())
    .filter(item => ['news', 'market', 'military', 'cyber', 'infrastructure', 'supply_chain', 'weather'].includes(item));
  const channels = String(args.channels || (args.notifications === false ? 'banner' : 'banner,desktop'))
    .split(',')
    .map(item => item.trim())
    .filter(item => ['banner', 'desktop', 'email', 'webhook', 'telegram'].includes(item));
  const evidenceRequirement = ['any', 'corroborated', 'official', 'analyst-reviewed'].includes(args.evidenceRequirement)
    ? args.evidenceRequirement
    : 'any';
  const threshold = Number.isFinite(args.threshold) ? Math.max(1, Math.min(100, Math.round(args.threshold))) : (severity === 'critical' ? 80 : 60);
  const cooldownMinutes = Number.isFinite(args.cooldownMinutes) ? Math.max(1, Math.min(1440, Math.round(args.cooldownMinutes))) : 30;
  return {
    id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(args.name || 'Agent alert').trim().slice(0, 80),
    keywords,
    severity,
    region,
    notifications: args.notifications !== false,
    entities: String(args.entities || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 20),
    signalTypes: signalTypes.length > 0 ? signalTypes : ['news'],
    threshold,
    cooldownMinutes,
    channels: channels.length > 0 ? channels : ['banner'],
    evidenceRequirement,
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

  if (tool.name === 'list_alerts') {
    return {
      alerts: [],
      draftsVisibleToFrontend: true,
      workflow: 'Agents may create alert drafts only. Users approve drafts in the Alert Rules panel before activation.',
    };
  }

  if (tool.name === 'list_map_layers') {
    return {
      layers: MAP_LAYER_CATALOG.map(name => ({ name, status: 'available' })),
      note: 'Use toggle_map_layers to switch these on or off on the analyst\'s dashboard.',
    };
  }

  if (tool.name === 'list_portfolios' || tool.name === 'get_portfolio_summary' || tool.name === 'list_portfolio_transactions') {
    return {
      storage: 'browser-local',
      availableInFrontend: true,
      portfolioId: validation.args.portfolio_id || null,
      message: 'Portfolio records, transaction ledgers, and snapshots are stored in the browser/PWA profile. Open the Portfolio panel for live values until sidecar portfolio persistence is added.',
      suggestedFrontendApis: [
        'getPortfolios',
        'buildPortfolioSummary',
        'getPortfolioTransactions',
      ],
    };
  }

  if (tool.name === 'export_brief') {
    const evidence = String(validation.args.evidence || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, 30);
    return {
      format: 'markdown',
      markdown: [
        `# ${validation.args.title}`,
        '',
        `Generated: ${new Date().toISOString()}`,
        '',
        '## Summary',
        validation.args.summary || 'No summary supplied.',
        '',
        '## Evidence',
        evidence.length ? evidence.map(item => `- ${item}`).join('\n') : 'No evidence supplied.',
      ].join('\n'),
    };
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
