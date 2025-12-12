import { NextRequest, NextResponse } from 'next/server';

// Country name to ISO code mapping
const COUNTRY_CODES: Record<string, string> = {
  'united states': 'US',
  'usa': 'US',
  'united kingdom': 'GB',
  'uk': 'GB',
  'china': 'CN',
  'russia': 'RU',
  'france': 'FR',
  'germany': 'DE',
  'japan': 'JP',
  'india': 'IN',
  'brazil': 'BR',
  'canada': 'CA',
  'australia': 'AU',
  'south korea': 'KR',
  'italy': 'IT',
  'spain': 'ES',
  'mexico': 'MX',
  'indonesia': 'ID',
  'netherlands': 'NL',
  'saudi arabia': 'SA',
  'turkey': 'TR',
  'switzerland': 'CH',
  'poland': 'PL',
  'belgium': 'BE',
  'sweden': 'SE',
  'argentina': 'AR',
  'thailand': 'TH',
  'israel': 'IL',
  'norway': 'NO',
  'ireland': 'IE',
  'singapore': 'SG',
  'malaysia': 'MY',
  'philippines': 'PH',
  'south africa': 'ZA',
  'egypt': 'EG',
  'pakistan': 'PK',
  'bangladesh': 'BD',
  'vietnam': 'VN',
  'ukraine': 'UA',
  'iran': 'IR',
  'iraq': 'IQ',
  'afghanistan': 'AF',
  'north korea': 'KP',
  'cuba': 'CU',
  'venezuela': 'VE',
  'syria': 'SY',
  'yemen': 'YE',
  'libya': 'LY',
  'sudan': 'SD',
  'somalia': 'SO',
  'ethiopia': 'ET',
  'kenya': 'KE',
  'nigeria': 'NG',
  'ghana': 'GH',
  'tanzania': 'TZ',
  'uganda': 'UG',
  'morocco': 'MA',
  'algeria': 'DZ',
  'tunisia': 'TN',
  'chile': 'CL',
  'colombia': 'CO',
  'peru': 'PE',
  'ecuador': 'EC',
  'bolivia': 'BO',
  'paraguay': 'PY',
  'uruguay': 'UY',
  'new zealand': 'NZ',
  'fiji': 'FJ',
  'papua new guinea': 'PG',
  'cambodia': 'KH',
  'laos': 'LA',
  'myanmar': 'MM',
  'sri lanka': 'LK',
  'nepal': 'NP',
  'bhutan': 'BT',
  'mongolia': 'MN',
  'kazakhstan': 'KZ',
  'uzbekistan': 'UZ',
  'kyrgyzstan': 'KG',
  'tajikistan': 'TJ',
  'turkmenistan': 'TM',
  'azerbaijan': 'AZ',
  'armenia': 'AM',
  'georgia': 'GE',
  'belarus': 'BY',
  'moldova': 'MD',
  'romania': 'RO',
  'bulgaria': 'BG',
  'greece': 'GR',
  'croatia': 'HR',
  'serbia': 'RS',
  'bosnia and herzegovina': 'BA',
  'albania': 'AL',
  'north macedonia': 'MK',
  'montenegro': 'ME',
  'kosovo': 'XK',
  'slovenia': 'SI',
  'slovakia': 'SK',
  'czech republic': 'CZ',
  'hungary': 'HU',
  'austria': 'AT',
  'portugal': 'PT',
  'denmark': 'DK',
  'finland': 'FI',
  'iceland': 'IS',
  'estonia': 'EE',
  'latvia': 'LV',
  'lithuania': 'LT',
  'luxembourg': 'LU',
  'malta': 'MT',
  'cyprus': 'CY',
};

function getCountryCode(countryName: string): string {
  const normalized = countryName.toLowerCase().trim();
  return COUNTRY_CODES[normalized] || normalized.toUpperCase().slice(0, 2);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const country = searchParams.get('country');

    if (!country) {
      return NextResponse.json(
        { error: 'Country parameter is required' },
        { status: 400 }
      );
    }

    const countryCode = getCountryCode(country);
    
    // Get date range (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Construct GDELT API query
    // Using the GDELT 2.0 Doc API for article search
    const query = `country:${countryCode}`;
    const apiUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&startdatetime=${startDateStr}T000000&enddatetime=${endDateStr}T235959&mode=artlist&format=json&maxrecords=20`;

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`GDELT API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform GDELT response to our format
    const articles = (data.articles || []).map((article: any) => ({
      url: article.url,
      url_mobile: article.url_mobile,
      title: article.title || article.snippet || 'No title',
      seendate: article.seendate || new Date().toISOString(),
      socialimage: article.socialimage,
      domain: article.domain || 'unknown',
      language: article.language || 'unknown',
      sourcecountry: article.sourcecountry || 'unknown',
    }));

    return NextResponse.json({ articles });
  } catch (error) {
    console.error('Error fetching GDELT news:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch news',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
