import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Providers } from "@/components/providers"
import "./globals.css"
// Validate environment variables at startup
import "@/lib/config/validate-env"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: {
    default: "EdgePannel - Prediction Markets Visualized on 3D Globe",
    template: "%s | EdgePannel",
  },
  description: "EdgePannel - Track, analyze, and trade prediction markets from Polymarket and Kalshi on an interactive 3D globe. Real-time data, price alerts, whale tracking, and portfolio management.",
  keywords: ["edgepannel", "prediction markets", "polymarket", "kalshi", "trading", "forecasting", "3D globe", "market data", "prediction market platform", "edgepannel.com"],
  authors: [{ name: "EdgePannel" }],
  creator: "EdgePannel",
  publisher: "EdgePannel",
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'https://edgepannel.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://edgepannel.com",
    siteName: "EdgePannel",
    title: "EdgePannel - Prediction Markets Visualized on 3D Globe",
    description: "Track and trade prediction markets from Polymarket and Kalshi on an interactive 3D globe. Real-time data, alerts, and portfolio tracking.",
  },
  twitter: {
    card: "summary_large_image",
    title: "EdgePannel - Prediction Markets Visualized",
    description: "Track and trade prediction markets on an interactive 3D globe",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'ObN742tW-piNhuuHUdNvXCly9NqAXWITtB1Aoy3hBxU',
  },
  icons: {
    icon: '/favicon.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="google-site-verification" content="ObN742tW-piNhuuHUdNvXCly9NqAXWITtB1Aoy3hBxU" />
        <link rel="icon" href="/favicon.png" sizes="any" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "EdgePannel",
              "url": "https://edgepannel.com",
              "description": "Track, analyze, and trade prediction markets from Polymarket and Kalshi on an interactive 3D globe. Real-time data, price alerts, and portfolio tracking.",
              "applicationCategory": "FinanceApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.8",
                "ratingCount": "150"
              },
              "featureList": [
                "3D Globe Visualization",
                "Real-time Market Data",
                "Polymarket Integration",
                "Kalshi Integration",
                "Price Alerts",
                "Portfolio Tracking",
                "Whale Tracking"
              ]
            })
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

