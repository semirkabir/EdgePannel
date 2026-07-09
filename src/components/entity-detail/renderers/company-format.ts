/**
 * Pure value formatters for the company entity renderer.
 *
 * Extracted from company.ts to keep the (large) renderer focused on rendering.
 * These are all pure functions with no DOM or module-state dependencies.
 */

export function fmtChange(change: number): string {
  return (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
}

export function fmtPrice(price: number): string {
  return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return isoDate;
  }
}

export function fmtLargeNumber(value: number): string {
  if (value >= 1e12) return '$' + (value / 1e12).toFixed(2) + 'T';
  if (value >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return '$' + (value / 1e6).toFixed(2) + 'M';
  if (value >= 1e3) return '$' + (value / 1e3).toFixed(1) + 'K';
  return '$' + value.toFixed(0);
}

export function fmtFinancialValue(value: number | null | undefined, currency = '$'): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '-';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${sign}${currency}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${currency}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${currency}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${currency}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${currency}${abs.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

export function fmtPlainNumber(value: number | null | undefined, suffix = ''): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '-';
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 }) + suffix;
}

export function fmtFinnhubMarketCap(value: number): string {
  return fmtLargeNumber(value * 1_000_000);
}

export function fmtShares(value: number): string {
  if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
  if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
  return value.toFixed(0);
}

export function fmtMetric(value: number | undefined, suffix = ''): string {
  if (value === undefined || value === null || isNaN(value)) return '—';
  return value.toFixed(2) + suffix;
}

export function fmtPercent(value: number | undefined): string {
  return fmtMetric(value, '%');
}
