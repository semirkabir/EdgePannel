import type { AlgoCondition, AlgoConditionJoin } from './algo-types';
import type { OhlcvBar } from './market/ohlcv';
import { indicatorValue, previousIndicatorValue } from './algo-indicators';

function compare(left: number | string | boolean, right: number | string | boolean, operator: string): boolean {
  if (operator === '==') return left === right;
  if (operator === '!=') return left !== right;
  const a = Number(left);
  const b = Number(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (operator === '>') return a > b;
  if (operator === '<') return a < b;
  if (operator === '>=') return a >= b;
  if (operator === '<=') return a <= b;
  return false;
}

export function evaluateCondition(condition: AlgoCondition, bars: OhlcvBar[], index = bars.length - 1): boolean {
  const left = indicatorValue(condition.left, bars, index);
  const right = condition.compareMode === 'indicator' && condition.rightIndicator
    ? indicatorValue(condition.rightIndicator, bars, index)
    : condition.rightValue ?? 0;

  if (condition.operator === 'crosses_above' && condition.rightIndicator) {
    return previousIndicatorValue(condition.left, bars, index) <= previousIndicatorValue(condition.rightIndicator, bars, index)
      && left > Number(right);
  }
  if (condition.operator === 'crosses_below' && condition.rightIndicator) {
    return previousIndicatorValue(condition.left, bars, index) >= previousIndicatorValue(condition.rightIndicator, bars, index)
      && left < Number(right);
  }

  return compare(left, right, condition.operator);
}

export function evaluateConditions(
  conditions: AlgoCondition[],
  join: AlgoConditionJoin,
  bars: OhlcvBar[],
  index = bars.length - 1,
): boolean {
  if (conditions.length === 0) return false;
  const checks = conditions.map((condition) => evaluateCondition(condition, bars, index));
  return join === 'AND' ? checks.every(Boolean) : checks.some(Boolean);
}
