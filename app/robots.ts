import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://edgepannel.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/portfolio',
          '/dashboard/settings',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
