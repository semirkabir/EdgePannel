/**
 * workflow-types.ts
 *
 * Type definitions for the Node Editor / Workflow feature track.
 * Matches the Fincept porting guide's workflow schema so JSON exports
 * are round-trip compatible.
 *
 * Field names use snake_case to match the guide's Python schema.
 */

// ─── Workflow status ──────────────────────────────────────────────────────────

export type WorkflowStatus = 'Draft' | 'Idle' | 'Running' | 'Completed' | 'Error';

// ─── Node / Edge definitions ─────────────────────────────────────────────────

export interface WorkflowNode {
  id: string;
  /** Refers to a registered type in NodeRegistry (e.g. "manual_trigger", "get_quote"). */
  type: string;
  label?: string;
  x: number;
  y: number;
  params: Record<string, unknown>;
  disabled?: boolean;
  continue_on_fail?: boolean;
  retry_on_fail?: boolean;
  max_tries?: number;
}

export interface WorkflowEdge {
  id: string;
  from_node: string;
  from_port: string;
  to_node: string;
  to_port: string;
  /** Connection type string e.g. "Main", "MarketData", "SignalData" */
  type?: string;
}

// ─── Run history ──────────────────────────────────────────────────────────────

export type WorkflowRunStatus = 'Running' | 'Completed' | 'Error';

export interface WorkflowNodeResult {
  node_id: string;
  status: 'success' | 'error' | 'skipped';
  duration_ms: number;
  output?: unknown;
  error?: string;
}

export interface WorkflowRunLog {
  id: string;
  workflow_id: string;
  status: WorkflowRunStatus;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  /** Map of node_id → result (also kept as record for fast lookup during execution). */
  node_results: Record<string, unknown>;
  error?: string;
}

// ─── Workflow definition ──────────────────────────────────────────────────────

export interface WorkflowDef {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  created_at: string;
  updated_at: string;
  /** Most recent execution log (also the last entry in run_history). */
  last_run?: WorkflowRunLog;
  /** Bounded history of run logs (newest-first, capped at ~20 entries). */
  run_history: WorkflowRunLog[];
}

// ─── Node registry types ──────────────────────────────────────────────────────

export type ParamDefType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'select'
  | 'code'
  | 'json'
  | 'expression';

export interface ParamDef {
  /** Machine-readable identifier — used by node-registry and workers. */
  key: string;
  label: string;
  type: ParamDefType;
  default?: unknown;
  required?: boolean;
  options?: string[];       // for 'select' type
  placeholder?: string;
  description?: string;
}

export interface NodeTypeDef {
  /** Dot-namespaced type identifier, e.g. "market.get_quote". Used as registry key. */
  type: string;
  label: string;
  category: string;
  description?: string;
  params: ParamDef[];
  inputs: PortDef[];
  outputs: PortDef[];
  /** True when this node has a working execute function (v1 ships ~30 implemented). */
  implemented?: boolean;
  /** Execute function — present only for implemented nodes. */
  execute?: (params: Record<string, unknown>, inputs: Record<string, unknown>) => Promise<unknown>;
}

export interface PortDef {
  /** Port identifier used for edge wiring. */
  id: string;
  label: string;
  /** Connection type e.g. "Main", "MarketData", "SignalData" */
  type: string;
  required?: boolean;
  multi?: boolean;          // port accepts multiple connections
}

// ─── Connection types ─────────────────────────────────────────────────────────

export const CONNECTION_TYPES = [
  'Main',
  'AiLanguageModel',
  'AiMemory',
  'AiTool',
  'MarketData',
  'PortfolioData',
  'PriceData',
  'SignalData',
  'RiskData',
  'BacktestData',
  'TechnicalData',
  'FundamentalData',
  'NewsData',
  'EconomicData',
  'OptionsData',
] as const;

export type ConnectionType = typeof CONNECTION_TYPES[number];
