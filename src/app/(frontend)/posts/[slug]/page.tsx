import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import CommentSection from '@/components/comment-section'
import { getPostBySlug, getCommentsByPostSlug, getCurrentUser } from '@/lib/server-data'

export const dynamic = 'force-dynamic'

function extractFirstImage(content: string): string | null {
  if (!content) return null
  
  const imgRegex = /!\[.*?\]\((.*?)\)/g
  const match = imgRegex.exec(content)
  if (match && match[1]) {
    return match[1]
  }
  
  const htmlImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g
  const htmlMatch = htmlImgRegex.exec(content)
  if (htmlMatch && htmlMatch[1]) {
    return htmlMatch[1]
  }
  
  return null
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function renderContent(content: string): string {
  if (!content) return ''
  
  let html = content
  
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="my-4 rounded-lg" />')
  
  html = html.replace(/^### (.*$)/gm, '<h3 class="text-xl font-bold mt-8 mb-4">$1</h3>')
  html = html.replace(/^## (.*$)/gm, '<h2 class="text-2xl font-bold mt-10 mb-4">$1</h2>')
  html = html.replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold mt-10 mb-4">$1</h1>')
  
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm">$1</code>')
  
  html = html.replace(/^- (.*$)/gm, '<li class="ml-4">$1</li>')
  html = html.replace(/(<li class="ml-4">[\s\S]*?<\/li>)/, '<ul class="my-4">$1</ul>')
  
  html = html.replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-primary-500 pl-4 my-4 text-gray-600 italic">$1</blockquote>')
  
  html = html.replace(/\n\n/g, '</p><p class="my-4">')
  html = '<p class="my-4">' + html + '</p>'
  
  html = html.replace(/<p class="my-4"><\/p>/g, '')
  
  return html
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  
  try {
    const post = await getPostBySlug(slug)
    
    if (post) {
      const excerpt = post.excerpt || post.content.replace(/!\[.*?\]\(.*?\)/g, '').replace(/<[^>]+>/g, '').substring(0, 150)
      
      return {
        title: post.title,
        description: excerpt,
        keywords: post.tags?.map(t => t.name).join(', ') || 'blog, technology, life',
        openGraph: {
          title: post.title,
          description: excerpt,
          type: 'article',
          publishedTime: post.published_at,
          authors: [post.author?.name || ''].filter(Boolean),
          images: post.cover_image ? [{ url: post.cover_image, width: 1200, height: 630 }] : [],
        },
        twitter: {
          card: 'summary_large_image',
          title: post.title,
          description: excerpt,
          images: post.cover_image ? [post.cover_image] : [],
        },
      }
    }
  } catch (error) {
  }
  
  return {
    title: '文章不存在',
    description: '该文章不存在或已被删除',
  }
}

export default async function PostDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  
  const post = await getPostBySlug(slug)
  const comments = await getCommentsByPostSlug(slug)
  const currentUser = await getCurrentUser()
  
  if (!post) {
    notFound()
  }

  const firstImage = post.cover_image || extractFirstImage(post.content)

  return (
    <div className="min-h-screen bg-gray-50">
      {firstImage && (
        <div className="relative h-64 md:h-96 w-full">
          <Image
            src={firstImage}
            alt={post.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      <Container>
        <article className="max-w-3xl mx-auto -mt-8 relative z-10">
          <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
            <header className="mb-8">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                <time dateTime={post.published_at}>
                  {formatDate(post.published_at)}
                </time>
                <span>·</span>
                <span>{post.view_count} 阅读</span>
              </div>
              
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                {post.title}
              </h1>
              
              <div className="flex items-center gap-4">
                {post.author && (
                  <div className="flex items-center gap-2">
                    {post.author.avatar_url ? (
                      <Image
                        src={post.author.avatar_url}
                        alt={post.author.name}
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-sm font-medium">
                        {post.author.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-gray-600">{post.author.name}</span>
                  </div>
                )}
                
                {post.category && (
                  <>
                    <span>·</span>
                    <Link href={`/posts?category=${post.category.slug}`} className="text-primary-600 hover:text-primary-700">
                      {post.category.name}
                    </Link>
                  </>
                )}
              </div>
              
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {post.tags.map(tag => (
                    <Link
                      key={tag.id}
                      href={`/posts?tag=${tag.slug}`}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
                    >
                      {tag.name}
                    </Link>
                  ))}
                </div>
              )}
            </header>
            
            <div className="text-gray-700 leading-relaxed space-y-4">
              <div dangerouslySetInnerHTML={{ __html: renderContent(post.content) }} />
            </div>

            {post.tags && post.tags.length > 0 && (
              <footer className="mt-12 pt-8 border-t border-gray-200">
                <div className="flex flex-wrap gap-2">
                  {post.tags.map(tag => (
                    <Link
                      key={tag.id}
                      href={`/posts?tag=${tag.slug}`}
                      className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm hover:bg-gray-200 transition-colors"
                    >
                      {tag.name}
                    </Link>
                  ))}
                </div>
              </footer>
            )}
          </div>
        </article>
        
        <div className="mt-12 max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 mb-8">
          <CommentSection 
            postId={post.id} 
            initialComments={comments} 
            currentUser={currentUser}
          />
        </div>
      </Container>
    </div>
  )
}
