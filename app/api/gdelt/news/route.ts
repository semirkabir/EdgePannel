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

    // Get date range (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const startDateStr = startDate.toISOString().split('T')[0].replace(/-/g, '');
    const endDateStr = endDate.toISOString().split('T')[0].replace(/-/g, '');

    // Construct GDELT API query
    // Use the country name directly in quotes for better matching
    // GDELT rejects short country codes like "IN" as too common
    const query = `"${country}"`;
    const apiUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&startdatetime=${startDateStr}000000&enddatetime=${endDateStr}235959&mode=artlist&format=json&maxrecords=100&sourcelang=eng`;

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GDELT API] Error response:', errorText);
      throw new Error(`GDELT API error: ${response.status} - ${errorText.substring(0, 100)}`);
    }

    // Check if response is JSON before parsing
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[GDELT API] Non-JSON response:', text.substring(0, 200));
      throw new Error(`GDELT API returned non-JSON response: ${text.substring(0, 100)}`);
    }

    const data = await response.json();

    // List of trusted English news domains
    const trustedDomains = [
      'bbc.com', 'bbc.co.uk', 'cnn.com', 'reuters.com', 'apnews.com',
      'theguardian.com', 'nytimes.com', 'washingtonpost.com', 'wsj.com',
      'bloomberg.com', 'ft.com', 'economist.com', 'aljazeera.com',
      'dw.com', 'france24.com', 'news.sky.com', 'independent.co.uk',
      'telegraph.co.uk', 'thetimes.co.uk', 'cnbc.com', 'foxnews.com',
      'nbcnews.com', 'abcnews.go.com', 'cbsnews.com', 'usatoday.com',
      'latimes.com', 'nypost.com', 'newsweek.com', 'time.com',
      'theatlantic.com', 'politico.com', 'axios.com', 'vox.com',
      'npr.org', 'pbs.org', 'theverge.com', 'techcrunch.com',
      'wired.com', 'arstechnica.com', 'engadget.com', 'zdnet.com'
    ];

    // Chinese and non-English domains to exclude
    const excludedDomains = [
      '.cn', '.tw', '.hk', '.jp', '.kr', '.ru', '.ua',
      'sina.com', 'qq.com', 'sohu.com', 'weibo.com', 'baidu.com',
      '163.com', '126.com', 'ifeng.com', 'people.com.cn', 'xinhua'
    ];

    // Transform and filter GDELT response
    const allArticles = (data.articles || []).map((article: any) => ({
      url: article.url,
      url_mobile: article.url_mobile,
      title: article.title || article.snippet || 'No title',
      seendate: article.seendate || new Date().toISOString(),
      socialimage: article.socialimage,
      domain: article.domain || 'unknown',
      language: article.language || 'unknown',
      sourcecountry: article.sourcecountry || 'unknown',
    }));

    // Filter articles
    const filteredArticles = allArticles.filter((article: any) => {
      const domain = article.domain.toLowerCase();

      // Exclude Chinese and non-English domains
      const isExcluded = excludedDomains.some(excluded =>
        domain.includes(excluded.toLowerCase())
      );
      if (isExcluded) return false;

      // Only include English language articles
      if (article.language !== 'English' && article.language !== 'english' && article.language !== 'unknown') {
        return false;
      }

      return true;
    });

    // Prioritize trusted domains
    const trustedArticles = filteredArticles.filter((article: any) => {
      const domain = article.domain.toLowerCase();
      return trustedDomains.some(trusted => domain.includes(trusted));
    });

    // If we have trusted articles, use those; otherwise use filtered articles
    const articles = trustedArticles.length > 0
      ? trustedArticles.slice(0, 50)
      : filteredArticles.slice(0, 50);

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




