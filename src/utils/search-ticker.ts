export const SEARCH_TICKER_PHRASES = [
  'Search',
  "Trump's market positions?",
  'Polymarket: Gaza ceasefire odds?',
  'Which politicians hold Nvidia?',
  'Portfolio geopolitical risk score',
  'Taiwan Strait escalation risk?',
  'Iran nuclear deal signals',
  'Polymarket: Fed rate cut odds?',
  'Energy infrastructure threats',
  'Senate 2025 race predictions',
  'Who funds which campaigns?',
  'Optimize for conflict exposure',
  'Red Sea shipping disruptions',
  'Polymarket: BTC above 100k?',
  'Pelosi portfolio tracker',
] as const;

const FLIP_OUT_MS = 180;
const FLIP_IN_MS = 250;

/** Cycle hint phrases with the same flip animation as the header search button. */
export function startSearchTicker(
  el: HTMLElement | null,
  options?: { intervalMs?: number; initialPhrase?: string },
): () => void {
  if (!el) return () => {};

  const intervalMs = options?.intervalMs ?? 3200;
  const phrases = SEARCH_TICKER_PHRASES;
  let phraseIdx = 0;
  if (options?.initialPhrase) {
    const found = phrases.findIndex((p) => p === options.initialPhrase);
    if (found >= 0) phraseIdx = found;
  }

  el.textContent = phrases[phraseIdx] ?? 'Search';

  const intervalId = setInterval(() => {
    phraseIdx = (phraseIdx + 1) % phrases.length;
    el.classList.add('ticker-flip-out');
    setTimeout(() => {
      el.textContent = phrases[phraseIdx] ?? 'Search';
      el.classList.remove('ticker-flip-out');
      void el.offsetWidth;
      el.classList.add('ticker-flip-in');
      setTimeout(() => el.classList.remove('ticker-flip-in'), FLIP_IN_MS);
    }, FLIP_OUT_MS);
  }, intervalMs);

  return () => clearInterval(intervalId);
}
