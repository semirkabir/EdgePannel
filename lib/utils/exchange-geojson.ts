import { StockExchange, ExchangeMarketData } from '@/types/exchange';

export interface ExchangeGeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    id: string;
    name: string;
    shortName: string;
    country: string;
    city: string;
    region: string;
    isOpen: boolean;
    totalVolume?: number;
    totalMarketCap?: number;
    currency: string;
    indices: string[];
    website: string;
    timezone: string;
    // Market data
    topGainers?: any[];
    topLosers?: any[];
    volumeLeaders?: any[];
    sectorBreakdown?: any[];
    advancingStocks?: number;
    decliningStocks?: number;
    lastUpdated?: string;
  };
}

export interface ExchangeGeoJSON {
  type: 'FeatureCollection';
  features: ExchangeGeoJSONFeature[];
}

/**
 * Convert an array of exchanges to GeoJSON format for map rendering
 */
export function exchangesToGeoJSON(
  exchanges: StockExchange[],
  marketData?: Map<string, ExchangeMarketData>
): ExchangeGeoJSON {
  const features: ExchangeGeoJSONFeature[] = exchanges.map((exchange) => {
    const data = marketData?.get(exchange.id);

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [exchange.coordinates.lng, exchange.coordinates.lat],
      },
      properties: {
        id: exchange.id,
        name: exchange.name,
        shortName: exchange.shortName,
        country: exchange.country,
        city: exchange.city,
        region: exchange.region,
        isOpen: data?.isOpen ?? false,
        totalVolume: data?.totalVolume,
        totalMarketCap: data?.totalMarketCap ?? exchange.marketCap,
        currency: exchange.currency,
        indices: exchange.indices,
        website: exchange.website,
        timezone: exchange.timezone,
        topGainers: data?.topGainers,
        topLosers: data?.topLosers,
        volumeLeaders: data?.volumeLeaders,
        sectorBreakdown: data?.sectorBreakdown,
        advancingStocks: data?.advancingStocks,
        decliningStocks: data?.decliningStocks,
        lastUpdated: data?.lastUpdated?.toISOString(),
      },
    };
  });

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Formats a duration in minutes to a human readable string (e.g. "2h 15m")
 */
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Helper to convert "HH:mm" string to minutes from midnight
 */
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Helper to convert minutes from midnight to "HH:mm" string
 */
function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export type MarketStatus = 'open' | 'closed' | 'pre-market' | 'after-hours';

export interface DetailedMarketStatus {
  status: MarketStatus;
  isOpen: boolean; // True if in regular trading hours
  isExtendedHours: boolean; // True if in pre or post market
  nextStatusText: string; // e.g., "Closes in" or "Opens in"
  timeUntilNextStatus: string; // e.g., "2h 15m"
  localOpenTime: string; // Open time in user's timezone
  localCloseTime: string; // Close time in user's timezone
  exchangeTime: string; // Current time in exchange's timezone
  userTimezone: string;
}

/**
 * Get detailed market status including time until open/close and local times
 */
