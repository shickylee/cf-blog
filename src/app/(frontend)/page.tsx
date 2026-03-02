import HomePageClient from '@/components/home-client'
import { getPosts, getSettings } from '@/lib/server-data'
import type { PostListItem } from '@/types'

export default async function HomePage() {
  const { posts, pagination } = await getPosts(1, 6)
  const siteSettings = await getSettings()
  
  const siteTitle = siteSettings.site_title || '我的博客'
  const siteSubtitle = siteSettings.site_subtitle || '分享技术，记录生活'
  const hasMore = pagination.page < pagination.total_pages

  return <HomePageClient initialPosts={posts} initialHasMore={hasMore} siteTitle={siteTitle} siteSubtitle={siteSubtitle} />
}
