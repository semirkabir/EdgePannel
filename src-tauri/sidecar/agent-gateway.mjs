import {
  AGENT_CONNECTORS_ENV_KEY,
  CLIENT_EXECUTED_TOOLS,
  DEFAULT_AGENT_SCOPES,
  OPTIONAL_AGENT_SCOPES,
  WORLD_MONITOR_TOOLS,
  executeWorldMonitorTool,
  getScopedWorldMonitorTools,
  isClientExecutedTool,
  normalizeScopes,
  toMcpTool,
  toOpenAiTool,
  validateClientToolArguments,
} from './agent-tool-registry.mjs';

const CHAT_TIMEOUT_MS = 120_000;
const CONNECTOR_TEST_TIMEOUT_MS = 8_000;
const MAX_TOOL_ITERATIONS = 4;
const MAX_EXTERNAL_MCP_TOOLS = 20;

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) return {};
  return JSON.parse(text);
}

export function readAgentConnectors() {
  const raw = process.env[AGENT_CONNECTORS_ENV_KEY] || '[]';
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(connector => connector && typeof connector === 'object')
      .map(normalizeConnector)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeConnector(connector) {
  const id = String(connector.id || '').trim();
  const name = String(connector.name || id || 'Agent').trim().slice(0, 80);
  const type = String(connector.type || '').trim();
  const endpoint = String(connector.endpoint || '').trim();
  if (!id || !endpoint) return null;
  if (!['openai-compatible', 'mcp-server', 'openclaw-mcp'].includes(type)) return null;
  return {
    id,
    name,
    type,
    endpoint,
    model: String(connector.model || '').trim(),
    apiKey: String(connector.apiKey || '').trim(),
    scopes: normalizeScopes(connector.scopes),
    enabled: connector.enabled !== false,
  };
}

function redactConnector(connector) {
  return {
    id: connector.id,
    name: connector.name,
    type: connector.type,
    endpoint: connector.endpoint,
    model: connector.model,
    scopes: connector.scopes,
    enabled: connector.enabled,
    hasApiKey: Boolean(connector.apiKey),
  };
}

function getConnector(id) {
  return readAgentConnectors().find(connector => connector.id === id && connector.enabled);
}

function isLoopbackHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function isPrivateHostname(hostname) {
  if (isLoopbackHostname(hostname)) return false;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  const match = hostname.match(/^172\.(\d+)\./);
  if (match) {
    const second = Number(match[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (/^169\.254\./.test(hostname)) return true;
  return false;
}

export function validateConnectorEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    if (!['http:', 'https:'].includes(url.protocol)) return { ok: false, error: 'Endpoint must be http(s).' };
    if (url.protocol === 'http:' && !isLoopbackHostname(url.hostname)) {
      return { ok: false, error: 'HTTP endpoints are only allowed for localhost.' };
    }
    if (isPrivateHostname(url.hostname)) {
      return { ok: false, error: 'Private LAN endpoints are blocked by default.' };
    }
    return { ok: true, url };
  } catch {
    return { ok: false, error: 'Invalid endpoint URL.' };
  }
}

function chatCompletionsUrl(endpoint) {
  const url = new URL(endpoint);
  if (url.pathname.endsWith('/chat/completions')) return url.toString();
  if (url.pathname.endsWith('/v1')) return new URL('chat/completions', `${url.toString().replace(/\/+$/, '')}/`).toString();
  return new URL('/v1/chat/completions', url.origin).toString();
}

function modelsUrl(endpoint) {
  const url = new URL(endpoint);
  if (url.pathname.endsWith('/models')) return url.toString();
  if (url.pathname.endsWith('/v1/chat/completions')) return new URL('../models', url.toString()).toString();
  if (url.pathname.endsWith('/v1')) return new URL('models', `${url.toString().replace(/\/+$/, '')}/`).toString();
  return new URL('/v1/models', url.origin).toString();
}

async function testOpenAiConnector(connector) {
  const endpointCheck = validateConnectorEndpoint(connector.endpoint);
  if (!endpointCheck.ok) return endpointCheck;
  const headers = { Accept: 'application/json' };
  if (connector.apiKey) headers.Authorization = `Bearer ${connector.apiKey}`;
  const response = await fetch(modelsUrl(connector.endpoint), {
    headers,
    signal: AbortSignal.timeout(CONNECTOR_TEST_TIMEOUT_MS),
  });
  if (response.status === 404 || response.status === 405) {
    return { ok: true, message: 'Endpoint accepted; model discovery is unavailable.' };
  }
  if (!response.ok) return { ok: false, error: `Model probe failed (${response.status}).` };
  return { ok: true, message: 'OpenAI-compatible endpoint verified.' };
}

async function mcpRpc(endpoint, method, params = {}, apiKey = '') {
  const endpointCheck = validateConnectorEndpoint(endpoint);
  if (!endpointCheck.ok) throw new Error(endpointCheck.error);
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: `wm-${Date.now()}`, method, params }),
    signal: AbortSignal.timeout(CONNECTOR_TEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`MCP request failed (${response.status}).`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message || 'MCP server returned an error.');
  return payload.result;
}

