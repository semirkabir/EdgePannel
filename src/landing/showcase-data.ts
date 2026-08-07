/**
 * Style showcase manifest — screenshots that ride the counter-scrolling belt
 * in the product section. These are shown purely as visual samples of the
 * interface; they are not tied to a lens or ordered in any meaningful way.
 *
 * Drop image files into `public/landing/showcase/` using the paths below. A
 * shot whose file is missing removes itself at runtime rather than rendering a
 * broken image, so the belt degrades cleanly while art is still being cut.
 */

export const SHOWCASE_SHOTS: string[] = [
  '/landing/showcase/style-01.png',
  '/landing/showcase/style-02.png',
  '/landing/showcase/style-03.png',
  '/landing/showcase/style-04.png',
  '/landing/showcase/style-05.png',
  '/landing/showcase/style-06.png',
  // Already in the repo — keeps the belt populated regardless of whether the
  // captures above have landed yet.
  '/landing/dashboard.jpg',
  '/landing/dashboard-region.jpg',
  '/landing/dashboard-brief.jpg',
];

/** Fisher-Yates on a copy — the belt is a random sample, not a ranked list. */
function shuffled(shots: string[]): string[] {
  const out = shots.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j] as string, out[i] as string];
  }
  return out;
}

/**
 * Deal the shots into counter-moving rows. Two rows keeps each image large
 * enough to read at a glance — more rows would shrink the cards to thumbnails
 * and lose the point of showing the styles at all.
 */
export function showcaseRows(rowCount = 2): string[][] {
  const rows: string[][] = Array.from({ length: rowCount }, () => []);
  shuffled(SHOWCASE_SHOTS).forEach((shot, i) => {
    (rows[i % rowCount] as string[]).push(shot);
  });
  return rows.filter((r) => r.length > 0);
}
