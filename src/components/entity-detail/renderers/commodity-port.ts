import type { CommodityPort } from '@/config/commodity-geo';
import { row } from '../types';
import type { EntityRenderer, EntityRenderContext } from '../types';

export class CommodityPortRenderer implements EntityRenderer {
  renderSkeleton(data: unknown, ctx: EntityRenderContext): HTMLElement {
    const port = data as CommodityPort;
    const container = ctx.el('div', 'edp-generic');

    const header = ctx.el('div', 'edp-header');
    header.append(ctx.el('h2', 'edp-title', `\u{2693} ${port.name}`));
    header.append(ctx.el('div', 'edp-subtitle', `${port.city}, ${port.country}`));

    const badgeRow = ctx.el('div', 'edp-badge-row');
    badgeRow.append(ctx.badge('COMMODITY PORT', 'edp-badge'));
    header.append(badgeRow);
    container.append(header);

    if (port.significance) {
      container.append(ctx.el('p', 'edp-description', port.significance));
    }

    const [detailCard, detailBody] = ctx.sectionCard('Port Details');
    detailBody.append(row(ctx, 'Country', port.country));
    detailBody.append(row(ctx, 'City', port.city));
    if (port.annualThroughput) {
      detailBody.append(row(ctx, 'Annual Throughput', port.annualThroughput));
    }
    if (port.annualVolumeMt) {
      detailBody.append(row(ctx, 'Annual Volume', `${port.annualVolumeMt} Mt/yr`));
    }
    container.append(detailCard);

    if (port.commodities && port.commodities.length > 0) {
      const [commCard, commBody] = ctx.sectionCard('Commodities');
      const tags = ctx.el('div', 'edp-tags');
      for (const c of port.commodities) tags.append(ctx.badge(c, 'edp-tag'));
      commBody.append(tags);
      container.append(commCard);
    }

    const [locCard, locBody] = ctx.sectionCard('Location');
    locBody.append(row(ctx, 'Coordinates', `${port.lat.toFixed(4)}\u00b0, ${port.lon.toFixed(4)}\u00b0`));
    container.append(locCard);

    return container;
  }
}