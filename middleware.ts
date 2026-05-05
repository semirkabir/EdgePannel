const BOT_UA =
  /bot|crawl|spider|slurp|archiver|wget|curl\/|python-requests|scrapy|httpclient|go-http|java\/|libwww|perl|ruby|php\/|ahrefsbot|semrushbot|mj12bot|dotbot|baiduspider|yandexbot|sogou|bytespider|petalbot|gptbot|claudebot|ccbot/i;

const SOCIAL_PREVIEW_UA =
  /twitterbot|facebookexternalhit|linkedinbot|slackbot|telegrambot|whatsapp|discordbot|redditbot/i;

const SOCIAL_PREVIEW_PATHS = new Set(['/api/story', '/api/og-story']);

const PUBLIC_API_PATHS = new Set(['/api/version']);

const SOCIAL_IMAGE_UA =
  /Slack-ImgProxy|Slackbot|twitterbot|facebookexternalhit|linkedinbot|telegrambot|whatsapp|discordbot|redditbot/i;

const VARIANT_HOST_MAP: Record<string, string> = {
  'tech.edgepannel.app': 'tech',
  'finance.edgepannel.app': 'finance',
  'commodity.edgepannel.app': 'commodity',
  'happy.edgepannel.app': 'happy',
  'conflicts.edgepannel.app': 'conflicts',
};

// Source of truth: src/config/variant-meta.ts — keep in sync when variant metadata changes.
const VARIANT_OG: Record<string, { title: string; description: string; image: string; url: string }> = {
  tech: {
    title: 'EdgePannel Tech - Real-Time AI & Tech Industry Dashboard',
    description: 'Real-time AI and tech industry dashboard tracking tech giants, AI labs, startup ecosystems, funding rounds, and tech events worldwide.',
    image: 'https://tech.edgepannel.app/favico/tech/og-image.png',
    url: 'https://tech.edgepannel.app/',
  },
  finance: {
    title: 'EdgePannel Finance - Real-Time Markets & Trading Dashboard',
    description: 'Real-time finance and trading dashboard tracking global markets, stock exchanges, central banks, commodities, forex, crypto, and economic indicators worldwide.',
    image: 'https://finance.edgepannel.app/favico/finance/og-image.png',
    url: 'https://finance.edgepannel.app/',
  },
  commodity: {
    title: 'EdgePannel Commodity - Real-Time Commodity Markets & Supply Chain Dashboard',
    description: 'Real-time commodity markets dashboard tracking mining sites, processing plants, commodity ports, supply chains, and global commodity trade flows.',
    image: 'https://commodity.edgepannel.app/favico/commodity/og-image.png',
    url: 'https://commodity.edgepannel.app/',
  },
  happy: {
    title: 'EdgePannel Happy - Good News & Global Progress',
    description: 'Curated positive news, progress data, and uplifting stories from around the world.',
    image: 'https://happy.edgepannel.app/favico/happy/og-image.png',
    url: 'https://happy.edgepannel.app/',
  },
  conflicts: {
    title: 'EdgePannel Conflicts - Real-Time Conflict & Security Dashboard',
    description: 'Real-time conflict and security dashboard tracking wars, military activity, displacement, infrastructure risk, and geopolitical escalation signals.',
    image: 'https://conflicts.edgepannel.app/favico/conflicts/og-image.png',
    url: 'https://conflicts.edgepannel.app/',
  },
};

const ALLOWED_HOSTS = new Set([
  'edgepannel.app',
  ...Object.keys(VARIANT_HOST_MAP),
]);
const VERCEL_PREVIEW_RE = /^[a-z0-9-]+-[a-z0-9]{8,}\.vercel\.app$/;

function normalizeHost(raw: string): string {
  return raw.toLowerCase().replace(/:\d+$/, '');
}

function isAllowedHost(host: string): boolean {
  return ALLOWED_HOSTS.has(host) || VERCEL_PREVIEW_RE.test(host);
}

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const ua = request.headers.get('user-agent') ?? '';
  const path = url.pathname;
  const host = normalizeHost(request.headers.get('host') ?? url.hostname);

  // Social bot OG response for variant subdomain root pages
  if (path === '/' && SOCIAL_PREVIEW_UA.test(ua)) {
    const variant = VARIANT_HOST_MAP[host];
    if (variant && isAllowedHost(host)) {
      const og = VARIANT_OG[variant as keyof typeof VARIANT_OG];
      if (og) {
        const html = `<!DOCTYPE html><html><head>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${og.title}"/>
<meta property="og:description" content="${og.description}"/>
<meta property="og:image" content="${og.image}"/>
<meta property="og:url" content="${og.url}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${og.title}"/>
<meta name="twitter:description" content="${og.description}"/>
<meta name="twitter:image" content="${og.image}"/>
<title>${og.title}</title>
</head><body></body></html>`;
        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'Vary': 'User-Agent, Host',
          },
        });
      }
    }
  }

  // Only apply bot filtering to /api/* and /favico/* paths
  if (!path.startsWith('/api/') && !path.startsWith('/favico/')) {
    return;
  }

  // Allow social preview/image bots on OG image assets
  if (path.startsWith('/favico/') || path.endsWith('.png')) {
    if (SOCIAL_IMAGE_UA.test(ua)) {
      return;
    }
  }

  // Allow social preview bots on exact OG routes only
  if (SOCIAL_PREVIEW_UA.test(ua) && SOCIAL_PREVIEW_PATHS.has(path)) {
    return;
  }

  // Public endpoints bypass all bot filtering
  if (PUBLIC_API_PATHS.has(path)) {
    return;
  }

  // Block bots from all API routes
  if (BOT_UA.test(ua)) {
    return new Response('{"error":"Forbidden"}', {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // No user-agent or suspiciously short — likely a script
  if (!ua || ua.length < 10) {
    return new Response('{"error":"Forbidden"}', {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const config = {
  matcher: ['/', '/api/:path*', '/favico/:path*'],
};
