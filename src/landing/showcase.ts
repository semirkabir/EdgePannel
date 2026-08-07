/**
 * Style showcase — a counter-scrolling belt of interface screenshots, built on
 * the same two-copy marquee trick as the data-source ticker: each row holds
 * two identical strips and slides by exactly -50%, so the second copy takes
 * over the instant the first leaves.
 *
 * Odd rows run right-to-left, even rows left-to-right, at different periods,
 * so the rows never lock into one moving block.
 */

import { showcaseRows } from './showcase-data';

/** Per-row drift, seconds. Deliberately mismatched so rows stay out of sync. */
const ROW_DURATIONS = [88, 112];

/** A strip narrower than the viewport would show a gap mid-loop, so short rows
 *  repeat their shots until there is comfortably more than one screen of them. */
const MIN_CARDS_PER_STRIP = 6;

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string
  );
}

/** Decorative: the belt shows what the interface looks like, and every shot
 *  carries the same meaning, so naming them individually only adds noise for
 *  screen readers. The belt itself is labelled on the container. */
function card(src: string): string {
  const safe = escapeHtml(src);
  return (
    `<li class="lp-shot" data-src="${safe}">`
    + `<img src="${safe}" alt="" loading="lazy" decoding="async" />`
    + `</li>`
  );
}

/** Repeat the row's shots until a strip is wide enough to loop without a gap. */
function fill(shots: string[]): string[] {
  if (shots.length === 0) return shots;
  const out: string[] = [];
  while (out.length < MIN_CARDS_PER_STRIP) out.push(...shots);
  return out;
}

/**
 * The -50% loop only reads as seamless while a single strip is at least as wide
 * as the belt; a shorter strip leaves visible dead space at the wrap. Removing
 * failed shots can push a row under that width, so top each strip back up by
 * cloning the cards it still has.
 */
function refillRow(row: HTMLElement, beltWidth: number): void {
  const strips = row.querySelectorAll<HTMLElement>('.lp-shot-strip');
  const first = strips[0];
  if (!first) return;

  const seed = Array.from(first.children) as HTMLElement[];
  if (seed.length === 0) {
    row.remove();
    return;
  }
  // Cloning from a growing strip doubles the width each pass, so this
  // terminates in log2 steps rather than one card at a time.
  let guard = 0;
  while (first.scrollWidth < beltWidth && guard++ < 12) {
    seed.forEach((card) => first.appendChild(card.cloneNode(true)));
  }
  // The second strip is a pure mirror — rebuild it from the first so both
  // copies stay byte-identical.
  const second = strips[1];
  if (second) second.innerHTML = first.innerHTML;
}

/**
 * A shot whose file has not landed yet must not ship a broken-image icon. Both
 * copies of a failed card are pulled together, then the row is topped back up
 * so the loop stays seamless.
 */
function dropMissingShots(belt: HTMLElement): void {
  belt.querySelectorAll<HTMLImageElement>('.lp-shot img').forEach((img) => {
    img.addEventListener('error', () => {
      const src = img.closest<HTMLElement>('.lp-shot')?.dataset.src;
      if (!src) return;
      belt
        .querySelectorAll(`.lp-shot[data-src="${CSS.escape(src)}"]`)
        .forEach((el) => el.remove());
      // Re-measure on the next frame, once the removals have reflowed.
      requestAnimationFrame(() => {
        const width = belt.clientWidth;
        belt
          .querySelectorAll<HTMLElement>('.lp-shot-row')
          .forEach((row) => refillRow(row, width));
      });
    });
  });
}

export function initShowcase(): void {
  const belt = document.querySelector<HTMLElement>('[data-slot="style-showcase"]');
  if (!belt) return;

  belt.innerHTML = showcaseRows()
    .map((shots, i) => {
      const cards = fill(shots).map(card).join('');
      const dur = ROW_DURATIONS[i % ROW_DURATIONS.length] as number;
      return (
        `<div class="lp-shot-row" data-dir="${i % 2 ? 'rtl' : 'ltr'}" style="--shot-dur:${dur}s">`
        + `<ul class="lp-shot-strip">${cards}</ul>`
        + `<ul class="lp-shot-strip" aria-hidden="true">${cards}</ul>`
        + `</div>`
      );
    })
    .join('');

  dropMissingShots(belt);
}
