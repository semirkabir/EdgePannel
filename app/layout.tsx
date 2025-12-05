import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Providers } from "@/components/providers"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: {
    default: "EdgePannel - Prediction Markets Visualized",
    template: "%s | EdgePannel",
  },
  description: "Track, analyze, and trade prediction markets from Polymarket and Kalshi on an interactive 3D globe. Real-time data, price alerts, and portfolio tracking.",
  keywords: ["prediction markets", "polymarket", "kalshi", "trading", "forecasting", "3D globe", "market data"],
  authors: [{ name: "EdgePannel" }],
  creator: "EdgePannel",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "EdgePannel",
    title: "EdgePannel - Prediction Markets Visualized",
    description: "Track and trade prediction markets on an interactive 3D globe",
  },
  twitter: {
    card: "summary_large_image",
    title: "EdgePannel - Prediction Markets Visualized",
    description: "Track and trade prediction markets on an interactive 3D globe",
  },
  robots: {
    index: true,
    follow: true,
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
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

