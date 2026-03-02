'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Container } from '@/components/ui/container'
import type { PostListItem } from '@/types'

interface HomePageClientProps {
  initialPosts: PostListItem[]
  initialHasMore: boolean
  siteTitle: string
  siteSubtitle: string
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export default function HomePageClient({ initialPosts, initialHasMore, siteTitle, siteSubtitle }: HomePageClientProps) {
  const [posts, setPosts] = useState<PostListItem[]>(initialPosts)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const loaderRef = useRef<HTMLDivElement>(null)

  const fetchPosts = useCallback(async (pageNum: number) => {
    try {
      setLoadingMore(true)
      
      const res = await fetch(`/api/posts?page=${pageNum}&limit=6`)
      const data = await res.json() as { 
        success: boolean 
        data: { 
          posts: PostListItem[] 
          pagination: { page: number; limit: number; total: number; total_pages: number }
        }
        error?: string 
      }
      
      if (data.success) {
        const newPosts = data.data.posts || []
        setPosts(prev => [...prev, ...newPosts])
        setHasMore(pageNum < data.data.pagination.total_pages)
        setPage(pageNum)
      } else {
        setError(data.error || '获取文章失败')
      }
    } catch {
      setError('获取文章失败')
    } finally {
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchPosts(page + 1)
        }
      },
      { threshold: 0.1 }
    )

    if (loaderRef.current) {
      observer.observe(loaderRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, loadingMore, page, fetchPosts])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <Container>
          <div className="py-16 text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{siteTitle}</h1>
            <p className="text-gray-600">{siteSubtitle}</p>
          </div>
        </Container>
      </div>

      <Container>
        <div className="py-12">
          {error && (
            <div className="mb-8 p-4 bg-red-50 text-red-600 rounded-lg text-center">
              {error}
            </div>
          )}

          {posts.length > 0 ? (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {posts.map((post) => {
                  const firstImage = post.cover_image || null
                  const excerpt = post.excerpt || ''
                  const postUrl = post.slug ? `/posts/${post.slug}` : `/posts/${post.id}`
                  
                  return (
                    <article 
                      key={post.id} 
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col"
                    >
                      {firstImage && (
                        <Link href={postUrl} className="block relative h-48 overflow-hidden">
                          <Image
                            src={firstImage}
                            alt={post.title}
                            fill
                            className="object-cover transition-transform duration-500 hover:scale-105"
                          />
                        </Link>
                      )}
                      <div className="p-6 flex-1 flex flex-col">
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                          <time dateTime={post.published_at}>
                            {formatDate(post.published_at)}
                          </time>
                          {post.category && (
                            <>
                              <span>·</span>
                              <span className="text-primary-600">{post.category.name}</span>
                            </>
                          )}
                        </div>
                        
                        <Link href={postUrl} className="block group">
                          <h2 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-primary-600 transition-colors line-clamp-2">
                            {post.title}
                          </h2>
                        </Link>
                        
                        <p className="text-gray-600 mb-4 line-clamp-3 flex-1">
                          {excerpt}
                        </p>
                        
                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                          <Link 
                            href={postUrl}
                            className="text-primary-600 font-medium hover:text-primary-700 transition-colors"
                          >
                            阅读全文 →
                          </Link>
                          <div className="flex items-center gap-1 text-gray-400 text-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            {post.view_count}
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>

              <div ref={loaderRef} className="mt-12 text-center">
                {loadingMore && (
                  <div className="flex justify-center items-center gap-2">
                    <div className="w-6 h-6 border-3 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-gray-500">加载更多...</span>
                  </div>
                )}
                {!hasMore && posts.length > 0 && (
                  <p className="text-gray-400">没有更多文章了</p>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📝</div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">暂无文章</h2>
              <p className="text-gray-500">敬请期待更多内容...</p>
            </div>
          )}
        </div>
      </Container>
    </div>
  )
}
