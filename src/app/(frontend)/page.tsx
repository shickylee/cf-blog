import { Metadata } from 'next'
import HomePageClient from '@/components/home-client'
import { getPosts, getSettings } from '@/lib/server-data'
import type { PostListItem } from '@/types'

export async function generateMetadata(): Promise<Metadata> {
  try {
    const siteSettings = await getSettings()
    return {
      title: {
        default: siteSettings.site_name || '我的博客',
        template: `%s | ${siteSettings.site_name || '我的博客'}`,
      },
      description: siteSettings.site_description || '分享技术，记录生活',
      keywords: 'blog, technology, life, nextjs, cloudflare',
      openGraph: {
        title: siteSettings.site_name || '我的博客',
        description: siteSettings.site_description || '分享技术，记录生活',
        type: 'website',
      },
    }
  } catch (error) {
    console.error('Failed to fetch site settings for metadata:', error)
  }
  
  return {
    title: {
      default: '我的博客',
      template: '%s | 我的博客',
    },
    description: '分享技术，记录生活',
    keywords: 'blog, technology, life, nextjs, cloudflare',
    openGraph: {
      title: '我的博客',
      description: '分享技术，记录生活',
      type: 'website',
    },
  }
}

export default async function HomePage() {
  const { posts, pagination } = await getPosts(1, 6)
  const siteSettings = await getSettings()
  
  const siteTitle = siteSettings.site_title || '我的博客'
  const siteSubtitle = siteSettings.site_subtitle || '分享技术，记录生活'
  const hasMore = pagination.page < pagination.total_pages

  return <HomePageClient initialPosts={posts} initialHasMore={hasMore} siteTitle={siteTitle} siteSubtitle={siteSubtitle} />
}
