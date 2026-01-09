import { NextRequest, NextResponse } from 'next/server';
import { getTopMovers } from '@/lib/services/alpaca';

// Region mapping for exchanges
const EXCHANGE_REGION_MAP: Record<string, string> = {
  // Americas
  'nyse': 'US',
  'nasdaq': 'US',
  'cme': 'US',
  'tsx': 'CA',
  'bmv': 'MX',
  'b3': 'BR',
  'byma': 'AR',

  // Europe
  'lse': 'GB',
  'euronext_paris': 'FR',
  'xetra': 'DE',
  'six': 'CH',
  'moex': 'RU',
  'gpw': 'PL',
  'omxs': 'SE',
  'omxc': 'DK',
  'ose': 'NO',
  'omxh': 'FI',
  'euronext_amsterdam': 'NL',

  // Asia-Pacific
  'jpx': 'JP',
  'sse': 'CN',
  'szse': 'CN',
  'hkex': 'HK',
  'nse': 'IN',
  'bse': 'IN',
  'sgx': 'SG',
  'krx': 'KR',
  'twse': 'TW',
  'asx': 'AU',

  // Middle East & Africa
  'tadawul': 'SA',
  'tase': 'IL',
  'dfm': 'AE',
  'adx': 'AE',
  'jse': 'ZA',

  // Emerging
  'txse': 'US',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const exchangeId = searchParams.get('exchangeId');
    const count = parseInt(searchParams.get('count') || '5');

    if (!exchangeId) {
      return NextResponse.json(
        { error: 'exchangeId is required' },
        { status: 400 }
      );
    }

    const region = EXCHANGE_REGION_MAP[exchangeId] || 'US';

    const [gainers, losers, mostActive] = await Promise.all([
      getTopMovers(region, 'gainers'),
      getTopMovers(region, 'losers'),
      getTopMovers(region, 'active')
    ]);

    return NextResponse.json({
      exchangeId,
      region,
      gainers,
      losers,
      mostActive,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error fetching exchange movers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market movers' },
      { status: 500 }
    );
  }
}
