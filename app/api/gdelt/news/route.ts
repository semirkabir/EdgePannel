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
    // Request more records so we have a better chance of finding high-quality matches after filtering
    const query = `"${country}"`;
    const apiUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&startdatetime=${startDateStr}000000&enddatetime=${endDateStr}235959&mode=artlist&format=json&maxrecords=250&sourcelang=eng`;

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

    // List of highly credible news domains
    const primaryTrusted = [
      'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'cnn.com',
      'nytimes.com', 'theguardian.com', 'bloomberg.com', 'wsj.com',
      'washingtonpost.com', 'ft.com', 'economist.com', 'aljazeera.com',
      'dw.com', 'france24.com', 'cnbc.com', 'politico.com', 'axios.com'
    ];

    const secondaryTrusted = [
      'nbcnews.com', 'abcnews.go.com', 'cbsnews.com', 'npr.org',
      'latimes.com', 'theatlantic.com', 'pbs.org', 'independent.co.uk',
      'news.sky.com', 'telegraph.co.uk', 'thetimes.co.uk', 'usatoday.com'
    ];

    // Non-English or low-credibility/clickbait patterns to exclude
    const excludedDomains = [
      '.cn', '.ru', '.ir', '.kp', 'sina.com', 'qq.com', 'sohu.com',
      'weibo.com', 'baidu.com', '163.com', 'ifeng.com', 'people.com.cn',
      'xinhua', 'rt.com', 'sputniknews.com', 'dailymail.co.uk', 'thesun.co.uk'
    ];

    // Helper to parse GDELT date string (YYYYMMDDHHMMSS)
    const parseGdeltDate = (dateStr: string) => {
      if (!dateStr || dateStr.length < 8) return new Date().toISOString();
      try {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const hour = dateStr.substring(8, 10) || '00';
        const min = dateStr.substring(10, 12) || '00';
        const sec = dateStr.substring(12, 14) || '00';
        return `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;
      } catch (e) {
        return new Date().toISOString();
      }
    };

    // Transform and initial filter
    const allArticles = (data.articles || []).map((article: any) => ({
      url: article.url,
      url_mobile: article.url_mobile,
      title: article.title || article.snippet || 'No title',
      seendate: parseGdeltDate(article.seendate),
      socialimage: article.socialimage,
      domain: article.domain || 'unknown',
      language: article.language || 'unknown',
      sourcecountry: article.sourcecountry || 'unknown',
    })).filter((article: any) => {
      const domain = article.domain.toLowerCase();
      const isExcluded = excludedDomains.some(excluded => domain.includes(excluded.toLowerCase()));
      const isEnglish = article.language.toLowerCase() === 'english' || article.language === 'unknown';
      return !isExcluded && isEnglish;
    });

    // Score and Sort
    const scoredArticles = allArticles.map((article: any) => {
      const domain = article.domain.toLowerCase();
      let score = 0;
      if (primaryTrusted.some(t => domain.includes(t))) score = 10;
      else if (secondaryTrusted.some(t => domain.includes(t))) score = 5;
      return { article, score };
    }).sort((a: any, b: any) => {
      // Primary: Date (Recency) - As requested "prioritize the newest news at the top"
      const timeDiff = new Date(b.article.seendate).getTime() - new Date(a.article.seendate).getTime();
      if (Math.abs(timeDiff) > 1000 * 60 * 60 * 12) { // If news is more than 12 hours apart, prioritize newest
        return timeDiff;
      }
      // Secondary: Score (Trustworthiness) - If news is close in time, prefer trusted sources
      if (b.score !== a.score) return b.score - a.score;
      return timeDiff;
    });

    const articles = scoredArticles.map((s: any) => s.article).slice(0, 25);

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









