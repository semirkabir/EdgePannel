
export interface PolyglobeMarket {
  id: string;
  title: string;
  price: number;
  change: number;
  volume: string;
  lat: number;
  lng: number;
  type: 'market';
  category: 'politics' | 'conflict' | 'economics';
}

export interface PolyglobeTweet {
  id: string;
  user: string;
  handle: string;
  avatar: string;
  content: string;
  time: string;
  lat: number;
  lng: number;
  type: 'tweet' | 'news';
  tag?: string;
}

export const MOCK_MARKETS: PolyglobeMarket[] = [
  {
    id: 'm1',
    title: 'Xi Jinping out in 2025?',
    price: 0.02,
    change: 0.006,
    volume: '$2.1M',
    lat: 39.9042,
    lng: 116.4074, // Beijing
    type: 'market',
    category: 'politics'
  },
  {
    id: 'm2',
    title: 'Ukraine War Ceasefire by Q2?',
    price: 0.15,
    change: -0.02,
    volume: '$12M',
    lat: 50.4501,
    lng: 30.5234, // Kyiv
    type: 'market',
    category: 'conflict'
  },
  {
    id: 'm3',
    title: 'Israel-Gaza Ceasefire in 2025?',
    price: 0.08,
    change: 0.01,
    volume: '$5.4M',
    lat: 31.5,
    lng: 34.4667, // Gaza
    type: 'market',
    category: 'conflict'
  },
  {
    id: 'm4',
    title: 'US Recession in 2025?',
    price: 0.35,
    change: 0.05,
    volume: '$45M',
    lat: 38.8977,
    lng: -77.0365, // DC
    type: 'market',
    category: 'economics'
  }
];

export const MOCK_TWEETS: PolyglobeTweet[] = [
  {
    id: 't1',
    user: 'OSINTtechnical',
    handle: '@osinttechnical',
    avatar: 'https://github.com/shadcn.png', // Placeholder
    content: 'Both platforms serve their respective oil fields, together producing up to 160,000 barrels per day.',
    time: '1 hr ago',
    lat: 27.0,
    lng: 51.0, // Persian Gulf approx
    type: 'tweet',
    tag: 'OSINT'
  },
  {
    id: 't2',
    user: 'WarMonitor',
    handle: '@WarMonitor',
    avatar: 'https://github.com/shadcn.png',
    content: 'Heavy shelling reported in the eastern sector near Avdiivka.',
    time: '12 mins ago',
    lat: 48.13,
    lng: 37.75, // Avdiivka
    type: 'tweet',
    tag: 'BREAKING'
  }
];



