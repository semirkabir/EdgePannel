export function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, path: string) => {
    const value = resolvePath(path.trim(), vars);
    return value == null ? '' : String(value);
  });
}

export function resolvePath(path: string, vars: Record<string, unknown>): unknown {
  const clean = path.replace(/^vars\./, '');
  return clean.split('.').reduce<unknown>((current, key) => {
    if (typeof current !== 'object' || current === null) return undefined;
    return (current as Record<string, unknown>)[key];
  }, vars);
}

export function evaluateArithmetic(expression: string, vars: Record<string, unknown> = {}): number | boolean {
  const replaced = expression.replace(/\bvars\.([a-zA-Z0-9_.]+)\b/g, (_, path: string) => String(resolvePath(path, vars) ?? 0));
  if (!/^[\d\s+\-*/().<>=!&|]+$/.test(replaced)) return false;
  try {
    return Function(`"use strict"; return (${replaced});`)() as number | boolean;
  } catch {
    return false;
  }
}
