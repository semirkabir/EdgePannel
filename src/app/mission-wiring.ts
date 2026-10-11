import type { AppContext } from '@/app/app-context';
import type { NewsItem } from '@/types';
import type { BriefingSnapshot } from '@/services/mission-briefing';
import type { MissionBriefingPanel } from '@/components/MissionBriefingPanel';
import { isMissionPickerSeen, setMissionPickerSeen, shouldAutoOpenMissionPicker } from '@/app/ui-preferences';
import { getPreferredCountryScores } from '@/services/cached-risk-scores';
import { fetchChokepointStatus } from '@/services/supply-chain';

/**
 * Current news, or the first batch if feeds are still loading (capped).
 * Returns undefined when nothing arrived, so briefings can say "still
 * loading" instead of reporting a quiet region.
 */
function waitForNews(ctx: AppContext, timeoutMs: number): Promise<NewsItem[] | undefined> {
  const current = ctx.newsStore.allNews;
  if (current.length > 0) return Promise.resolve(current);
  return new Promise(resolve => {
    const timer = setTimeout(() => { off(); resolve(undefined); }, timeoutMs);
    const off = ctx.eventBus.once('news:all-updated', () => {
      clearTimeout(timer);
      const news = ctx.newsStore.allNews;
      resolve(news.length > 0 ? news : undefined);
    });
  });
}

/** Live data for a mission briefing, from data the dashboard already loads. */
export async function loadMissionSnapshot(ctx: AppContext): Promise<BriefingSnapshot> {
  return {
    cii: getPreferredCountryScores().map(s => ({ region: s.code, combinedScore: s.score, trend: s.trend })),
    // Capped: a hung feed must not freeze the panel; missing data shows as a gap.
    chokepoints: (await Promise.race([
      fetchChokepointStatus().catch(() => null),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
    ]))?.chokepoints ?? [],
    headlines: (await waitForNews(ctx, 8000))?.map(n => ({ title: n.title, link: n.link, source: n.source, publishedAt: n.pubDate?.getTime?.() })),
  };
}

/** `?mission=<id>` deep link, else the one-time first-visit picker. */
export function openInitialMission(panel: MissionBriefingPanel): void {
  const missionId = new URLSearchParams(window.location.search).get('mission');
  // Wait for the map so camera moves land; 1.5s matches the other first-load UI.
  setTimeout(() => {
    if (missionId && panel.openMission(missionId)) {
      setMissionPickerSeen(true);
      return;
    }
    if (shouldAutoOpenMissionPicker(window.location.search, window.innerWidth, isMissionPickerSeen())) {
      panel.open();
      setMissionPickerSeen(true);
    }
  }, 1500);
}
