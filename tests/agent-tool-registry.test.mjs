import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  buildAlertDraft,
  executeWorldMonitorTool,
  getScopedWorldMonitorTools,
  toMcpTool,
  toOpenAiTool,
  validateToolArguments,
  WORLD_MONITOR_TOOLS,
} from '../src-tauri/sidecar/agent-tool-registry.mjs';

test('agent tool registry converts tools to MCP and OpenAI schemas', () => {
  const tool = WORLD_MONITOR_TOOLS.find(entry => entry.name === 'get_country_intel_brief');
  assert.ok(tool);

  const mcpTool = toMcpTool(tool);
  assert.equal(mcpTool.name, 'get_country_intel_brief');
  assert.equal(mcpTool.inputSchema.properties.country_code.type, 'string');
  assert.deepEqual(mcpTool.inputSchema.required, ['country_code']);
  assert.equal('required' in mcpTool.inputSchema.properties.country_code, false);

  const openAiTool = toOpenAiTool(tool);
  assert.equal(openAiTool.type, 'function');
  assert.equal(openAiTool.function.name, 'get_country_intel_brief');
  assert.deepEqual(openAiTool.function.parameters.required, ['country_code']);
});

test('agent tool registry enforces scopes and required arguments', () => {
  const readOnlyTools = getScopedWorldMonitorTools(['news']);
  assert.ok(readOnlyTools.some(tool => tool.name === 'list_feed_digest'));
  assert.equal(readOnlyTools.some(tool => tool.name === 'create_alert_draft'), false);

  const countryTool = WORLD_MONITOR_TOOLS.find(entry => entry.name === 'get_country_intel_brief');
  assert.deepEqual(validateToolArguments(countryTool, { country_code: 'US' }).ok, true);
  assert.deepEqual(validateToolArguments(countryTool, {}).ok, false);
});

test('create_alert_draft produces pending inactive drafts only', () => {
  const draft = buildAlertDraft({
    name: 'Oil chokepoint risk',
    keywords: 'oil, pipeline, strait',
    severity: 'critical',
    region: 'mena',
    entities: 'Hormuz, Ras Tanura',
    signalTypes: 'news,infrastructure',
    threshold: 90,
    evidenceRequirement: 'corroborated',
  });
  assert.equal(draft.pending, true);
  assert.equal(draft.active, false);
  assert.deepEqual(draft.keywords, ['oil', 'pipeline', 'strait']);
  assert.equal(draft.severity, 'critical');
  assert.equal(draft.region, 'mena');
  assert.deepEqual(draft.entities, ['Hormuz', 'Ras Tanura']);
  assert.deepEqual(draft.signalTypes, ['news', 'infrastructure']);
  assert.equal(draft.threshold, 90);
  assert.equal(draft.evidenceRequirement, 'corroborated');
});

test('agent registry exposes analyst workbench read tools', () => {
  const tools = getScopedWorldMonitorTools(['news', 'intelligence', 'alerts', 'markets']);
  assert.ok(tools.some(tool => tool.name === 'search_news'));
  assert.ok(tools.some(tool => tool.name === 'list_map_layers'));
  assert.ok(tools.some(tool => tool.name === 'export_brief'));
  assert.ok(tools.some(tool => tool.name === 'list_alerts'));
  assert.ok(tools.some(tool => tool.name === 'get_portfolio_summary'));
});

test('portfolio agent tools expose browser-local storage contract', async () => {
  const result = await executeWorldMonitorTool('get_portfolio_summary', { portfolio_id: 'default' }, {});
  assert.equal(result.storage, 'browser-local');
  assert.equal(result.availableInFrontend, true);
  assert.equal(result.portfolioId, 'default');
  assert.ok(result.suggestedFrontendApis.includes('buildPortfolioSummary'));
});
