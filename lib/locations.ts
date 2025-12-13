// Coordinates for major cities and regions relevant to prediction markets
export const LOCATION_COORDINATES: Record<string, { lat: number; lng: number }> = {
  // North America
  'washington': { lat: 38.9072, lng: -77.0369 },
  'dc': { lat: 38.9072, lng: -77.0369 },
  'usa': { lat: 39.8283, lng: -98.5795 },
  'united states': { lat: 39.8283, lng: -98.5795 },
  'america': { lat: 39.8283, lng: -98.5795 },
  'us': { lat: 39.8283, lng: -98.5795 },
  'new york': { lat: 40.7128, lng: -74.0060 },
  'nyc': { lat: 40.7128, lng: -74.0060 },
  'california': { lat: 36.7783, lng: -119.4179 },
  'texas': { lat: 31.9686, lng: -99.9018 },
  'florida': { lat: 27.6648, lng: -81.5158 },
  'georgia': { lat: 32.1656, lng: -82.9001 },
  'arizona': { lat: 34.0489, lng: -111.0937 },
  'pennsylvania': { lat: 41.2033, lng: -77.1945 },
  'michigan': { lat: 44.3148, lng: -85.6024 },
  'wisconsin': { lat: 43.7844, lng: -88.7879 },
  'nevada': { lat: 38.8026, lng: -116.4194 },
  'ottawa': { lat: 45.4215, lng: -75.6972 },
  'canada': { lat: 56.1304, lng: -106.3468 },
  'mexico': { lat: 23.6345, lng: -102.5528 },
  'ohio': { lat: 40.4173, lng: -82.9071 },
  'north carolina': { lat: 35.7596, lng: -79.0193 },
  'virginia': { lat: 37.4316, lng: -78.6569 },
  'colorado': { lat: 39.5501, lng: -105.7821 },

  // Europe
  'london': { lat: 51.5074, lng: -0.1278 },
  'uk': { lat: 55.3781, lng: -3.4360 },
  'united kingdom': { lat: 55.3781, lng: -3.4360 },
  'paris': { lat: 48.8566, lng: 2.3522 },
  'france': { lat: 46.2276, lng: 2.2137 },
  'berlin': { lat: 52.5200, lng: 13.4050 },
  'germany': { lat: 51.1657, lng: 10.4515 },
  'kyiv': { lat: 50.4501, lng: 30.5234 },
  'kiev': { lat: 50.4501, lng: 30.5234 },
  'ukraine': { lat: 48.3794, lng: 31.1656 },
  'moscow': { lat: 55.7558, lng: 37.6173 },
  'russia': { lat: 61.5240, lng: 105.3188 },
  'brussels': { lat: 50.8503, lng: 4.3517 },
  'eu': { lat: 50.8503, lng: 4.3517 },
  'european union': { lat: 50.8503, lng: 4.3517 },
  'italy': { lat: 41.8719, lng: 12.5674 },
  'rome': { lat: 41.9028, lng: 12.4964 },
  'spain': { lat: 40.4637, lng: -3.7492 },
  'madrid': { lat: 40.4168, lng: -3.7038 },
  'poland': { lat: 51.9194, lng: 19.1451 },
  'warsaw': { lat: 52.2297, lng: 21.0122 },
  'eastern ukraine': { lat: 48.0, lng: 37.0 },
  'black sea': { lat: 43.0, lng: 34.0 },

  // Asia
  'beijing': { lat: 39.9042, lng: 116.4074 },
  'china': { lat: 35.8617, lng: 104.1954 },
  'taiwan': { lat: 23.6978, lng: 120.9605 },
  'taipei': { lat: 25.0330, lng: 121.5654 },
  'tokyo': { lat: 35.6762, lng: 139.6503 },
  'japan': { lat: 36.2048, lng: 138.2529 },
  'seoul': { lat: 37.5665, lng: 126.9780 },
  'korea': { lat: 35.9078, lng: 127.7669 },
  'south korea': { lat: 35.9078, lng: 127.7669 },
  'north korea': { lat: 40.3399, lng: 127.5101 },
  'india': { lat: 20.5937, lng: 78.9629 },
  'delhi': { lat: 28.6139, lng: 77.2090 },
  'mumbai': { lat: 19.0760, lng: 72.8777 },
  'hong kong': { lat: 22.3193, lng: 114.1694 },
  'singapore': { lat: 1.3521, lng: 103.8198 },

  // Middle East
  'israel': { lat: 31.0461, lng: 34.8516 },
  'jerusalem': { lat: 31.7683, lng: 35.2137 },
  'gaza': { lat: 31.5000, lng: 34.4667 },
  'gaza strip': { lat: 31.5000, lng: 34.4667 },
  'rafah': { lat: 31.2968, lng: 34.2455 },
  'iran': { lat: 32.4279, lng: 53.6880 },
  'tehran': { lat: 35.6892, lng: 51.3890 },
  'saudi': { lat: 23.8859, lng: 45.0792 },
  'saudi arabia': { lat: 23.8859, lng: 45.0792 },
  'yemen': { lat: 15.5527, lng: 48.5164 },
  'houthi': { lat: 15.5527, lng: 48.5164 },
  'red sea': { lat: 20.0000, lng: 38.0000 },
  'persian gulf': { lat: 27.0, lng: 51.0 },
  'dubai': { lat: 25.2048, lng: 55.2708 },
  'uae': { lat: 23.4241, lng: 53.8478 },
  'turkey': { lat: 38.9637, lng: 35.2433 },
  'istanbul': { lat: 41.0082, lng: 28.9784 },
  'lebanon': { lat: 33.8547, lng: 35.8623 },
  'beirut': { lat: 33.8938, lng: 35.5018 },

  // South America
  'brazil': { lat: -14.2350, lng: -51.9253 },
  'argentina': { lat: -38.4161, lng: -63.6167 },
  'venezuela': { lat: 6.4238, lng: -66.5897 },
  'colombia': { lat: 4.5709, lng: -74.2973 },

  // Africa
  'nigeria': { lat: 9.0820, lng: 8.6753 },
  'egypt': { lat: 26.8206, lng: 30.8025 },
  'cairo': { lat: 30.0444, lng: 31.2357 },
  'south africa': { lat: -30.5595, lng: 22.9375 },

  // Oceania
  'australia': { lat: -25.2744, lng: 133.7751 },

  // Misc
  'fed': { lat: 38.8977, lng: -77.0365 }, // DC
  'interest rate': { lat: 40.7128, lng: -74.0060 }, // NYC (Wall St)
  'bitcoin': { lat: 13.7563, lng: -89.5019 }, // El Salvador
  'ethereum': { lat: 46.9480, lng: 7.4474 }, // Switzerland
  'crypto': { lat: 25.0343, lng: -77.3963 }, // Bahamas
  'global': { lat: 0, lng: 0 },
  'world': { lat: 0, lng: 0 },
};

