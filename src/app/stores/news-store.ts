import type { NewsItem } from '@/types';
import { publishNewsMarkers } from '@/services/time-marker-sources';
import type { AppEventBus } from '../event-bus';

export interface NewsStore {
  allNews: NewsItem[];
  newsByCategory: Record<string, NewsItem[]>;
  happyAllItems: NewsItem[];
  setAllNews(news: NewsItem[]): void;
  setNewsByCategory(category: string, items: NewsItem[]): void;
  setHappyAllItems(items: NewsItem[]): void;
  filterByTimeRange(from: number, to: number): NewsItem[];
  destroy(): void;
}

export function createNewsStore(bus: AppEventBus): NewsStore {
  let allNews: NewsItem[] = [];
  let newsByCategory: Record<string, NewsItem[]> = {};
  let happyAllItems: NewsItem[] = [];

  return {
    get allNews() { return allNews; },
    get newsByCategory() { return newsByCategory; },
    get happyAllItems() { return happyAllItems; },

    setAllNews(news: NewsItem[]) {
      allNews = news;
      // Alert-level headlines become key-event markers on the time scrubber.
      publishNewsMarkers(news);
      bus.emit('news:all-updated', news);
    },

    setNewsByCategory(category: string, items: NewsItem[]) {
      newsByCategory = { ...newsByCategory, [category]: items };
      bus.emit('news:category-updated', category, items);
    },

    setHappyAllItems(items: NewsItem[]) {
      happyAllItems = items;
      bus.emit('news:happy-updated', items);
    },

    filterByTimeRange(from: number, to: number): NewsItem[] {
      return allNews.filter(n => {
        const ts = n.pubDate instanceof Date ? n.pubDate.getTime() : 0;
        return ts >= from && ts <= to;
      });
    },

    destroy() {
      allNews = [];
      newsByCategory = {};
      happyAllItems = [];
    },
  };
}
