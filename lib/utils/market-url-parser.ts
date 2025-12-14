/**
 * Utility functions to parse Polymarket and Kalshi market URLs
 */

export interface ParsedMarketUrl {
  platform: 'polymarket' | 'kalshi';
  identifier: string; // slug for Polymarket, ticker for Kalshi
  type: 'slug' | 'ticker' | 'id';
}

/**
 * Detect if a string is a Polymarket or Kalshi URL and extract the identifier
 *
 * Polymarket formats:
 * - https://polymarket.com/event/{slug}
 * - https://polymarket.com/market/{id}
 *
 * Kalshi formats:
 * - https://kalshi.com/markets/{ticker}
 */
export function parseMarketUrl(input: string): ParsedMarketUrl | null {
  const trimmed = input.trim();

  // Check if it looks like a URL
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return null;
  }

  try {
    const url = new URL(trimmed);

    // Polymarket URLs
    if (url.hostname === 'polymarket.com' || url.hostname === 'www.polymarket.com') {
      // Format: /event/{slug}
      const eventMatch = url.pathname.match(/^\/event\/([^\/]+)/);
      if (eventMatch) {
        return {
          platform: 'polymarket',
          identifier: eventMatch[1],
          type: 'slug'
        };
      }

      // Format: /market/{id}
      const marketMatch = url.pathname.match(/^\/market\/([^\/]+)/);
      if (marketMatch) {
        return {
          platform: 'polymarket',
          identifier: marketMatch[1],
          type: 'id'
        };
      }
    }

    // Kalshi URLs
    if (url.hostname === 'kalshi.com' || url.hostname === 'www.kalshi.com') {
      // Format: /markets/{ticker}
      const marketMatch = url.pathname.match(/^\/markets\/([^\/]+)/);
      if (marketMatch) {
        return {
          platform: 'kalshi',
          identifier: marketMatch[1],
          type: 'ticker'
        };
      }
    }

    return null;
  } catch (e) {
    // Invalid URL
    return null;
  }
}

/**
 * Check if a string is a valid market URL
 */
export function isMarketUrl(input: string): boolean {
  return parseMarketUrl(input) !== null;
}
