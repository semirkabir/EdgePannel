import { fetchArticle, type ArticleContent, type ArticleError } from '@/services/article-reader';
import type { ArticleDetailData } from '@/services/article-open';
import { sanitizeUrl } from '@/utils/sanitize';
import { clearChildren, rawHtml, replaceChildren } from '@/utils/dom-utils';
import type { EntityRenderer, EntityRenderContext } from '../types';

interface ArticleEnrichedData {
  article: ArticleDetailData;
  result: ArticleContent | ArticleError;
}

const SAFE_TAGS = new Set([
  'a', 'article', 'blockquote', 'br', 'code', 'div', 'em', 'figcaption', 'figure',
  'h1', 'h2', 'h3', 'h4', 'hr', 'img', 'li', 'ol', 'p', 'pre', 'span', 'strong',
  'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul',
]);
const SAFE_ATTRS = new Set(['alt', 'class', 'colspan', 'href', 'loading', 'rel', 'rowspan', 'src', 'target', 'title']);
const DROP_WITH_CONTENT_TAGS = new Set(['aside', 'button', 'footer', 'form', 'header', 'iframe', 'input', 'nav', 'noscript', 'script', 'style']);
const MIN_IMAGE_DIMENSION = 64;

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function buildSourceFaviconUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return '';
  }
}

function formatPublishedAt(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function sanitizeArticleHtml(html: string): DocumentFragment {
  const fragment = rawHtml(html);
  const walk = (parent: Element | DocumentFragment): void => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (!node.textContent?.trim()) parent.removeChild(node);
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (!SAFE_TAGS.has(tag)) {
        if (DROP_WITH_CONTENT_TAGS.has(tag)) {
          parent.removeChild(el);
          continue;
        }
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
        continue;
      }
      for (const attr of Array.from(el.attributes)) {
        if (!SAFE_ATTRS.has(attr.name.toLowerCase())) {
          el.removeAttribute(attr.name);
        }
      }
      if (tag === 'a') {
        const safeHref = sanitizeUrl(el.getAttribute('href') || '');
        if (!safeHref) {
          el.removeAttribute('href');
        } else {
          el.setAttribute('href', safeHref);
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        }
      }
      if (tag === 'img') {
        const safeSrc = sanitizeUrl(el.getAttribute('src') || '');
        const width = Number.parseInt(el.getAttribute('width') || '0', 10);
        const height = Number.parseInt(el.getAttribute('height') || '0', 10);
        if ((width > 0 && width < MIN_IMAGE_DIMENSION) || (height > 0 && height < MIN_IMAGE_DIMENSION)) {
          el.remove();
          continue;
        }
        if (!safeSrc) {
          el.remove();
          continue;
        }
        el.setAttribute('src', safeSrc);
        el.setAttribute('loading', 'lazy');
        (el as HTMLImageElement).referrerPolicy = 'no-referrer';
      }
      walk(el);
      if ((tag === 'p' || tag === 'div' || tag === 'span') && !el.querySelector('img') && !el.textContent?.trim()) {
        el.remove();
      }
    }
  };
  walk(fragment);
  return fragment;
}

function buildExternalLink(ctx: EntityRenderContext, article: ArticleDetailData): HTMLAnchorElement {
  const link = ctx.el('a', 'edp-article-open-original') as HTMLAnchorElement;
  link.href = article.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Open original';
  return link;
}

export class ArticleRenderer implements EntityRenderer {
  renderSkeleton(data: unknown, ctx: EntityRenderContext): HTMLElement {
    const article = data as ArticleDetailData;
    const container = ctx.el('div', 'edp-article-detail');

    const header = ctx.el('section', 'edp-header edp-header-card edp-article-header');
    const sourceRow = ctx.el('div', 'edp-article-source-row');
    const faviconUrl = buildSourceFaviconUrl(article.url);
    if (faviconUrl) {
      const favicon = ctx.el('img', 'edp-article-source-favicon') as HTMLImageElement;
      favicon.src = faviconUrl;
      favicon.alt = '';
      favicon.width = 16;
      favicon.height = 16;
      favicon.loading = 'lazy';
      favicon.onerror = () => favicon.style.display = 'none';
      sourceRow.append(favicon);
    }
    sourceRow.append(ctx.el('span', 'edp-article-source', article.source || extractDomain(article.url)));
    header.append(sourceRow);
    header.append(ctx.el('h2', 'edp-title edp-article-title', article.title));
    const meta = ctx.el('div', 'edp-article-header-meta');
    const publishedAt = formatPublishedAt(article.publishedAt);
    if (publishedAt) meta.append(ctx.el('span', 'edp-article-header-date', publishedAt));
    if (meta.childElementCount > 0) header.append(meta);
    header.append(buildExternalLink(ctx, article));
    container.append(header);

    const host = ctx.el('div', 'edp-article-host');
    host.append(ctx.makeLoading('Loading article...'));
    container.append(host);
    return container;
  }

  async enrich(data: unknown, signal: AbortSignal): Promise<ArticleEnrichedData> {
    const article = data as ArticleDetailData;
    const result = await fetchArticle(article.url);
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    return { article, result };
  }

