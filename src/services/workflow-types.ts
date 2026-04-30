export type WorkflowStatus = 'Draft' | 'Idle' | 'Running' | 'Completed' | 'Error';
export type ConnectionType =
  | 'Main' | 'AiLanguageModel' | 'AiMemory' | 'AiTool' | 'MarketData' | 'PortfolioData'
  | 'PriceData' | 'SignalData' | 'RiskData' | 'BacktestData' | 'TechnicalData'
  | 'FundamentalData' | 'NewsData' | 'EconomicData' | 'OptionsData';

export type ParamType = 'string' | 'number' | 'boolean' | 'select' | 'code' | 'json' | 'expression';

export interface ParamDef {
  key: string;
  label: string;
  type: ParamType;
  default?: unknown;
  options?: string[];
  required?: boolean;
}

export interface NodePortDef {
  id: string;
  label: string;
  type: ConnectionType;
}

export interface NodeTypeDef {
  type: string;
  label: string;
  category: string;
  description: string;
  inputs: NodePortDef[];
  outputs: NodePortDef[];
  params: ParamDef[];
  implemented: boolean;
}

export interface WorkflowNode {
  id: string;
  type: string;
  label: string;
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
  type: ConnectionType;
}

export interface WorkflowRunLog {
  id: string;
  workflow_id: string;
  status: WorkflowStatus;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  node_results: Record<string, unknown>;
  error?: string;
}

export interface WorkflowDef {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  created_at: string;
  updated_at: string;
  last_run?: WorkflowRunLog;
  run_history: WorkflowRunLog[];
}