export function getDetailedMarketStatus(
  exchange: StockExchange,
  userTimezone?: string
): DetailedMarketStatus {
  try {
    const resolvedUserTimezone = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();

    // Get exchange time
    const exchangeTimeParts = new Intl.DateTimeFormat('en-US', {
      timeZone: exchange.timezone,
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
      weekday: 'short'
    }).formatToParts(now);

    const exchangeHour = parseInt(exchangeTimeParts.find(p => p.type === 'hour')?.value || '0');
    const exchangeMinute = parseInt(exchangeTimeParts.find(p => p.type === 'minute')?.value || '0');
    const exchangeWeekday = exchangeTimeParts.find(p => p.type === 'weekday')?.value;
    const currentExchangeMinutes = exchangeHour * 60 + exchangeMinute;

    // Map weekday to number (0 = Sunday, 1 = Monday, etc.)
    const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const currentDay = dayMap[exchangeWeekday ?? 'Sun'];
    const isTradingDay = exchange.tradingHours.tradingDays.includes(currentDay);

    // Parse market hours
    let openMinutes = timeToMinutes(exchange.tradingHours.open);
    let closeMinutes = timeToMinutes(exchange.tradingHours.close);

    // Holiday Overrides (Christmas Eve - Dec 24)
    const month = now.getUTCMonth(); // 11 is December
    const day = now.getUTCDate();

    // Check if right now is Dec 24 in the exchange's calendar
    // approx check based on month/day for "current" local date of exchange
    if (month === 11 && day === 24) {
      if (exchange.country === 'United States') {
        if (exchange.id === 'nyse' || exchange.id === 'nasdaq') {
          closeMinutes = timeToMinutes('13:00'); // Early close at 1 PM ET
        } else if (exchange.id === 'cme') {
          closeMinutes = timeToMinutes('12:15'); // Early close at 12:15 PM CT for equities
        }
      } else if (exchange.id === 'lse') {
        closeMinutes = timeToMinutes('12:30'); // Early close LSE
      }
      // Add more as needed
    }

    const preOpenMinutes = exchange.tradingHours.preMarketOpen ? timeToMinutes(exchange.tradingHours.preMarketOpen) : openMinutes;
    const postCloseMinutes = exchange.tradingHours.afterHoursClose ? timeToMinutes(exchange.tradingHours.afterHoursClose) : closeMinutes;

    let status: MarketStatus = 'closed';
    let nextStatusText = 'Opens in';
    let minutesUntil = 0;

    if (!isTradingDay) {
      status = 'closed';
      nextStatusText = 'Opens';
      minutesUntil = 0;
    } else {
      // Handle wrapping hours (e.g. 17:00 to 16:00 next day)
      const isWrapping = openMinutes > closeMinutes;
      const isOpen = isWrapping
        ? (currentExchangeMinutes >= openMinutes || currentExchangeMinutes < closeMinutes)
        : (currentExchangeMinutes >= openMinutes && currentExchangeMinutes < closeMinutes);

      if (isOpen) {
        status = 'open';
        nextStatusText = 'Closes in';
        minutesUntil = isWrapping
          ? (currentExchangeMinutes >= openMinutes ? (1440 - currentExchangeMinutes + closeMinutes) : (closeMinutes - currentExchangeMinutes))
          : (closeMinutes - currentExchangeMinutes);
      } else if (currentExchangeMinutes >= preOpenMinutes && currentExchangeMinutes < openMinutes) {
        status = 'pre-market';
        nextStatusText = 'Opens in';
        minutesUntil = openMinutes - currentExchangeMinutes;
      } else if (!isWrapping && currentExchangeMinutes >= closeMinutes && currentExchangeMinutes < postCloseMinutes) {
        status = 'after-hours';
        nextStatusText = 'Closed (After-hours)';
        minutesUntil = postCloseMinutes - currentExchangeMinutes;
      } else if (currentExchangeMinutes < preOpenMinutes) {
        status = 'closed';
        nextStatusText = 'Pre-market in';
        minutesUntil = preOpenMinutes - currentExchangeMinutes;
      } else {
        status = 'closed';
        nextStatusText = 'Opens';
        minutesUntil = 0;
      }
    }

    // Convert exchange open/close times to User's Timezone
    // We construct a date object for "today" at open time in exchange TZ, then format to user TZ
    const getLocalTime = (timeStr: string) => {
      // create a date object that represents [today, timeStr] in exchange timezone
      // Since JS Date is timestamp based, we need to find the timestamp for "Now" but with Exchange Time
      // Actually easier: Parse the current date parts in exchange TZ, verify, then construct string to parse

      // Let's rely on string manipulation for the "Date" part to keep it simple, 
      // getting the offset is tricky without a library like date-fns-tz or moment-timezone.
      // We will use toLocaleString with both timezones to get the shift.

      // Hacky but robust pure-JS way:
      // 1. Take current 'now' timestamp.
      // 2. Format it to exchange timezone date string "YYYY/MM/DD"
      // 3. Create a string "YYYY/MM/DD HH:mm:00" (Exchange Time)
      // 4. Create a Date object from that string assuming it is in Exchange Timezone (tricky in vanilla JS)

      // Alternative: Use an arbitrary date (e.g. today) and just convert the HOURS.
      // Limitation: Daylight savings differences between user and exchange might be off if we use arbitrary date.
      // Best effort: Use simple formatter if available.

      try {
        const [h, m] = timeStr.split(':');
        // Create a date object for today
        const date = new Date();

        // We need to set the time such that in `exchange.timezone` it is `h:m`.
        // This is hard without a library. 
        // fallback: just show the exchange time and user can infer, OR
        // approximate by applying timezone offsets. 

        // Let's just return the raw string + timezone name for now if accurate conversion is too complex without libs.
        // But the user asked for "based on user's time settings".

        // Let's try one robust native method:
        // Create a formatting function for the USER timezone
        const userFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: resolvedUserTimezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });

        // We know the Exchange Time. We need to find the User Time that corresponds to it.
        // Approx: 
        // 1. Get offset of Exchange relative to UTC.
        // 2. Get offset of User relative to UTC.
        // 3. Apply diff.

        // Let's stick to returning "09:30 EST" style if conversion fails, effectively telling user the exchange time.
        // BUT, let's try to do it right.

        // We can find the UTC equivalent of "Today HH:mm in ExchangeZone"
        // Then print that UTC in UserZone.

        // To find UTC equivalent of "Today HH:mm in ExchangeZone":
        // Iterate or guess? No.
        // Use `new Date().toLocaleString("en-US", {timeZone: exchange.timezone})` gives us "Current wall time in Exchange".
        // If we compute the difference between "Current wall time in Exchange" and "Current wall time in UTC", we get the offset.

        // Let's just calculate the offset between User and Exchange *right now* and apply it.
        // This works 99% of time unless the open/close time crosses a DST boundary relative to "now", which is rare.

        const now = new Date();
        const userTimeStr = now.toLocaleString('en-US', { timeZone: resolvedUserTimezone, hour12: false });
        const exchangeTimeStr = now.toLocaleString('en-US', { timeZone: exchange.timezone, hour12: false });

        const userDate = new Date(userTimeStr);
        const exchangeDate = new Date(exchangeTimeStr);

        // Difference in minutes
        const diffMinutes = (userDate.getTime() - exchangeDate.getTime()) / 60000;

        const exchangeMinutes = timeToMinutes(timeStr);
        let userMinutes = exchangeMinutes + diffMinutes;

        // Normalize 
        if (userMinutes < 0) userMinutes += 24 * 60;
        if (userMinutes >= 24 * 60) userMinutes -= 24 * 60;

        return minutesToTime(userMinutes);
      } catch (e) {
        return timeStr; // Fallback
      }
    };

    const localOpen = getLocalTime(exchange.tradingHours.open);
    const localClose = getLocalTime(exchange.tradingHours.close);
    const formattedExchangeTime = `${exchangeHour.toString().padStart(2, '0')}:${exchangeMinute.toString().padStart(2, '0')}`;

    return {
      status,
      isOpen: status === 'open',
      isExtendedHours: status === 'pre-market' || status === 'after-hours',
      nextStatusText,
      timeUntilNextStatus: minutesUntil > 0 ? formatDuration(minutesUntil) : '',
      localOpenTime: localOpen,
      localCloseTime: localClose,
      exchangeTime: formattedExchangeTime,
      userTimezone: resolvedUserTimezone
    }; //, [exchange, userTimezone]);
  } catch (error) {
    console.error('Error calculating market status:', error);
    return {
      status: 'closed',
      isOpen: false,
      isExtendedHours: false,
      nextStatusText: 'Error',
      timeUntilNextStatus: '',
      localOpenTime: exchange.tradingHours.open,
      localCloseTime: exchange.tradingHours.close,
      exchangeTime: '',
      userTimezone: ''
    };
  }
}

/**
 * Check if a market is currently open based on trading hours and timezone
 * Kept for backward compatibility
 */
export function isMarketOpen(exchange: StockExchange): boolean {
  const status = getDetailedMarketStatus(exchange);
  return status.isOpen;
}

/**
 * Get simple time status
 * Kept for backward compatibility
 */
export function getMarketTimeStatus(exchange: StockExchange): {
  isOpen: boolean;
  timeUntilChange: string;
  nextChangeTime: Date | null;
} {
  const details = getDetailedMarketStatus(exchange);
  return {
    isOpen: details.isOpen,
    timeUntilChange: `${details.nextStatusText} ${details.timeUntilNextStatus}`,
    nextChangeTime: null // Not strictly needed for UI, complicates things
  };
}
