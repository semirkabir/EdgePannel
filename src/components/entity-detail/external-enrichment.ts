import type { PopupType } from '@/components/MapPopup';
import type { EntityRenderContext } from './types';
import { fetchExternalEnrichment, getExternalEnrichmentQuery, type ExternalEnrichmentSource } from '@/services/external-enrichment';
import { sanitizeUrl } from '@/utils/sanitize';

function shouldRenderSource(source: ExternalEnrichmentSource): boolean {
  return source.status === 'ok' || source.status === 'not_configured' || source.status === 'unavailable' || source.status === 'error';
}

function statusBadgeClass(status: string): string {
  if (status === 'ok') return 'edp-badge edp-badge-status';
  if (status === 'error') return 'edp-badge edp-badge-severity';
  if (status === 'not_configured' || status === 'unavailable') return 'edp-badge edp-badge-warning';
  return 'edp-badge edp-badge-dim';
}

function appendSource(ctx: EntityRenderContext, body: HTMLElement, source: ExternalEnrichmentSource): void {
  const row = ctx.el('div', 'edp-disclosure-row');
  row.append(ctx.badge(source.source, statusBadgeClass(source.status)));

  const info = ctx.el('div', 'edp-disclosure-info');
  info.append(ctx.el('span', 'edp-disclosure-name', source.summary));
  if (source.status !== 'ok') {
    info.append(ctx.el('span', 'edp-disclosure-detail', source.status.replace(/_/g, ' ')));
  }
  row.append(info);
  body.append(row);

  for (const item of source.items.slice(0, 3)) {
    const itemRow = ctx.el('div', 'edp-detail-row');
    itemRow.append(ctx.el('span', 'edp-detail-label', source.source));
    const value = item.url ? ctx.el('a', 'edp-detail-value') as HTMLAnchorElement : ctx.el('span', 'edp-detail-value');
    if (value instanceof HTMLAnchorElement) {
      value.href = sanitizeUrl(item.url);
      value.target = '_blank';
      value.rel = 'noopener noreferrer';
    }
    value.textContent = [item.title, item.value].filter(Boolean).join(' - ');
    itemRow.append(value);
    body.append(itemRow);

    const detail = [item.subtitle, item.description].filter(Boolean).join(' · ');
    if (detail) body.append(ctx.el('p', 'edp-description', detail));
  }
}

export async function attachExternalDatasetEnrichment(
  container: HTMLElement,
  type: PopupType,
  data: unknown,
  ctx: EntityRenderContext,
  signal: AbortSignal,
): Promise<void> {
  if (!getExternalEnrichmentQuery(type, data)) return;
  if (container.querySelector('[data-external-enrichment="true"]')) return;

  const [card, body] = ctx.sectionCard('External Data');
  card.dataset.externalEnrichment = 'true';
  body.append(ctx.makeLoading('Checking external datasets...'));
  container.append(card);

  const enrichment = await fetchExternalEnrichment(type, data, signal);
  if (signal.aborted) return;
  if (!enrichment) {
    card.remove();
    return;
  }

  const sources = enrichment.sources.filter(shouldRenderSource);
  if (sources.length === 0) {
    card.remove();
    return;
  }

  body.replaceChildren();
  for (const source of sources.slice(0, 6)) appendSource(ctx, body, source);
}
