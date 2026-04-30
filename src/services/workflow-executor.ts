import { listOhlcv } from './market/ohlcv';
import { evaluateArithmetic, renderTemplate } from './expression-engine';
import { nodeRegistry } from './node-registry';
import { processParams } from './parameter-processor';
import type { WorkflowDef, WorkflowNode, WorkflowRunLog } from './workflow-types';

function nowIso(): string {
  return new Date().toISOString();
}

function topoSort(workflow: WorkflowDef): WorkflowNode[] {
  const incoming = new Map(workflow.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, string[]>();
  for (const edge of workflow.edges) {
    incoming.set(edge.to_node, (incoming.get(edge.to_node) ?? 0) + 1);
    outgoing.set(edge.from_node, [...(outgoing.get(edge.from_node) ?? []), edge.to_node]);
  }

  const queue = workflow.nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0);
  const ordered: WorkflowNode[] = [];
  while (queue.length) {
    const node = queue.shift()!;
    ordered.push(node);
    for (const target of outgoing.get(node.id) ?? []) {
      incoming.set(target, (incoming.get(target) ?? 0) - 1);
      if ((incoming.get(target) ?? 0) === 0) {
        const next = workflow.nodes.find((item) => item.id === target);
        if (next) queue.push(next);
      }
    }
  }
  if (ordered.length !== workflow.nodes.length) throw new Error('Workflow contains a cycle');
  return ordered;
}

export async function executeWorkflow(workflow: WorkflowDef): Promise<WorkflowRunLog> {
  const started = performance.now();
  const nodeResults: Record<string, unknown> = {};
  const run: WorkflowRunLog = {
    id: `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    workflow_id: workflow.id,
    status: 'Running',
    started_at: nowIso(),
    node_results: nodeResults,
  };

  try {
    for (const node of topoSort(workflow)) {
      if (node.disabled) continue;
      const def = nodeRegistry.get(node.type);
      if (!def) throw new Error(`Unknown node type ${node.type}`);
      const params = processParams(def, node.params);
      const resultValues = Object.values(nodeResults);
      const input = resultValues[resultValues.length - 1];
      let tries = 0;
      const maxTries = node.retry_on_fail ? Math.max(1, node.max_tries ?? 2) : 1;
      while (tries < maxTries) {
        tries += 1;
        try {
          nodeResults[node.id] = await executeNode(node.type, params, input, nodeResults);
          break;
        } catch (error) {
          if (tries >= maxTries) {
            if (node.continue_on_fail) {
              nodeResults[node.id] = { error: String(error), continued: true };
              break;
            }
            throw error;
          }
        }
      }
    }
    run.status = 'Completed';
  } catch (error) {
    run.status = 'Error';
    run.error = String(error);
  }

  run.completed_at = nowIso();
  run.duration_ms = Math.round(performance.now() - started);
  return run;
}

async function executeNode(
  type: string,
  params: Record<string, unknown>,
  input: unknown,
  vars: Record<string, unknown>,
): Promise<unknown> {
  if (!nodeRegistry.get(type)?.implemented) {
    throw new Error(`NotImplemented: ${type}`);
  }
  if (type === 'trigger.manual') return { triggered: true, at: nowIso() };
  if (type === 'trigger.schedule') return { scheduled: true, at: nowIso() };
  if (type === 'trigger.webhook') return { webhook: true, payload: input ?? {} };
  if (type === 'market.get_quote') {
    const symbol = String(params.symbol ?? 'SPY').toUpperCase();
    const bars = await listOhlcv({ symbol, limit: 1, preferApi: false }).then((result) => result.bars);
    const last = bars[bars.length - 1];
    return { symbol, price: last?.close ?? 0, date: last?.date ?? '' };
  }
  if (type === 'market.get_historical') {
    const symbol = String(params.symbol ?? 'SPY').toUpperCase();
    return listOhlcv({ symbol, limit: Number(params.limit ?? 90), preferApi: false });
  }
  if (type === 'market.get_news') return { headlines: [] };
  if (type === 'market.get_economics') return { indicators: [] };
  if (type === 'analytics.ma_crossover') return { signal: 'hold', input };
  if (type.startsWith('analytics.')) return { computed: type, input };
  if (type === 'control.if') return { pass: Boolean(evaluateArithmetic(String(params.expression ?? 'true'), vars)), input };
  if (type.startsWith('control.')) return input ?? { ok: true };
  if (type === 'transform.filter') return Array.isArray(input) ? input : [];
  if (type === 'transform.map') return Array.isArray(input) ? input : [input];
  if (type === 'transform.sort') return Array.isArray(input) ? [...input].sort() : input;
  if (type === 'transform.aggregate') return { count: Array.isArray(input) ? input.length : input == null ? 0 : 1, input };
  if (type === 'transform.group_by') return { groups: {}, input };
  if (type === 'format.json') return JSON.stringify(input ?? {}, null, 2);
  if (type === 'utility.datetime') return { now: nowIso() };
  if (type === 'utility.log_node') return { logged: input };
  if (type === 'utility.template_render') return renderTemplate(String(params.template ?? '{{ input }}'), { ...vars, input });
  if (type === 'utility.code') {
    const fn = Function('input', 'vars', `"use strict"; ${String(params.code ?? 'return input;')}`) as (input: unknown, vars: Record<string, unknown>) => unknown;
    return fn(input, vars);
  }
  if (type === 'utility.http_request') return { skipped: true, url: params.url, reason: 'Network side effects are disabled in browser v1.' };
  if (type === 'notification.webhook') return { notified: false, url: params.url, reason: 'Webhook delivery requires sidecar or backend.' };
  if (type === 'output.results_display') return { display: input };
  throw new Error(`NotImplemented: ${type}`);
}