async function testMcpConnector(connector) {
  const endpointCheck = validateConnectorEndpoint(connector.endpoint);
  if (!endpointCheck.ok) return endpointCheck;
  try {
    await mcpRpc(connector.endpoint, 'tools/list', {}, connector.apiKey);
    return { ok: true, message: 'MCP endpoint verified.' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'MCP probe failed.' };
  }
}

async function listExternalMcpTools(connectors, chatConnector) {
  if (!chatConnector.scopes.includes('external_mcp')) return [];
  const mcpConnectors = connectors.filter(connector =>
    connector.enabled
    && ['mcp-server', 'openclaw-mcp'].includes(connector.type)
    && connector.scopes.includes('external_mcp')
  );
  const external = [];
  for (const connector of mcpConnectors) {
    try {
      const result = await mcpRpc(connector.endpoint, 'tools/list', {}, connector.apiKey);
      const tools = Array.isArray(result?.tools) ? result.tools.slice(0, MAX_EXTERNAL_MCP_TOOLS) : [];
      for (const tool of tools) {
        if (!tool?.name) continue;
        external.push({
          connectorId: connector.id,
          originalName: tool.name,
          name: `mcp__${connector.id.replace(/[^a-zA-Z0-9_-]/g, '_')}__${String(tool.name).replace(/[^a-zA-Z0-9_-]/g, '_')}`,
          description: `[${connector.name}] ${tool.description || tool.name}`,
          parameters: tool.inputSchema || { type: 'object', properties: {}, required: [] },
        });
      }
    } catch {
      // External MCP discovery should not break local World Monitor tools.
    }
  }
  return external;
}

