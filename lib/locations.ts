// Coordinates for major cities and regions relevant to prediction markets
export const LOCATION_COORDINATES: Record<string, { lat: number; lng: number }> = {
  // North America
  'washington': { lat: 38.9072, lng: -77.0369 },
  'dc': { lat: 38.9072, lng: -77.0369 },
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
  
  // Europe
  'london': { lat: 51.5074, lng: -0.1278 },
  'uk': { lat: 55.3781, lng: -3.4360 },
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
  
  // Asia
  'beijing': { lat: 39.9042, lng: 116.4074 },
  'china': { lat: 35.8617, lng: 104.1954 },
  'taiwan': { lat: 23.6978, lng: 120.9605 },
  'taipei': { lat: 25.0330, lng: 121.5654 },
  'tokyo': { lat: 35.6762, lng: 139.6503 },
  'japan': { lat: 36.2048, lng: 138.2529 },
  'seoul': { lat: 37.5665, lng: 126.9780 },
  'korea': { lat: 35.9078, lng: 127.7669 },
  'india': { lat: 20.5937, lng: 78.9629 },
  'delhi': { lat: 28.6139, lng: 77.2090 },
  'mumbai': { lat: 19.0760, lng: 72.8777 },
  
  // Middle East
  'israel': { lat: 31.0461, lng: 34.8516 },
  'jerusalem': { lat: 31.7683, lng: 35.2137 },
  'gaza': { lat: 31.5000, lng: 34.4667 },
  'iran': { lat: 32.4279, lng: 53.6880 },
  'tehran': { lat: 35.6892, lng: 51.3890 },
  'saudi': { lat: 23.8859, lng: 45.0792 },
  'yemen': { lat: 15.5527, lng: 48.5164 },
  'red sea': { lat: 20.0000, lng: 38.0000 },
  
  // South America
  'brazil': { lat: -14.2350, lng: -51.9253 },
  'argentina': { lat: -38.4161, lng: -63.6167 },
  'venezuela': { lat: 6.4238, lng: -66.5897 },
  
  // Misc
  'fed': { lat: 38.8977, lng: -77.0365 }, // DC
  'interest rate': { lat: 40.7128, lng: -74.0060 }, // NYC (Wall St)
  'bitcoin': { lat: 13.7563, lng: -89.5019 }, // El Salvador (Just for fun/placeholder)
  'ethereum': { lat: 46.9480, lng: 7.4474 }, // Switzerland
  'crypto': { lat: 25.0343, lng: -77.3963 }, // Bahamas
};
