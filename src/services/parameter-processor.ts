import type { NodeTypeDef, ParamDef } from './workflow-types';

export function coerceParam(def: ParamDef, value: unknown): unknown {
  if (value == null || value === '') return def.default;
  if (def.type === 'number') return Number(value);
  if (def.type === 'boolean') return value === true || value === 'true' || value === 'on';
  if (def.type === 'json') {
    if (typeof value !== 'string') return value;
    return JSON.parse(value);
  }
  return String(value);
}

export function processParams(def: NodeTypeDef, raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const param of def.params) {
    const value = coerceParam(param, raw[param.key]);
    if (param.required && (value == null || value === '')) throw new Error(`${param.label} is required`);
    out[param.key] = value;
  }
  return out;
}
