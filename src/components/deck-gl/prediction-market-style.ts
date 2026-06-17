export type PolymarketVolumeScale = { minLog: number; maxLog: number };

export function marketplaceHexColor(
  hex: string | undefined,
  alpha: number,
  fallback: [number, number, number, number],
): [number, number, number, number] {
  if (!hex) return fallback;
  const normalized = hex.trim().replace('#', '');
  const short = normalized.length === 3;
  const long = normalized.length === 6;
  if (!short && !long) return fallback;
  const expanded = short
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;
  const int = Number.parseInt(expanded, 16);
  if (!Number.isFinite(int)) return fallback;
  return [
    (int >> 16) & 255,
    (int >> 8) & 255,
    int & 255,
    Math.round(Math.max(0, Math.min(1, alpha)) * 255),
  ];
}

export function getPolymarketColor(yesPrice: number, volumeHeat = 0): [number, number, number, number] {
  const pct = Math.max(0, Math.min(100, Number.isFinite(yesPrice) ? yesPrice : 50));
  const conviction = Math.abs(pct - 50) / 50;
  const br = 125 + conviction * 40;
  const bg = 190 + conviction * 28;
  const bb = 255;
  const wr = 200;
  const wg = 210;
  const wb = 140;
  const r = br + (wr - br) * volumeHeat;
  const g = bg + (wg - bg) * volumeHeat;
  const b = bb + (wb - bb) * volumeHeat;
  return [
    Math.round(r),
    Math.round(g),
    Math.round(b),
    230,
  ];
}

export function getPolymarketColorWithAlpha(
  yesPrice: number,
  alpha: number,
  volumeHeat = 0,
): [number, number, number, number] {
  const [r, g, b] = getPolymarketColor(yesPrice, volumeHeat);
  return [r, g, b, alpha];
}

export function getPolymarketVolumeScale(markets: Array<{ volume?: number }>): PolymarketVolumeScale {
  const logs = markets
    .map((market) => Math.log10(Math.max(1, market.volume ?? 0)))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (logs.length === 0) return { minLog: 0, maxLog: 1 };

  const minLog = logs[Math.floor((logs.length - 1) * 0.10)] ?? logs[0] ?? 0;
  const maxLog = logs[Math.floor((logs.length - 1) * 0.95)] ?? logs[logs.length - 1] ?? 1;
  return maxLog > minLog ? { minLog, maxLog } : { minLog, maxLog: minLog + 1 };
}

export function getPolymarketRadiusMeters(volume: number | undefined, scale: PolymarketVolumeScale): number {
  const logVolume = Math.log10(Math.max(1, volume ?? 0));
  const normalized = Math.max(0, Math.min(1, (logVolume - scale.minLog) / (scale.maxLog - scale.minLog)));
  return 12_000 + normalized * 60_000;
}

export function formatPolymarketVolume(volume?: number): string {
  if (!volume) return 'Volume unavailable';
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M volume`;
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(0)}K volume`;
  return `$${volume.toFixed(0)} volume`;
}
