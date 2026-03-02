'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Container } from '@/components/ui/container'
import type { PostListItem, CategoryGroup } from '@/types'

interface PostListClientProps {
  initialPosts: PostListItem[]
  initialHasMore: boolean
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export default function PostListClient({ initialPosts, initialHasMore }: PostListClientProps) {
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [allPosts, setAllPosts] = useState<PostListItem[]>(initialPosts)
  const loaderRef = useRef<HTMLDivElement>(null)

  const fetchPosts = useCallback(async (pageNum: number) => {
    try {
      setLoadingMore(true)
      
      const res = await fetch(`/api/posts?page=${pageNum}&limit=12`)
      const data = await res.json() as { 
        success: boolean 
        data: { 
          posts: PostListItem[] 
          pagination: { page: number; limit: number; total: number; total_pages: number }
        }
      }
      
      if (data.success) {
        const newPosts = data.data.posts || []
        const updatedPosts = [...allPosts, ...newPosts]
        setAllPosts(updatedPosts)
        
        const grouped = groupPostsByCategory(updatedPosts)
        setCategoryGroups(grouped)
        
        setHasMore(pageNum < data.data.pagination.total_pages)
        setPage(pageNum)
      }
    } finally {
      setLoadingMore(false)
    }
  }, [allPosts])

  const groupPostsByCategory = (posts: PostListItem[]): CategoryGroup[] => {
    const categoryMap = new Map<string, CategoryGroup>()
    
    posts.forEach(post => {
      const categoryName = post.category?.name || '未分类'
      const categorySlug = post.category?.slug || 'uncategorized'
      
      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          name: categoryName,
          slug: categorySlug,
          posts: []
        })
      }
      
      categoryMap.get(categoryName)!.posts.push(post)
    })
    
    return Array.from(categoryMap.values())
  }

  useEffect(() => {
    const grouped = groupPostsByCategory(allPosts)
    setCategoryGroups(grouped)
  }, [allPosts])

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
            <h1 className="text-4xl font-bold text-gray-900 mb-4">文章归档</h1>
            <p className="text-gray-600">探索所有文章，按分类浏览</p>
          </div>
        </Container>
      </div>

      <Container>
        <div className="py-12 pb-24">
          {categoryGroups.length > 0 ? (
            <>
              <div className="space-y-16">
                {categoryGroups.map((category) => (
                  <section key={category.name} className="relative">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">{category.name}</h2>
                        <p className="text-gray-500 text-sm">{category.posts.length} 篇文章</p>
                      </div>
                    </div>
                    
                    <div className="grid gap-6">
                      {category.posts.map((post) => {
                        const firstImage = post.cover_image || null
                        const excerpt = post.excerpt || ''
                        const postUrl = post.slug ? `/posts/${post.slug}` : `/posts/${post.id}`
                        
                        return (
                          <article 
                            key={post.id}
                            className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300"
                          >
                            <div className="md:flex">
                              {firstImage && (
                                <div className="md:w-64 h-48 md:h-auto relative overflow-hidden flex-shrink-0">
                                  <Image
                                    src={firstImage}
                                    alt={post.title}
                                    fill
                                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                                  />
                                </div>
                              )}
                              <div className="flex-1 p-6">
                                <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
                                  <time dateTime={post.published_at}>
                                    {formatDate(post.published_at)}
                                  </time>
                                  <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                                  <span className="text-primary-600">{post.view_count} 阅读</span>
                                </div>
                                
                                <Link href={postUrl}>
                                  <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-primary-600 transition-colors line-clamp-1">
                                    {post.title}
                                  </h3>
                                </Link>
                                
                                <p className="text-gray-600 mb-4 line-clamp-2 text-sm leading-relaxed">
                                  {excerpt}
                                </p>
                                
                                <div className="flex items-center justify-between">
                                  <Link 
                                    href={postUrl}
                                    className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 transition-colors text-sm font-medium"
                                  >
                                    阅读全文
                                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                  </Link>
                                  
                                  {post.tags && post.tags.length > 0 && (
                                    <div className="flex gap-2">
                                      {post.tags.slice(0, 2).map(tag => (
                                        <span 
                                          key={tag.id}
                                          className="px-2 py-1 text-xs bg-primary-50 text-primary-600 rounded-full"
                                        >
                                          {tag.name}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>

              <div ref={loaderRef} className="mt-16 text-center">
                {loadingMore && (
                  <div className="flex justify-center items-center gap-3">
                    <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-gray-500">加载更多...</span>
                  </div>
                )}
                {!hasMore && categoryGroups.length > 0 && (
                  <p className="text-gray-400">— 已加载全部文章 —</p>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <div className="text-6xl mb-6">📚</div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-3">暂无文章</h2>
              <p className="text-gray-500">敬请期待更多内容...</p>
            </div>
          )}
        </div>
      </Container>
    </div>
  )
}
