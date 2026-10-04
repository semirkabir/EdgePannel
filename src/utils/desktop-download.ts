/**
 * Builds the link for downloading the desktop build from the web app.
 *
 * `/api/download` resolves a platform + variant to the matching asset on the
 * latest GitHub release, and redirects to the releases page whenever it cannot
 * match one. That fallback is the safety net here: when the browser cannot tell
 * us enough to name a build with confidence we deliberately omit the platform
 * and let the user pick, rather than handing them a binary that will not run.
 */

/**
 * Variants that actually ship a desktop build — the ones with a
 * `src-tauri/tauri.*.conf.json` and a `desktop:package:*` script. `commodity`
 * and `happy` have neither, so offering them a download would only land the
 * user on a releases page with nothing for them.
 */
const VARIANTS_WITH_DESKTOP_BUILD = new Set(['full', 'tech', 'finance', 'conflicts']);

export function hasDesktopBuild(variant: string): boolean {
  return VARIANTS_WITH_DESKTOP_BUILD.has(variant);
}

let releaseAvailability: Promise<boolean> | null = null;

/**
 * Whether a published desktop release exists to download. `/api/version`
 * answers non-2xx when there is no published release with assets, so download
 * UI stays hidden (fails closed) rather than pointing at an empty or
 * inaccessible releases page. Memoised for the page lifetime.
 */
export function isDesktopReleaseAvailable(): Promise<boolean> {
  releaseAvailability ??= (async () => {
    try {
      const res = await fetch('/api/version', { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return false;
      const data = (await res.json()) as { version?: string };
      return Boolean(data.version);
    } catch {
      return false;
    }
  })();
  return releaseAvailability;
}

/** Platform ids accepted by `api/download.js`. */
export type DesktopDownloadPlatform =
  | 'windows-exe'
  | 'macos-arm64'
  | 'macos-x64'
  | 'linux-appimage'
  | 'linux-appimage-arm64';

interface UADataLike {
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string; platform?: string }>;
}

function uaData(): UADataLike | undefined {
  return (navigator as Navigator & { userAgentData?: UADataLike }).userAgentData;
}

function detectOS(): 'windows' | 'macos' | 'linux' | null {
  const platform = (uaData()?.platform || navigator.platform || '').toLowerCase();
  const ua = navigator.userAgent.toLowerCase();
  const haystack = `${platform} ${ua}`;

  // Android reports "linux" in the UA but has no desktop build, so it is
  // checked first and left unmatched.
  if (/android|iphone|ipad|ipod/.test(haystack)) return null;
  if (/win/.test(haystack)) return 'windows';
  if (/mac/.test(haystack)) return 'macos';
  if (/linux|x11/.test(haystack)) return 'linux';
  return null;
}

function isArm(architecture?: string): boolean {
  return /arm|aarch/.test((architecture || '').toLowerCase());
}

/**
 * Best guess from what is available synchronously.
 *
 * macOS is intentionally left unresolved: no synchronous browser API
 * distinguishes Apple Silicon from Intel, and the two builds are not
 * interchangeable. `refineDesktopDownloadUrl` upgrades this where it can.
 */
export function detectDesktopPlatform(): DesktopDownloadPlatform | null {
  switch (detectOS()) {
    case 'windows':
      // The .exe installer, not the .msi the in-app updater pulls — this is a
      // first-time install from the web, where the setup wizard is expected.
      return 'windows-exe';
    case 'linux':
      return 'linux-appimage';
    default:
      return null;
  }
}

export function buildDesktopDownloadUrl(variant: string, platform?: DesktopDownloadPlatform | null): string {
  const params = new URLSearchParams();
  if (platform) params.set('platform', platform);
  if (variant) params.set('variant', variant);
  const query = params.toString();
  return query ? `/api/download?${query}` : '/api/download';
}

/**
 * Ask for the CPU architecture and narrow the link if the browser answers.
 *
 * Only Chromium exposes User-Agent Client Hints, so Safari and Firefox keep the
 * synchronous guess. Resolves to null when nothing better was learned.
 */
export async function refineDesktopDownloadUrl(variant: string): Promise<string | null> {
  const data = uaData();
  if (!data?.getHighEntropyValues) return null;

  try {
    const { architecture } = await data.getHighEntropyValues(['architecture']);
    if (!architecture) return null;

    const os = detectOS();
    if (os === 'macos') {
      return buildDesktopDownloadUrl(variant, isArm(architecture) ? 'macos-arm64' : 'macos-x64');
    }
    if (os === 'linux' && isArm(architecture)) {
      return buildDesktopDownloadUrl(variant, 'linux-appimage-arm64');
    }
  } catch {
    // Hints can be refused outright; the synchronous guess still stands.
  }
  return null;
}
