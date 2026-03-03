import { MetadataRoute } from 'next'
import { getEnv } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const env = getEnv()
  const baseUrl = env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  
  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/posts`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    },
  ]
  
  const posts = await env.DB.prepare(`
    SELECT slug, updated_at, published_at 
    FROM posts 
    WHERE status = 'published'
    ORDER BY published_at DESC
    LIMIT 1000
  `).all<{ slug: string; updated_at: string; published_at: string }>()
  
  const postEntries: MetadataRoute.Sitemap = posts.results.map((post) => ({
    url: `${baseUrl}/posts/${post.slug}`,
    lastModified: new Date(post.updated_at || post.published_at),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))
  
  const categories = await env.DB.prepare(`
    SELECT slug, updated_at 
    FROM categories
  `).all<{ slug: string; updated_at: string }>()
  
  const categoryEntries: MetadataRoute.Sitemap = categories.results.map((category) => ({
    url: `${baseUrl}/posts?category=${category.slug}`,
    lastModified: new Date(category.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))
  
  const tags = await env.DB.prepare(`
    SELECT slug, updated_at 
    FROM tags
  `).all<{ slug: string; updated_at: string }>()
  
  const tagEntries: MetadataRoute.Sitemap = tags.results.map((tag) => ({
    url: `${baseUrl}/posts?tag=${tag.slug}`,
    lastModified: new Date(tag.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.5,
  }))
  
  return [...staticPages, ...postEntries, ...categoryEntries, ...tagEntries]
}
