const FALLBACK_SEARCH_TICKER_PHRASES = [
  'Search dashboard',
  'Search live news',
  'Search markets',
  'Search predictions',
  'Search countries',
  'Search layers',
] as const;

const FLIP_OUT_MS = 180;
const FLIP_IN_MS = 250;
const MAX_PHRASES = 80;

export type SearchTickerPhraseProvider = () => readonly string[];

function normalizePhrase(phrase: string): string {
  return phrase.replace(/\s+/g, ' ').trim();
}

function getPhrases(provider?: SearchTickerPhraseProvider): string[] {
  const phrases = provider?.() ?? [];
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const raw of phrases) {
    const phrase = normalizePhrase(raw);
    if (phrase.length < 2) continue;
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(phrase);
    if (deduped.length >= MAX_PHRASES) break;
  }

  return deduped.length > 0 ? deduped : [...FALLBACK_SEARCH_TICKER_PHRASES];
}

/** Cycle hint phrases with the same flip animation as the header search button. */
export function startSearchTicker(
  el: HTMLElement | null,
  options?: {
    intervalMs?: number;
    initialPhrase?: string;
    getPhrases?: SearchTickerPhraseProvider;
  },
): () => void {
  if (!el) return () => {};

  const intervalMs = options?.intervalMs ?? 3200;
  let phrases = getPhrases(options?.getPhrases);
  let phraseIdx = 0;
  if (options?.initialPhrase) {
    const found = phrases.findIndex((p) => p === options.initialPhrase);
    if (found >= 0) phraseIdx = found;
  }

  el.textContent = phrases[phraseIdx] ?? 'Search';

  const intervalId = setInterval(() => {
    phrases = getPhrases(options?.getPhrases);
    if (phraseIdx >= phrases.length) phraseIdx = 0;
    phraseIdx = (phraseIdx + 1) % phrases.length;
    el.classList.add('ticker-flip-out');
    setTimeout(() => {
      phrases = getPhrases(options?.getPhrases);
      if (phraseIdx >= phrases.length) phraseIdx = 0;
      el.textContent = phrases[phraseIdx] ?? 'Search';
      el.classList.remove('ticker-flip-out');
      void el.offsetWidth;
      el.classList.add('ticker-flip-in');
      setTimeout(() => el.classList.remove('ticker-flip-in'), FLIP_IN_MS);
    }, FLIP_OUT_MS);
  }, intervalMs);

  return () => clearInterval(intervalId);
}
