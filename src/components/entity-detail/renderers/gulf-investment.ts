import type { GulfInvestment } from '@/types';
import { row } from '../types';
import type { EntityRenderer, EntityRenderContext } from '../types';

const STATUS_CLASS: Record<string, string> = {
  operational: 'edp-badge edp-badge-status',
  'under-construction': 'edp-badge edp-badge-warning',
  announced: 'edp-badge edp-badge-dim',
  rumoured: 'edp-badge edp-badge-dim',
  cancelled: 'edp-badge edp-badge-dim',
  divested: 'edp-badge edp-badge-dim',
};

const COUNTRY_FLAGS: Record<string, string> = {
  SA: '\u{1F1F8}\u{1F1E6}',
  AE: '\u{1F1E6}\u{1F1EA}',
};

function formatUSD(value?: number): string {
  if (value == null) return '\u2014';
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}B`;
  return `$${value}M`;
}

export class GulfInvestmentRenderer implements EntityRenderer {
  renderSkeleton(data: unknown, ctx: EntityRenderContext): HTMLElement {
    const inv = data as GulfInvestment;
    const container = ctx.el('div', 'edp-generic');

    const header = ctx.el('div', 'edp-header');
    const flag = COUNTRY_FLAGS[inv.investingCountry] ?? '';
    header.append(ctx.el('h2', 'edp-title', `${flag} ${inv.assetName}`.trim()));
    header.append(ctx.el('div', 'edp-subtitle', `${inv.targetCountry} \u00b7 ${inv.sector}`));

    const badgeRow = ctx.el('div', 'edp-badge-row');
    badgeRow.append(ctx.badge(inv.investingEntity, 'edp-badge edp-badge-tier'));
    badgeRow.append(ctx.badge(inv.status.toUpperCase(), STATUS_CLASS[inv.status] ?? 'edp-badge'));
    badgeRow.append(ctx.badge(inv.assetType, 'edp-badge'));
    header.append(badgeRow);
    container.append(header);

    if (inv.description) {
      container.append(ctx.el('p', 'edp-description', inv.description));
    }

    const [detailCard, detailBody] = ctx.sectionCard('Investment Details');
    detailBody.append(row(ctx, 'Investor', inv.investingEntity));
    detailBody.append(row(ctx, 'Investor Country', inv.investingCountry));
    detailBody.append(row(ctx, 'Target Country', inv.targetCountry));
    detailBody.append(row(ctx, 'Sector', inv.sector));
    detailBody.append(row(ctx, 'Asset Type', inv.assetType));
    if (inv.investmentUSD != null) {
      detailBody.append(row(ctx, 'Investment', formatUSD(inv.investmentUSD)));
    }
    if (inv.stakePercent != null) {
      detailBody.append(row(ctx, 'Stake', `${inv.stakePercent}%`));
    }
    if (inv.yearAnnounced) {
      detailBody.append(row(ctx, 'Year Announced', String(inv.yearAnnounced)));
    }
    if (inv.yearOperational) {
      detailBody.append(row(ctx, 'Year Operational', String(inv.yearOperational)));
    }
    container.append(detailCard);

    if (inv.sourceUrl) {
      const [sourceCard, sourceBody] = ctx.sectionCard('Source');
      const link = ctx.el('a', 'edp-wiki-link') as HTMLAnchorElement;
      link.href = inv.sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'View Source';
      sourceBody.append(link);
      container.append(sourceCard);
    }

    if (inv.tags && inv.tags.length > 0) {
      const [tagsCard, tagsBody] = ctx.sectionCard('Tags');
      const tags = ctx.el('div', 'edp-tags');
      for (const tag of inv.tags) tags.append(ctx.badge(tag, 'edp-tag'));
      tagsBody.append(tags);
      container.append(tagsCard);
    }

    return container;
  }
}