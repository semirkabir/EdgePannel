import type { MineSite, ProcessingPlant } from '@/config/commodity-geo';
import { row } from '../types';
import type { EntityRenderer, EntityRenderContext } from '../types';

const STATUS_CLASS: Record<string, string> = {
  producing: 'edp-badge edp-badge-status',
  operating: 'edp-badge edp-badge-status',
  development: 'edp-badge edp-badge-warning',
  'care-and-maintenance': 'edp-badge edp-badge-dim',
  exploration: 'edp-badge edp-badge-dim',
  planned: 'edp-badge edp-badge-dim',
  idle: 'edp-badge edp-badge-dim',
  closed: 'edp-badge edp-badge-dim',
};

const TYPE_LABELS: Record<string, string> = {
  smelter: '\u{1F3ED} Smelter',
  refinery: '\u{2697}\u{FE0F} Refinery',
  processing: '\u{1F3D7}\u{FE0F} Processing',
  separation: '\u{1F9EA} Separation',
};

const MINE_TYPE_LABELS: Record<string, string> = {
  'open-pit': 'Open Pit',
  underground: 'Underground',
  'in-situ': 'In Situ',
  both: 'Open Pit & Underground',
};

export class MineralRenderer implements EntityRenderer {
  renderSkeleton(data: unknown, ctx: EntityRenderContext): HTMLElement {
    const site = data as MineSite | ProcessingPlant;
    const isPlant = 'type' in site && (site as ProcessingPlant).type !== undefined;
    const container = ctx.el('div', 'edp-generic');

    const header = ctx.el('div', 'edp-header');
    header.append(ctx.el('h2', 'edp-title', site.name));
    header.append(ctx.el('div', 'edp-subtitle', `${site.mineral} \u00b7 ${site.country}`));

    const badgeRow = ctx.el('div', 'edp-badge-row');
    if (isPlant) {
      const plant = site as ProcessingPlant;
      badgeRow.append(ctx.badge(TYPE_LABELS[plant.type] ?? plant.type, 'edp-badge'));
    }
    badgeRow.append(ctx.badge(site.status.toUpperCase(), STATUS_CLASS[site.status] ?? 'edp-badge'));
    badgeRow.append(ctx.badge(site.mineral, 'edp-badge edp-badge-tier'));
    header.append(badgeRow);
    container.append(header);

    if (site.significance) {
      container.append(ctx.el('p', 'edp-description', site.significance));
    }

    const [detailCard, detailBody] = ctx.sectionCard('Details');
    detailBody.append(row(ctx, 'Country', site.country));
    detailBody.append(row(ctx, 'Operator', site.operator));

    if (isPlant) {
      const plant = site as ProcessingPlant;
      if (plant.capacityTpa) {
        detailBody.append(row(ctx, 'Annual Capacity', `${(plant.capacityTpa / 1000).toFixed(0)}k tonnes/yr`));
      }
      if (plant.outputCapacity) {
        detailBody.append(row(ctx, 'Output', plant.outputCapacity));
      }
      if (plant.materials && plant.materials.length > 0) {
        detailBody.append(row(ctx, 'Also Processes', plant.materials.join(', ')));
      }
    } else {
      const mine = site as MineSite;
      if (mine.productionRank) {
        detailBody.append(row(ctx, 'Ranking', mine.productionRank));
      }
      if (mine.productionCapacity) {
        detailBody.append(row(ctx, 'Capacity', mine.productionCapacity));
      }
      if (mine.annualOutput) {
        detailBody.append(row(ctx, 'Annual Output', mine.annualOutput));
      }
      if (mine.openPitOrUnderground) {
        detailBody.append(row(ctx, 'Method', MINE_TYPE_LABELS[mine.openPitOrUnderground] ?? mine.openPitOrUnderground));
      }
    }
    container.append(detailCard);

    const [locCard, locBody] = ctx.sectionCard('Location');
    locBody.append(row(ctx, 'Coordinates', `${site.lat.toFixed(4)}\u00b0, ${site.lon.toFixed(4)}\u00b0`));
    container.append(locCard);

    return container;
  }
}