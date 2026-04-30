import type { ConnectionType, NodeTypeDef, ParamDef } from './workflow-types';

const CATEGORIES = [
  'Triggers', 'Market Data', 'Analytics', 'Control Flow', 'Data Transform', 'Data Format',
  'Utilities', 'Notifications', 'Output', 'Portfolio', 'Backtesting', 'Risk',
  'News', 'Economics',
] as const;

const IMPLEMENTED = new Set([
  'trigger.manual', 'trigger.schedule', 'trigger.webhook',
  'market.get_quote', 'market.get_historical', 'market.get_news', 'market.get_economics',
  'analytics.technical_indicators', 'analytics.correlation_matrix', 'analytics.performance_metrics', 'analytics.ma_crossover',
  'control.if', 'control.merge', 'control.delay', 'control.loop', 'control.switch', 'control.stop',
  'transform.filter', 'transform.map', 'transform.sort', 'transform.aggregate', 'transform.group_by',
  'format.json', 'utility.http_request', 'utility.code', 'utility.datetime', 'utility.log_node', 'utility.template_render',
  'notification.webhook', 'output.results_display',
]);

const BASE_PARAMS: ParamDef[] = [
  { key: 'label', label: 'Label', type: 'string', default: '' },
];

const CATEGORY_TYPES: Record<typeof CATEGORIES[number], string[]> = {
  Triggers: ['manual', 'schedule', 'webhook', 'market_open', 'price_alert', 'news_alert', 'timer', 'file_drop'],
  'Market Data': ['get_quote', 'get_historical', 'get_news', 'get_economics', 'get_options', 'get_fundamentals', 'get_insiders', 'get_13f'],
  Analytics: ['technical_indicators', 'correlation_matrix', 'performance_metrics', 'ma_crossover', 'rsi_signal', 'macd_signal', 'volatility', 'zscore'],
  'Control Flow': ['if', 'merge', 'delay', 'loop', 'switch', 'stop', 'parallel', 'join'],
  'Data Transform': ['filter', 'map', 'sort', 'aggregate', 'group_by', 'join', 'dedupe', 'window'],
  'Data Format': ['json', 'csv', 'table', 'markdown', 'xml', 'yaml', 'chart_series', 'html'],
  Utilities: ['http_request', 'code', 'datetime', 'log_node', 'template_render', 'secret_lookup', 'cache_get', 'cache_set'],
  Notifications: ['webhook', 'email', 'sms', 'telegram', 'slack', 'desktop', 'push', 'incident'],
  Output: ['results_display', 'save_file', 'append_log', 'dashboard_card', 'download_json', 'send_to_panel', 'audit', 'report'],
  Portfolio: ['load_portfolio', 'holdings', 'rebalance', 'drift_check', 'sector_alloc', 'transactions', 'risk_summary', 'export'],
  Backtesting: ['run_backtest', 'optimize', 'walk_forward', 'equity_curve', 'trade_stats', 'strategy_params', 'benchmark', 'export_result'],
  Risk: ['var', 'cvar', 'drawdown', 'stress_test', 'scenario', 'exposure', 'concentration', 'liquidity'],
  News: ['rss_fetch', 'classify', 'sentiment', 'cluster', 'summarize', 'entity_extract', 'topic_score', 'alert_match'],
  Economics: ['fred_series', 'worldbank', 'eia', 'bis', 'macro_score', 'calendar', 'inflation', 'rates'],
};

const CATEGORY_PREFIX: Record<typeof CATEGORIES[number], string> = {
  Triggers: 'trigger',
  'Market Data': 'market',
  Analytics: 'analytics',
  'Control Flow': 'control',
  'Data Transform': 'transform',
  'Data Format': 'format',
  Utilities: 'utility',
  Notifications: 'notification',
  Output: 'output',
  Portfolio: 'portfolio',
  Backtesting: 'backtest',
  Risk: 'risk',
  News: 'news',
  Economics: 'economics',
};

function title(value: string): string {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function paramsFor(type: string): ParamDef[] {
  if (type === 'market.get_quote') return [{ key: 'symbol', label: 'Symbol', type: 'string', default: 'SPY', required: true }];
  if (type === 'market.get_historical') return [{ key: 'symbol', label: 'Symbol', type: 'string', default: 'SPY' }, { key: 'limit', label: 'Limit', type: 'number', default: 90 }];
  if (type === 'utility.http_request' || type === 'notification.webhook') return [{ key: 'url', label: 'URL', type: 'string', default: '' }, { key: 'method', label: 'Method', type: 'select', default: 'GET', options: ['GET', 'POST'] }];
  if (type === 'utility.code') return [{ key: 'code', label: 'Code', type: 'code', default: 'return input;' }];
  if (type === 'utility.template_render') return [{ key: 'template', label: 'Template', type: 'expression', default: '{{ input }}' }];
  if (type === 'control.if') return [{ key: 'expression', label: 'Expression', type: 'expression', default: 'true' }];
  return BASE_PARAMS;
}

function outputType(type: string): ConnectionType {
  if (type.startsWith('market.')) return 'MarketData';
  if (type.startsWith('analytics.')) return 'TechnicalData';
  if (type.startsWith('portfolio.')) return 'PortfolioData';
  if (type.startsWith('backtest.')) return 'BacktestData';
  if (type.startsWith('risk.')) return 'RiskData';
  if (type.startsWith('news.')) return 'NewsData';
  if (type.startsWith('economics.')) return 'EconomicData';
  return 'Main';
}

function buildRegistry(): NodeTypeDef[] {
  return CATEGORIES.flatMap((category) => CATEGORY_TYPES[category].map((shortName) => {
    const type = `${CATEGORY_PREFIX[category]}.${shortName}`;
    return {
      type,
      label: title(shortName),
      category,
      description: `${title(shortName)} workflow node.`,
      inputs: category === 'Triggers' ? [] : [{ id: 'in', label: 'In', type: 'Main' as const }],
      outputs: [{ id: 'out', label: 'Out', type: outputType(type) }],
      params: paramsFor(type),
      implemented: IMPLEMENTED.has(type),
    };
  }));
}

export class NodeRegistry {
  private readonly defs = new Map<string, NodeTypeDef>();

  public constructor() {
    for (const def of buildRegistry()) this.register(def);
  }

  public register(def: NodeTypeDef): void {
    this.defs.set(def.type, def);
  }

  public get(type: string): NodeTypeDef | null {
    return this.defs.get(type) ?? null;
  }

  public list(): NodeTypeDef[] {
    return Array.from(this.defs.values());
  }

  public byCategory(): Record<string, NodeTypeDef[]> {
    const grouped: Record<string, NodeTypeDef[]> = {};
    for (const def of this.defs.values()) {
      grouped[def.category] ??= [];
      grouped[def.category]!.push(def);
    }
    return grouped;
  }
}

export const nodeRegistry = new NodeRegistry();