  renderEnriched(container: HTMLElement, enrichedData: unknown, ctx: EntityRenderContext): void {
    const { article, result } = enrichedData as ArticleEnrichedData;
    const host = container.querySelector<HTMLElement>('.edp-article-host');
    if (!host) return;

    if ('error' in result) {
      const blockedMatch = result.error.match(/\b(401|403|406|429)\b/);
      const isBlocked = Boolean(blockedMatch);
      const title = isBlocked
        ? 'This site blocks external readers'
        : 'Unable to load article';
      const detail = isBlocked
        ? `The publisher requires direct access (${blockedMatch![0]}). You can read the article on their site.`
        : result.error;

      const errorWrap = ctx.el('div', 'edp-article-error');
      errorWrap.append(
        ctx.el('div', 'edp-article-error-icon', '⚠'),
        ctx.el('div', 'edp-article-error-title', title),
        ctx.el('div', 'edp-article-error-detail', detail),
        buildExternalLink(ctx, article),
      );
      replaceChildren(host, errorWrap);
      return;
    }

    const resolvedTitle = result.title.trim() || article.title;
    const resolvedSource = result.siteName?.trim() || article.source || extractDomain(article.url);

    const sourceRow = container.querySelector<HTMLElement>('.edp-article-source-row');
    const sourceEl = container.querySelector<HTMLElement>('.edp-article-source');
    if (sourceEl) sourceEl.textContent = resolvedSource;
    if (sourceRow) {
      const existingFavicon = sourceRow.querySelector<HTMLImageElement>('.edp-article-source-favicon');
      if (!existingFavicon) {
        const faviconUrl = buildSourceFaviconUrl(article.url);
        if (faviconUrl) {
          const favicon = ctx.el('img', 'edp-article-source-favicon') as HTMLImageElement;
          favicon.src = faviconUrl;
          favicon.alt = '';
          favicon.width = 16;
          favicon.height = 16;
          favicon.loading = 'lazy';
          favicon.onerror = () => favicon.style.display = 'none';
          sourceRow.insertBefore(favicon, sourceEl);
        }
      }
    }
    const titleEl = container.querySelector<HTMLElement>('.edp-title');
    if (titleEl) titleEl.textContent = resolvedTitle;
    const headerMeta = container.querySelector<HTMLElement>('.edp-article-header-meta');
    const byline = result.byline.trim();
    const publishedAt = formatPublishedAt(result.publishedTime || article.publishedAt);
    if (headerMeta) {
      clearChildren(headerMeta);
      if (byline) headerMeta.append(ctx.el('span', 'edp-article-header-credit', byline));
      if (publishedAt) headerMeta.append(ctx.el('span', 'edp-article-header-date', publishedAt));
      if (headerMeta.childElementCount === 0) headerMeta.remove();
    }

    const articleWrap = ctx.el('article', 'edp-article-reader');
    if (result.imageUrl) {
      const hero = ctx.el('div', 'edp-article-hero');
      const image = ctx.el('img', 'edp-article-hero-img') as HTMLImageElement;
      image.src = sanitizeUrl(result.imageUrl);
      image.alt = '';
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      image.onerror = () => hero.remove();
      hero.append(image);
      articleWrap.append(hero);
    }

    const content = ctx.el('div', 'edp-article-content');
    content.append(sanitizeArticleHtml(result.content));
    articleWrap.append(content);

    const footer = ctx.el('div', 'edp-article-footer');
    if (result.cached) footer.append(ctx.el('span', 'edp-article-cached', 'Cached copy'));
    footer.append(buildExternalLink(ctx, article));
    articleWrap.append(footer);

    replaceChildren(host, articleWrap);

    // Reading progress indicator — thin track on the right edge of the panel
    const scrollEl = container.closest<HTMLElement>('.edp-panel-content');
    const shell = scrollEl?.parentElement;
    if (scrollEl && shell) {
      const track = document.createElement('div');
      track.className = 'edp-article-progress-track';
      const thumb = document.createElement('div');
      thumb.className = 'edp-article-progress-thumb';
      track.append(thumb);
      shell.append(track);

      const update = (): void => {
        const { scrollTop, scrollHeight, clientHeight } = scrollEl;
        const scrollable = scrollHeight - clientHeight;
        if (scrollable <= 0) { track.style.opacity = '0'; return; }
        track.style.opacity = '1';
        const thumbH = Math.max(24, (clientHeight / scrollHeight) * clientHeight);
        const maxTop = clientHeight - thumbH;
        const top = (scrollTop / scrollable) * maxTop;
        thumb.style.height = thumbH + 'px';
        thumb.style.transform = `translateY(${top}px)`;
      };

      scrollEl.addEventListener('scroll', update, { passive: true });
      // Initial render — wait one frame for layout
      requestAnimationFrame(update);

      ctx.signal.addEventListener('abort', () => {
        scrollEl.removeEventListener('scroll', update);
        track.remove();
      }, { once: true });
    }
  }
}
