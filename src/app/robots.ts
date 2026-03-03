import { MetadataRoute } from 'next'
import { getEnv } from '@/lib/api'

export default function robots(): MetadataRoute.Robots {
  const env = getEnv()
  const baseUrl = env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/login', '/register'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
