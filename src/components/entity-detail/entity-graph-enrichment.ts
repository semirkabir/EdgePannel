import type { PopupType } from '@/components/MapPopup';
import type { EntityRenderContext } from './types';
import { fetchEntityGraphEnrichment, supportsEntityGraphEnrichment } from '@/services/entity-graph';
import type { EntityGraphEdge, EntityGraphEnrichment, EntityGraphIdentifier, EntityGraphNode } from '@/services/entity-graph/types';
import { sanitizeUrl } from '@/utils/sanitize';

function formatDate(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function byId(nodes: EntityGraphNode[]): Map<string, EntityGraphNode> {
  return new Map(nodes.map(node => [node.id, node]));
}

function appendIdentifier(ctx: EntityRenderContext, row: HTMLElement, identifier: EntityGraphIdentifier): void {
  const text = `${identifier.label} ${identifier.value}`;
  if (identifier.url) {
    const link = ctx.el('a', 'edp-badge edp-badge-tier') as HTMLAnchorElement;
    link.href = sanitizeUrl(identifier.url);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = text;
    row.append(link);
    return;
  }
  row.append(ctx.badge(text, 'edp-badge edp-badge-tier'));
}

function appendEntityRow(ctx: EntityRenderContext, body: HTMLElement, node: EntityGraphNode): void {
  const row = ctx.el('div', 'edp-detail-row');
  row.append(ctx.el('span', 'edp-detail-label', node.kind === 'legal-entity' ? 'Legal entity' : 'SEC entity'));
  const value = node.url ? ctx.el('a', 'edp-detail-value') as HTMLAnchorElement : ctx.el('span', 'edp-detail-value');
  if (value instanceof HTMLAnchorElement) {
    value.href = sanitizeUrl(node.url || '');
    value.target = '_blank';
    value.rel = 'noopener noreferrer';
  }
  value.textContent = [node.label, node.country || node.jurisdiction, node.status].filter(Boolean).join(' - ');
  row.append(value);
  body.append(row);
}

function appendEdgeRow(
  ctx: EntityRenderContext,
  body: HTMLElement,
  edge: EntityGraphEdge,
  nodes: Map<string, EntityGraphNode>,
): void {
  const source = nodes.get(edge.source);
  const target = nodes.get(edge.target);
  if (!source || !target) return;

  const row = ctx.el('div', 'edp-disclosure-row');
  row.append(ctx.el('span', 'edp-disclosure-badge', edge.sourceSystem.toUpperCase()));
  const info = ctx.el('div', 'edp-disclosure-info');
  info.append(
    ctx.el('span', 'edp-disclosure-name', source.label),
    ctx.el('span', 'edp-disclosure-detail', `${edge.label} ${target.label}`),
  );
  row.append(info);
  row.append(ctx.el('span', 'edp-disclosure-date', edge.status || ''));
  body.append(row);
}

function renderGraph(body: HTMLElement, enrichment: EntityGraphEnrichment, ctx: EntityRenderContext): void {
  const identifiers = ctx.el('div', 'edp-badge-row');
  for (const identifier of enrichment.identifiers) {
    appendIdentifier(ctx, identifiers, identifier);
  }
  if (enrichment.stale) identifiers.append(ctx.badge('Cached', 'edp-badge edp-badge-warning'));
  body.append(identifiers);

  const resolvedRow = ctx.el('div', 'edp-detail-row');
  resolvedRow.append(ctx.el('span', 'edp-detail-label', 'Resolved'));
  resolvedRow.append(ctx.el('span', 'edp-detail-value', enrichment.entityLabel));
  body.append(resolvedRow);

  if (enrichment.sources.length > 0) {
    const sourceRow = ctx.el('div', 'edp-detail-row');
    sourceRow.append(ctx.el('span', 'edp-detail-label', 'Sources'));
    sourceRow.append(ctx.el('span', 'edp-detail-value', enrichment.sources.map(source => source.toUpperCase()).join(', ')));
    body.append(sourceRow);
  }

  const updated = formatDate(enrichment.updatedAt);
  if (updated) {
    const updatedRow = ctx.el('div', 'edp-detail-row');
    updatedRow.append(ctx.el('span', 'edp-detail-label', 'Updated'));
    updatedRow.append(ctx.el('span', 'edp-detail-value', updated));
    body.append(updatedRow);
  }

  const legalNodes = enrichment.nodes.filter(node => node.kind === 'legal-entity').slice(0, 4);
  const secNodes = enrichment.nodes.filter(node => node.kind === 'sec-filer' || node.kind === 'security').slice(0, 2);
  for (const node of [...legalNodes, ...secNodes]) appendEntityRow(ctx, body, node);

  const graphNodes = byId(enrichment.nodes);
  const edgeLimit = 8;
  for (const edge of enrichment.edges.slice(0, edgeLimit)) {
    appendEdgeRow(ctx, body, edge, graphNodes);
  }

  if (enrichment.recentFilings.length > 0) {
    for (const filing of enrichment.recentFilings.slice(0, 3)) {
      const row = ctx.el('div', 'edp-detail-row');
      row.append(ctx.el('span', 'edp-detail-label', filing.filingType || 'SEC'));
      if (filing.url) {
        const link = ctx.el('a', 'edp-detail-value') as HTMLAnchorElement;
        link.href = sanitizeUrl(filing.url);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = formatDate(filing.filedAt) || 'View filing';
        row.append(link);
      } else {
        row.append(ctx.el('span', 'edp-detail-value', formatDate(filing.filedAt) || 'Recent filing'));
      }
      body.append(row);
    }
  }

  const notes = enrichment.notes.filter(Boolean).slice(0, 2);
  for (const note of notes) {
    body.append(ctx.el('p', 'edp-description', note));
  }
}

export async function attachEntityGraphEnrichment(
  container: HTMLElement,
  type: PopupType,
  data: unknown,
  ctx: EntityRenderContext,
  signal: AbortSignal,
): Promise<void> {
  if (!supportsEntityGraphEnrichment(type)) return;
  if (container.querySelector('[data-entity-graph-enrichment="true"]')) return;

  const [card, body] = ctx.sectionCard('Entity Graph');
  card.dataset.entityGraphEnrichment = 'true';
  body.append(ctx.makeLoading('Resolving legal entity graph...'));
  container.append(card);

  const enrichment = await fetchEntityGraphEnrichment(type, data, signal);
  if (signal.aborted) return;
  if (!enrichment) {
    card.remove();
    return;
  }

  body.replaceChildren();
  renderGraph(body, enrichment, ctx);
}