function parseToolArguments(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

async function executeOpenAiToolCall(toolCall, options) {
  const functionName = toolCall.function?.name || toolCall.name;
  const args = parseToolArguments(toolCall.function?.arguments);

  // Client-executed map tools: validate here, but do NOT execute. The result
  // tells the LLM the command was accepted; the actual camera/layer change
  // happens in the browser when AgentChatPanel forwards this toolEvent to
  // applyAgentMapActions() (src/services/map-agent-bridge.ts).
  if (isClientExecutedTool(functionName)) {
    const validation = validateClientToolArguments(functionName, args);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const result = { accepted: true, appliedByFrontend: true, action: validation.args };
    return { name: functionName, args: validation.args, result, clientAction: validation.args };
  }

  const worldTool = WORLD_MONITOR_TOOLS.find(tool => tool.name === functionName);
  if (worldTool) {
    if (!worldTool.scopes.some(scope => options.scopes.includes(scope))) {
      throw new Error(`Tool scope not enabled: ${functionName}`);
    }
    const result = await executeWorldMonitorTool(functionName, args, {
      baseUrl: options.baseUrl,
      token: options.token,
      source: 'agent-chat',
    });
    return { name: functionName, args, result };
  }

  const externalTool = options.externalTools.find(tool => tool.name === functionName);
  if (externalTool) {
    const result = await mcpRpc(
      options.connectors.find(connector => connector.id === externalTool.connectorId)?.endpoint || '',
      'tools/call',
      { name: externalTool.originalName, arguments: args },
      options.connectors.find(connector => connector.id === externalTool.connectorId)?.apiKey || '',
    );
    return { name: functionName, args, result };
  }

  throw new Error(`Unknown tool: ${functionName}`);
}

async function callOpenAiChat(connector, messages, tools) {
  const headers = { 'Content-Type': 'application/json' };
  if (connector.apiKey) headers.Authorization = `Bearer ${connector.apiKey}`;
  const response = await fetch(chatCompletionsUrl(connector.endpoint), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: connector.model || 'default',
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Agent API error ${response.status}${text ? `: ${text.slice(0, 180)}` : ''}`);
  }
  return response.json();
}

async function handleChat(body, context) {
  const connector = getConnector(body.connectorId);
  if (!connector) return jsonResponse({ error: 'Connector not found or disabled.' }, 404);
  if (connector.type !== 'openai-compatible') {
    return jsonResponse({ error: 'Chat requires an OpenAI-compatible connector.' }, 400);
  }

  const endpointCheck = validateConnectorEndpoint(connector.endpoint);
  if (!endpointCheck.ok) return jsonResponse({ error: endpointCheck.error }, 400);

  const inputMessages = Array.isArray(body.messages) ? body.messages : [];
  const messages = inputMessages
    .filter(message => message && typeof message === 'object' && typeof message.content === 'string')
    .map(message => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content.slice(0, 8000) }));
  if (messages.length === 0) return jsonResponse({ error: 'At least one message is required.' }, 400);

  const scopes = connector.scopes;
  const connectors = readAgentConnectors();
  const worldTools = getScopedWorldMonitorTools(scopes).map(toOpenAiTool);
  // Client-executed map tools ride along in the tool list; the gateway
  // intercepts their calls below and forwards them to the browser via
  // toolEvents instead of executing anything server-side.
  const clientMapTools = CLIENT_EXECUTED_TOOLS
    .filter(tool => tool.scopes.some(scope => scopes.includes(scope)))
    .map(toOpenAiTool);
  const externalTools = await listExternalMcpTools(connectors, connector);
  const externalOpenAiTools = externalTools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
  const tools = [...worldTools, ...clientMapTools, ...externalOpenAiTools];
  const toolEvents = [];
  const alertDrafts = [];
  const conversation = [
    {
      role: 'system',
      content: 'You are connected to World Monitor live data and the analyst\'s map/globe. Use tools when live or up-to-date intelligence is needed. Use set_map_view, zoom_to_region, or toggle_map_layers to point the analyst\'s dashboard at what you are discussing. Alert tools only create drafts that require user approval.',
    },
    ...messages,
  ];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const payload = await callOpenAiChat(connector, conversation, tools);
    const choice = payload.choices?.[0];
    const assistant = choice?.message;
    if (!assistant) return jsonResponse({ error: 'Agent response did not include a message.' }, 502);

    conversation.push(assistant);
    const toolCalls = Array.isArray(assistant.tool_calls) ? assistant.tool_calls : [];
    if (toolCalls.length === 0) {
      return jsonResponse({
        content: assistant.content || '',
        model: payload.model || connector.model,
        connector: redactConnector(connector),
        toolEvents,
        alertDrafts,
      });
    }

    for (const toolCall of toolCalls) {
      try {
        const event = await executeOpenAiToolCall(toolCall, {
          scopes,
          connectors,
          externalTools,
          baseUrl: `http://127.0.0.1:${context.port}`,
          token: process.env.LOCAL_API_TOKEN || '',
        });
        toolEvents.push(event);
        if (event.result?.alertDraft) alertDrafts.push(event.result.alertDraft);
        conversation.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(event.result),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toolEvents.push({ name: toolCall.function?.name || 'unknown', error: message });
        conversation.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: message }),
        });
      }
    }
  }

  return jsonResponse({
    content: 'Tool loop stopped after reaching the maximum iteration limit.',
    connector: redactConnector(connector),
    toolEvents,
    alertDrafts,
    stopped: 'max_tool_iterations',
  });
}

