/**
 * /downloads — desktop build links plus mobile status.
 *
 * The markup ships every link already pointing at the full edition, so the page
 * works with JS disabled. This module only enhances it: detect the visitor's
 * platform, swap the edition on every link at once, and show the live release
 * version from /api/version (the same endpoint the in-app updater polls).
 */

type PlatformKey =
  | 'macos-arm64'
  | 'windows-exe'
  | 'windows-msi'
  | 'linux-appimage'
  | 'linux-appimage-arm64';

/** Human label for the auto-detected primary button. */
const PLATFORM_LABELS: Record<PlatformKey, string> = {
  'macos-arm64': 'macOS · Apple silicon',
  'windows-exe': 'Windows · installer',
  'windows-msi': 'Windows · MSI',
  'linux-appimage': 'Linux · x86_64',
  'linux-appimage-arm64': 'Linux · ARM64',
};

interface Detected {
  platform: PlatformKey | null;
  /** Card to highlight even when the exact build is ambiguous. */
  os: 'macos' | 'windows' | 'linux' | 'mobile' | null;
}

/**
 * Best-effort platform sniffing. There is only one Mac build (Apple silicon),
 * so every Mac resolves to it — an Intel Mac has nothing else to be offered.
 */
function detectPlatform(): Detected {
  const ua = navigator.userAgent;
  const uaPlatform = (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ?? '';
  const hay = `${ua} ${uaPlatform}`.toLowerCase();

  if (/iphone|ipad|ipod|android/.test(hay)) return { platform: null, os: 'mobile' };
  if (/win/.test(hay)) return { platform: 'windows-exe', os: 'windows' };
  if (/mac/.test(hay)) {
    // maxTouchPoints > 1 on a "Mac" is an iPad asking for the desktop site.
    if (navigator.maxTouchPoints > 1) return { platform: null, os: 'mobile' };
    return { platform: 'macos-arm64', os: 'macos' };
  }
  if (/linux|x11/.test(hay)) {
    return {
      platform: /aarch64|arm64/.test(hay) ? 'linux-appimage-arm64' : 'linux-appimage',
      os: 'linux',
    };
  }
  return { platform: null, os: null };
}

function downloadHref(platform: string, edition: string): string {
  return `/api/download?platform=${platform}&variant=${edition}`;
}

export function initDownloads(): void {
  const root = document.getElementById('downloads');
  if (!root) return;

  // --- Edition switch: repoint every download link in one go ---
  const editionBar = root.querySelector<HTMLElement>('[data-slot="editions"]');
  const applyEdition = (edition: string): void => {
    root.querySelectorAll<HTMLAnchorElement>('a[data-platform]').forEach((a) => {
      a.href = downloadHref(a.dataset.platform as string, edition);
    });
    editionBar?.querySelectorAll<HTMLButtonElement>('[data-edition]').forEach((b) => {
      b.classList.toggle('lp-chip-on', b.dataset.edition === edition);
      b.setAttribute('aria-pressed', String(b.dataset.edition === edition));
    });
  };
  editionBar?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-edition]');
    if (btn?.dataset.edition) applyEdition(btn.dataset.edition);
  });

  // --- Highlight the visitor's platform ---
  const { platform, os } = detectPlatform();
  if (os) {
    const card = root.querySelector<HTMLElement>(`[data-os="${os}"]`);
    card?.classList.add('lp-dl-detected');
    const tag = card?.querySelector<HTMLElement>('[data-slot="yours"]');
    if (tag) tag.hidden = false;
  }
  const hero = root.querySelector<HTMLAnchorElement>('[data-slot="primary-cta"]');
  if (hero && platform) {
    hero.href = downloadHref(platform, 'full');
    hero.dataset.platform = platform;
    const label = hero.querySelector<HTMLElement>('[data-slot="primary-label"]');
    if (label) label.textContent = `Download for ${PLATFORM_LABELS[platform]}`;
    hero.hidden = false;
  }

  // --- Live release version (fails soft: the line just stays hidden) ---
  const versionSlot = root.querySelector<HTMLElement>('[data-slot="version"]');
  if (versionSlot) {
    void (async () => {
      try {
        const res = await fetch('/api/version', { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string; url?: string };
        if (!data.version) return;
        const link = versionSlot.querySelector<HTMLAnchorElement>('[data-slot="version-link"]');
        if (link) {
          link.textContent = `Version ${data.version}`;
          if (data.url) link.href = data.url;
        }
        versionSlot.hidden = false;
      } catch {
        /* offline or rate-limited — the static release-notes link is enough */
      }
    })();
  }
}
