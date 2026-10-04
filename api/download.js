// Non-sebuf: returns XML/HTML, stays as standalone Vercel function
export const config = { runtime: 'edge' };

const RELEASES_REPO = 'semirkabir/EdgePannel';
const RELEASES_URL = `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`;
const RELEASES_LIST_URL = `https://api.github.com/repos/${RELEASES_REPO}/releases?per_page=30`;
// Fallback when no published asset matches. Our own downloads page (not a
// GitHub releases page) — the repo is private, so GitHub links 404 publicly.
const RELEASES_PAGE = 'https://edgepannel.com/downloads';

const PLATFORM_PATTERNS = {
  'windows-exe': (name) => name.endsWith('_x64-setup.exe'),
  'windows-msi': (name) => name.endsWith('_x64_en-US.msi'),
  'macos-arm64': (name) => name.endsWith('_aarch64.dmg'),
  'macos-x64': (name) => name.endsWith('_x64.dmg') && !name.includes('setup'),
  'linux-appimage': (name) => name.endsWith('_amd64.AppImage'),
  'linux-appimage-arm64': (name) => name.endsWith('_aarch64.AppImage'),
};

// Asset names come from each tauri.*.conf.json productName. 'worldmonitor' is
// kept so links still resolve against releases published before the EdgePannel
// rename.
const VARIANT_IDENTIFIERS = {
  full: ['edgepannel', 'worldmonitor'],
  world: ['edgepannel', 'worldmonitor'],
  tech: ['techmonitor'],
  finance: ['financemonitor'],
  conflicts: ['conflictsmonitor'],
};

// Non-default editions publish to their own tag (v1.2.3-tech), which is rarely
// the repo's "latest" release — so they are resolved from the release list.
const VARIANT_TAG_SUFFIX = {
  tech: '-tech',
  finance: '-finance',
  conflicts: '-conflicts',
};

function canonicalAssetName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function findAssetForVariant(assets, variant, platformMatcher) {
  const identifiers = VARIANT_IDENTIFIERS[variant] ?? null;
  if (!identifiers) return null;

  return assets.find((asset) => {
    const assetName = String(asset?.name || '');
    const normalizedAssetName = canonicalAssetName(assetName);
    const hasVariantIdentifier = identifiers.some((identifier) =>
      normalizedAssetName.includes(identifier)
    );
    return hasVariantIdentifier && platformMatcher(assetName);
  }) ?? null;
}

const GITHUB_HEADERS = {
  'Accept': 'application/vnd.github+json',
  'User-Agent': 'EdgePannel-Download-Redirect',
};

/** Newest release carrying this variant's tag suffix, or null. */
async function fetchVariantRelease(suffix) {
  const res = await fetch(RELEASES_LIST_URL, { headers: GITHUB_HEADERS });
  if (!res.ok) return null;
  const releases = await res.json();
  if (!Array.isArray(releases)) return null;
  // GitHub returns newest first; skip drafts so an in-progress build is never served.
  return releases.find((r) => !r?.draft && String(r?.tag_name || '').endsWith(suffix)) ?? null;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const platform = url.searchParams.get('platform');
  const variant = (url.searchParams.get('variant') || '').toLowerCase();

  if (!platform || !PLATFORM_PATTERNS[platform]) {
    return Response.redirect(RELEASES_PAGE, 302);
  }

  try {
    const suffix = VARIANT_TAG_SUFFIX[variant];
    const release = suffix
      ? await fetchVariantRelease(suffix)
      : await (async () => {
          const res = await fetch(RELEASES_URL, { headers: GITHUB_HEADERS });
          return res.ok ? res.json() : null;
        })();

    if (!release) {
      return Response.redirect(RELEASES_PAGE, 302);
    }

    const matcher = PLATFORM_PATTERNS[platform];
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const asset = variant
      ? findAssetForVariant(assets, variant, matcher)
      : assets.find((a) => matcher(String(a?.name || '')));

    if (!asset) {
      return Response.redirect(RELEASES_PAGE, 302);
    }

    return new Response(null, {
      status: 302,
      headers: {
        'Location': asset.browser_download_url,
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60, stale-if-error=600',
      },
    });
  } catch {
    return Response.redirect(RELEASES_PAGE, 302);
  }
}
