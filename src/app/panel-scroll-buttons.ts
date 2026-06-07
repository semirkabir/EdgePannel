type ScrollBounds = { start: number; end: number };

export function createPanelScrollButtons(
  container: HTMLElement,
  getTarget: () => HTMLElement,
  getScrollBounds?: (target: HTMLElement) => ScrollBounds,
): () => void {
  const topBtn = document.createElement('button');
  topBtn.className = 'panel-scroll-btn panel-scroll-btn--top';
  topBtn.setAttribute('aria-label', 'Scroll to top');
  topBtn.appendChild(makeChevronSvg('up'));

  const bottomBtn = document.createElement('button');
  bottomBtn.className = 'panel-scroll-btn panel-scroll-btn--bottom';
  bottomBtn.setAttribute('aria-label', 'Scroll to bottom');
  bottomBtn.appendChild(makeChevronSvg('down'));

  document.body.appendChild(topBtn);
  document.body.appendChild(bottomBtn);

  let currentTarget = getTarget();

  const getBounds = (): ScrollBounds => getScrollBounds?.(currentTarget) ?? {
    start: 0,
    end: Math.max(0, currentTarget.scrollHeight - currentTarget.clientHeight),
  };
  const hideBtns = (): void => {
    topBtn.classList.remove('visible');
    bottomBtn.classList.remove('visible');
  };
  const positionBtns = (): void => {
    const rect = container.getBoundingClientRect();
    const targetRect = currentTarget.getBoundingClientRect();
    const visibleTop = Math.max(rect.top, targetRect.top, 0);
    const visibleBottom = Math.min(rect.bottom, targetRect.bottom, window.innerHeight);
    const btnLeft = rect.left + rect.width / 2;
    topBtn.style.left = `${btnLeft}px`;
    topBtn.style.top = `${visibleTop + 12}px`;
    bottomBtn.style.left = `${btnLeft}px`;
    bottomBtn.style.top = `${visibleBottom - 44}px`;
  };
  const updateVisibility = (): void => {
    if (!container.isConnected || container.offsetParent === null) {
      hideBtns();
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = currentTarget;
    const { start, end } = getBounds();
    const scrollable = scrollHeight > clientHeight + 10 && end > start + 10;
    const scrolled = scrollTop > start + 60;
    const atBottom = scrollTop >= end - 2;
    positionBtns();
    topBtn.classList.toggle('visible', scrollable && scrolled);
    bottomBtn.classList.toggle('visible', scrollable && !atBottom);
  };

  let observedTarget = currentTarget;
  const ro = new ResizeObserver(() => {
    attachToTarget();
    positionBtns();
  });
  const attachToTarget = (): void => {
    const next = getTarget();
    if (next !== currentTarget) {
      currentTarget.removeEventListener('scroll', updateVisibility);
      currentTarget = next;
      ro.unobserve(observedTarget);
      observedTarget = currentTarget;
      ro.observe(observedTarget);
      currentTarget.addEventListener('scroll', updateVisibility, { passive: true });
    }
    updateVisibility();
  };

  currentTarget.addEventListener('scroll', updateVisibility, { passive: true });
  ro.observe(container);
  ro.observe(observedTarget);

  const mo = new MutationObserver(() => {
    attachToTarget();
    updateVisibility();
  });
  mo.observe(container, { childList: true, subtree: true });
  const mainContent = document.querySelector('.main-content');
  if (mainContent) mo.observe(mainContent, { attributes: true, attributeFilter: ['class'] });

  const onWinResize = () => {
    attachToTarget();
    updateVisibility();
  };
  window.addEventListener('resize', onWinResize, { passive: true });

  updateVisibility();

  topBtn.addEventListener('click', () => {
    attachToTarget();
    currentTarget.scrollTo({ top: getBounds().start, behavior: 'smooth' });
  });
  bottomBtn.addEventListener('click', () => {
    attachToTarget();
    currentTarget.scrollTo({ top: getBounds().end, behavior: 'smooth' });
  });

  return () => {
    currentTarget.removeEventListener('scroll', updateVisibility);
    ro.disconnect();
    mo.disconnect();
    window.removeEventListener('resize', onWinResize);
    topBtn.remove();
    bottomBtn.remove();
  };
}

function makeChevronSvg(direction: 'up' | 'down'): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  poly.setAttribute('points', direction === 'up' ? '18 15 12 9 6 15' : '6 9 12 15 18 9');
  svg.appendChild(poly);
  return svg;
}