async function handleMcp(requestUrl, body, context) {
  const connectorId = requestUrl.searchParams.get('connectorId') || body?.params?.connectorId || '';
  const connector = connectorId ? getConnector(connectorId) : null;
  const scopes = connector ? connector.scopes : [...DEFAULT_AGENT_SCOPES];
  const method = body?.method;
  const id = body?.id ?? null;
  const scopedTools = getScopedWorldMonitorTools(scopes);

  try {
    if (method === 'initialize') {
      return jsonResponse({ jsonrpc: '2.0', id, result: { protocolVersion: '2025-06-18', serverInfo: { name: 'worldmonitor-desktop', version: '0.1.0' }, capabilities: { tools: {} } } });
    }
    if (method === 'tools/list') {
      return jsonResponse({ jsonrpc: '2.0', id, result: { tools: scopedTools.map(toMcpTool) } });
    }
    if (method === 'tools/call') {
      const name = body.params?.name;
      const args = body.params?.arguments || {};
      const tool = scopedTools.find(entry => entry.name === name);
      if (!tool) throw new Error(`Tool not found or scope denied: ${name}`);
      const result = await executeWorldMonitorTool(name, args, {
        baseUrl: `http://127.0.0.1:${context.port}`,
        token: process.env.LOCAL_API_TOKEN || '',
        source: 'mcp',
      });
      return jsonResponse({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } });
    }
    return jsonResponse({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } }, 404);
  } catch (error) {
    return jsonResponse({ jsonrpc: '2.0', id, error: { code: -32000, message: error instanceof Error ? error.message : String(error) } }, 200);
  }
}

export async function handleAgentGateway(requestUrl, req, context) {
  if (requestUrl.pathname === '/api/agent-gateway/status') {
    const connectors = readAgentConnectors();
    return jsonResponse({
      ok: true,
      transport: 'streamable-http',
      mcpPath: '/api/agent-gateway/mcp',
      defaultScopes: DEFAULT_AGENT_SCOPES,
      optionalScopes: OPTIONAL_AGENT_SCOPES,
      connectors: connectors.map(redactConnector),
      tools: WORLD_MONITOR_TOOLS.map(tool => ({
        name: tool.name,
        description: tool.description,
        scopes: tool.scopes,
        risk: tool.risk,
      })),
    });
  }

  if (requestUrl.pathname === '/api/agent-gateway/test-connector') {
    if (req.method !== 'POST') return jsonResponse({ error: 'POST required' }, 405);
    const body = await readJsonBody(req);
    const connector = normalizeConnector(body.connector || body);
    if (!connector) return jsonResponse({ ok: false, error: 'Invalid connector.' }, 400);
    const result = connector.type === 'openai-compatible'
      ? await testOpenAiConnector(connector)
      : await testMcpConnector(connector);
    return jsonResponse(result, result.ok ? 200 : 422);
  }

  if (requestUrl.pathname === '/api/agent-gateway/chat') {
    if (req.method !== 'POST') return jsonResponse({ error: 'POST required' }, 405);
    return handleChat(await readJsonBody(req), context);
  }

  if (requestUrl.pathname === '/api/agent-gateway/mcp') {
    if (req.method === 'GET') {
      const connectorId = requestUrl.searchParams.get('connectorId') || '';
      const connector = connectorId ? getConnector(connectorId) : null;
      const scopes = connector ? connector.scopes : [...DEFAULT_AGENT_SCOPES];
      return jsonResponse({ tools: getScopedWorldMonitorTools(scopes).map(toMcpTool) });
    }
    if (req.method !== 'POST') return jsonResponse({ error: 'GET or POST required' }, 405);
    return handleMcp(requestUrl, await readJsonBody(req), context);
  }

  return null;
}
