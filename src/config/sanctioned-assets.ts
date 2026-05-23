import type { SanctionedAsset } from '@/types';

export const SANCTIONED_ASSETS: SanctionedAsset[] = [];

let generatedSanctionedAssetsPromise: Promise<number> | null = null;

function isSanctionedAsset(value: unknown): value is SanctionedAsset {
  if (!value || typeof value !== 'object') return false;
  const asset = value as Partial<SanctionedAsset>;
  return (
    typeof asset.id === 'string' &&
    typeof asset.name === 'string' &&
    typeof asset.lat === 'number' &&
    typeof asset.lon === 'number' &&
    typeof asset.type === 'string' &&
    typeof asset.sanctionCountry === 'string' &&
    typeof asset.program === 'string' &&
    typeof asset.description === 'string'
  );
}

export function hydrateGeneratedSanctionedAssets(): Promise<number> {
  if (generatedSanctionedAssetsPromise) return generatedSanctionedAssetsPromise;

  generatedSanctionedAssetsPromise = fetch('/data/sanctions.generated.json')
    .then(async (response) => {
      if (!response.ok) throw new Error(`Sanctions asset dataset HTTP ${response.status}`);
      return response.json() as Promise<unknown>;
    })
    .then((data) => {
      if (!Array.isArray(data)) throw new Error('Sanctions asset dataset is not an array');
      const existingIds = new Set(SANCTIONED_ASSETS.map((asset) => asset.id));
      let added = 0;
      for (const asset of data) {
        if (!isSanctionedAsset(asset) || existingIds.has(asset.id)) continue;
        SANCTIONED_ASSETS.push(asset);
        existingIds.add(asset.id);
        added++;
      }
      return added;
    })
    .catch((error) => {
      generatedSanctionedAssetsPromise = null;
      console.warn('[Sanctions] Failed to load generated sanctioned asset dataset:', error);
      return 0;
    });

  return generatedSanctionedAssetsPromise;
}
