
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server';

interface Tweet {
    id: string;
    author: string;
    handle: string;
    avatar?: string;
    content: string;
    timestamp: string;
    platform: 'twitter' | 'internal' | 'news';
    likes: number;
    retweets: number;
    url?: string;
}

const MOCK_TWEETS: Tweet[] = [
    {
        id: '1',
        author: 'Polymarket',
        handle: '@Polymarket',
        avatar: 'https://avatars.githubusercontent.com/u/76251995', // Reliable logo from Polymarket GitHub
        content: '🚨 NEW MARKET: Will the FED cut rates in December? Traders are pricing in a 75% chance of a cut.',
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        platform: 'twitter',
        likes: 124,
        retweets: 45
    }
];

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const accounts = searchParams.get('accounts');

        // Construct query from accounts or default
        let query = 'Polymarket OR Kalshi';
        if (accounts) {
            // e.g. "Polymarket,Kalshi,ElonMusk" -> "Polymarket OR Kalshi OR ElonMusk"
            // Wrap phrases in quotes if they contain spaces
            const terms = accounts.split(',').map(term => {
                const t = term.trim();
                return t.includes(' ') ? `"${t}"` : t;
            });
            query = terms.join(' OR ');
        }

        // Add time filter
        const rssQuery = `${query} when:1d`;
        console.log(`[Tweets API] Fetching news for query: ${rssQuery}`);

        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(rssQuery)}&hl=en-US&gl=US&ceid=US:en`;
        const response = await fetch(rssUrl);

        if (!response.ok) {
            throw new Error('Failed to fetch RSS feed');
        }

        const xml = await response.text();

        // Simple regex parsing for RSS items
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        const titleRegex = /<title>(.*?)<\/title>/;
        const linkRegex = /<link>(.*?)<\/link>/;
        const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/;
        const sourceRegex = /<source url=".*?">(.*?)<\/source>/;

        const newsItems: Tweet[] = [];
        let match;

        while ((match = itemRegex.exec(xml)) !== null) {
            const itemContent = match[1];
            const title = titleRegex.exec(itemContent)?.[1] || '';
            const link = linkRegex.exec(itemContent)?.[1] || '';
            const pubDate = pubDateRegex.exec(itemContent)?.[1] || '';
            const source = sourceRegex.exec(itemContent)?.[1] || 'News';

            if (title && link) {
                // Clean up title (remove " - Source Name" suffix if present)
                const cleanTitle = title.replace(new RegExp(` - ${source}$`), '');

                newsItems.push({
                    id: Math.random().toString(36).substring(7),
                    author: source,
                    handle: '@' + source.replace(/\s+/g, ''),
                    content: cleanTitle,
                    timestamp: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
                    platform: 'news',
                    likes: Math.floor(Math.random() * 50) + 10, // Simulated engagement
                    retweets: Math.floor(Math.random() * 20) + 1,
                    url: link,
                    avatar: '' // Frontend will handle default avatar
                });
            }
        }

        // Combine with mock tweets if news is sparse, or just return news
        // Sort by newest
        const allItems = [...newsItems, ...MOCK_TWEETS].sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        return NextResponse.json({ tweets: allItems.slice(0, 20) });

    } catch (error) {
        console.error('Error fetching news:', error);
        // Fallback to mock data on error
        return NextResponse.json({ tweets: MOCK_TWEETS });
    }
}


