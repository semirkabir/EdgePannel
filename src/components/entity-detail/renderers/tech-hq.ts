import type { TechHQ } from '@/config/tech-geo';
import type { MapTechHQCluster } from '@/types';
import { row } from '../types';
import type { EntityRenderer, EntityRenderContext } from '../types';

const TYPE_LABELS: Record<TechHQ['type'], string> = {
  faang: 'Big Tech',
  unicorn: 'Unicorn',
  public: 'Public Company',
};

function badgeClass(type: TechHQ['type']): string {
  if (type === 'faang') return 'edp-badge edp-badge-severity';
  if (type === 'unicorn') return 'edp-badge edp-badge-tier';
  return 'edp-badge';
}

function companyMeta(item: TechHQ): string {
  return [TYPE_LABELS[item.type], item.marketCap, item.employees != null ? `${item.employees.toLocaleString()} employees` : null]
    .filter(Boolean)
    .join(' - ');
}

function renderTechHQProfile(hq: TechHQ, ctx: EntityRenderContext): HTMLElement {
  const container = ctx.el('div', 'edp-generic');

  const header = ctx.el('div', 'edp-header');
  header.append(ctx.el('h2', 'edp-title', hq.company));
  header.append(ctx.el('div', 'edp-subtitle', `${hq.city}, ${hq.country}`));

  const badgeRow = ctx.el('div', 'edp-badge-row');
  badgeRow.append(ctx.badge(TYPE_LABELS[hq.type].toUpperCase(), badgeClass(hq.type)));
  header.append(badgeRow);
  container.append(header);

  const [card, body] = ctx.sectionCard('Details');
  body.append(row(ctx, 'City', hq.city));
  body.append(row(ctx, 'Country', hq.country));
  body.append(row(ctx, 'Category', TYPE_LABELS[hq.type]));
  if (hq.employees != null) body.append(row(ctx, 'Employees', hq.employees.toLocaleString()));
  if (hq.marketCap != null) body.append(row(ctx, 'Market Cap', hq.marketCap));
  body.append(row(ctx, 'Coordinates', `${hq.lat.toFixed(4)}\u00b0, ${hq.lon.toFixed(4)}\u00b0`));
  container.append(card);

  return container;
}

function buildCompanyListItem(item: TechHQ, ctx: EntityRenderContext): HTMLElement {
  const button = ctx.el('button', `edp-tech-hq-company edp-tech-hq-company-${item.type}`) as HTMLButtonElement;
  button.type = 'button';
  button.append(ctx.el('span', 'edp-tech-hq-company-name', item.company));
  button.append(ctx.el('span', 'edp-tech-hq-company-meta', companyMeta(item) || `${item.city}, ${item.country}`));
  button.addEventListener('click', () => {
    ctx.navigate(renderTechHQProfile(item, ctx));
  });
  return button;
}

export class TechHQRenderer implements EntityRenderer {
  renderSkeleton(data: unknown, ctx: EntityRenderContext): HTMLElement {
    return renderTechHQProfile(data as TechHQ, ctx);
  }
}

export class TechHQClusterRenderer implements EntityRenderer {
  renderSkeleton(data: unknown, ctx: EntityRenderContext): HTMLElement {
    const cluster = data as MapTechHQCluster;
    const totalCount = cluster.count ?? cluster.items.length;
    const faangCount = cluster.faangCount ?? cluster.items.filter((item) => item.type === 'faang').length;
    const unicornCount = cluster.unicornCount ?? cluster.items.filter((item) => item.type === 'unicorn').length;
    const publicCount = cluster.publicCount ?? cluster.items.filter((item) => item.type === 'public').length;
    const sortedItems = [...cluster.items].sort((a, b) => {
      const order = { faang: 0, unicorn: 1, public: 2 };
      return (order[a.type] ?? 3) - (order[b.type] ?? 3) || a.company.localeCompare(b.company);
    });
    const primaryType = cluster.primaryType ?? sortedItems[0]?.type ?? 'public';

    const container = ctx.el('div', 'edp-generic');

    const header = ctx.el('div', 'edp-header');
    header.append(ctx.el('h2', 'edp-title', cluster.city));
    header.append(ctx.el('div', 'edp-subtitle', `${cluster.city}, ${cluster.country}`));

    const badgeRow = ctx.el('div', 'edp-badge-row');
    badgeRow.append(ctx.badge(`${totalCount} COMPANIES`, 'edp-badge'));
    badgeRow.append(ctx.badge(TYPE_LABELS[primaryType].toUpperCase(), badgeClass(primaryType)));
    header.append(badgeRow);
    container.append(header);

    const summary = ctx.el(
      'p',
      'edp-description',
      `${cluster.city} has ${totalCount} mapped tech HQs here, including ${faangCount} big tech, ${unicornCount} unicorn, and ${publicCount} public company entries.`,
    );
    container.append(summary);

    const [detailsCard, detailsBody] = ctx.sectionCard('Details');
    detailsBody.append(row(ctx, 'City', cluster.city));
    detailsBody.append(row(ctx, 'Country', cluster.country));
    detailsBody.append(row(ctx, 'Company Count', String(totalCount)));
    detailsBody.append(row(ctx, 'Big Tech Count', String(faangCount)));
    detailsBody.append(row(ctx, 'Unicorn Count', String(unicornCount)));
    detailsBody.append(row(ctx, 'Public Count', String(publicCount)));
    if (cluster.sampled != null) detailsBody.append(row(ctx, 'Sampled', cluster.sampled ? 'Yes' : 'No'));
    if (Number.isFinite(cluster.lat) && Number.isFinite(cluster.lon)) {
      detailsBody.append(row(ctx, 'Coordinates', `${cluster.lat.toFixed(4)}\u00b0, ${cluster.lon.toFixed(4)}\u00b0`));
    }
    container.append(detailsCard);

    if (sortedItems.length > 0) {
      const [companiesCard, companiesBody] = ctx.sectionCard('Companies');
      companiesBody.classList.add('edp-tech-hq-company-list');
      for (const item of sortedItems) {
        companiesBody.append(buildCompanyListItem(item, ctx));
      }
      container.append(companiesCard);
    }

    return container;
  }
}
