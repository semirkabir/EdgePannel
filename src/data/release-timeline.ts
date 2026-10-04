import CHANGELOG_RAW from '../../CHANGELOG.md?raw';

export interface ReleaseTimelineEntry {
  version: string;
  date: string;
  title: string;
  status?: 'current' | 'released';
  summary: string;
  highlights: string[];
}

export const RELEASE_AUTHOR = 'Semir Kabir';
export const RELEASE_SOURCE_URL = 'https://edgepannel.com/downloads';

/* ── Changelog parser ─────────────────────────────────────────────── */

function parseChangelogEntries(raw: string): ReleaseTimelineEntry[] {
  const entries: ReleaseTimelineEntry[] = [];

  // Each section starts with "## [" — split there
  const sections = raw.split(/\n(?=## \[)/);

  for (const section of sections) {
    if (!section.startsWith('## [')) continue;

    // e.g. "## [2.5.25] - 2026-03-04" or "## [Unreleased]"
    const versionLineMatch = section.match(/^## \[([^\]]+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?/);
    if (!versionLineMatch) continue;

    const version = versionLineMatch[1]!.trim();
    const date = versionLineMatch[2] ?? 'In progress';
    const isUnreleased = version === 'Unreleased';

    // Collect subsections: ### Name\ncontent
    const subsectionRe = /### ([^\n]+)\n([\s\S]*?)(?=\n### |\n## |\n---|\s*$)/g;
    const subsections = new Map<string, { name: string; content: string }>();
    let m: RegExpExecArray | null;
    while ((m = subsectionRe.exec(section)) !== null) {
      const key = m[1]!.trim().toLowerCase();
      subsections.set(key, { name: m[1]!.trim(), content: m[2]!.trim() });
    }

    // Pick the richest subsection
    let picked: { name: string; content: string } | null = null;
    for (const preferred of ['highlights', 'changed', 'added', 'architecture', 'cleanup']) {
      for (const [k, v] of subsections) {
        if (k.includes(preferred)) { picked = v; break; }
      }
      if (picked) break;
    }
    if (!picked && subsections.size > 0) {
      picked = subsections.values().next().value as { name: string; content: string };
    }

    let title = '';
    let summary = '';
    const highlights: string[] = [];

    if (picked) {
      // Derive title from section header
      const rawName = picked.name;
      // "Architecture — Modular Refactoring" → "Modular Refactoring"
      title = rawName.includes(' — ') ? rawName.split(' — ').slice(1).join(' — ').trim() : rawName;

      // Extract bullet points
      const bulletRe = /^- ([^\n]+)/gm;
      let bm: RegExpExecArray | null;
      while ((bm = bulletRe.exec(picked.content)) !== null && highlights.length < 3) {
        const raw = bm[1]!
          .replace(/\(#\d+(?:,\s*#\d+)*\)/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        // "**Bold title** — description text"
        const boldMatch = raw.match(/^\*\*([^*]+)\*\*\s*[—–-]\s*([\s\S]+)/);
        if (boldMatch) {
          const itemTitle = boldMatch[1]!.trim();
          const itemDesc = boldMatch[2]!.trim();
          // First bullet → summary headline, override generic section title
          if (!summary) {
            title = itemTitle;
            summary = itemDesc.slice(0, 160);
          }
          const shortDesc = (itemDesc.split(/[.;]/)[0] ?? '').trim();
          highlights.push(shortDesc ? `${itemTitle} — ${shortDesc.slice(0, 90)}` : itemTitle);
        } else {
          const short = raw.replace(/`[^`]+`/g, '').trim().slice(0, 100);
          if (!summary) summary = short;
          highlights.push(short);
        }
      }
    }

    if (!title) title = isUnreleased ? 'Upcoming changes' : `v${version} update`;
    if (!summary) summary = highlights[0] ?? 'See changelog for details.';

    entries.push({
      version,
      date,
      title,
      summary,
      highlights: highlights.slice(0, 3),
      status: isUnreleased ? 'current' : 'released',
    });
  }

  return entries;
}

/* ── Fallback static data ─────────────────────────────────────────── */

const FALLBACK_TIMELINE: ReleaseTimelineEntry[] = [
  {
    version: 'Unreleased',
    date: 'In progress',
    status: 'current',
    title: 'Modular dashboard architecture',
    summary: 'Ongoing platform refactor to make the dashboard easier to extend, test, and operate across variants.',
    highlights: [
      'Introduced AppEventBus plus owned News, Intelligence, UI, and Map state slices.',
      'Split large data-loading and economic-service modules into focused managers and service files.',
      'Added managed service lifecycles and Vite variant tree-shaking for cleaner runtime boundaries.',
    ],
  },
  {
    version: '2.5.25',
    date: '2026-03-04',
    title: 'Supply Chain v2',
    summary: 'Upgraded chokepoint and critical-minerals intelligence with better cache behavior and richer AIS disruption context.',
    highlights: [
      'Added AIS disruption counts to chokepoint data and UI surfaces.',
      'Moved supply-chain cache keys to v2 with daily cache tiers for slower-moving minerals data.',
      'Focused critical-minerals coverage on export-controlled minerals and top producers.',
    ],
  },
  {
    version: '2.5.24',
    date: '2026-03-03',
    title: 'Conflict data, sharing, and deployment consolidation',
    summary: 'Major release covering UCDP conflict data, country brief sharing, security hardening, and a unified deployment model.',
    highlights: [
      'Integrated UCDP armed conflict tracking and seeded expanded Iran conflict-zone data.',
      'Added country brief maximize mode, shareable URLs, native share support, and expanded sections.',
      'Consolidated variant deployments, improved CDN performance, and replaced unsafe inline CSP paths with script hashes.',
    ],
  },
];

/* ── Exported timeline ────────────────────────────────────────────── */

function buildTimeline(): ReleaseTimelineEntry[] {
  try {
    const parsed = parseChangelogEntries(CHANGELOG_RAW as string);
    if (parsed.length >= 3) return parsed;
  } catch {
    // Fall through to static data
  }
  return FALLBACK_TIMELINE;
}

export const RELEASE_TIMELINE: ReleaseTimelineEntry[] = buildTimeline();
