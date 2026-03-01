'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Container } from '@/components/ui/container'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar } from '@/components/ui/avatar'

interface Author {
  id: string
  name: string
  avatar_url: string | null
}

interface Category {
  id: string
  name: string
  slug: string
}

interface Tag {
  id: string
  name: string
  slug: string
}

interface User {
  id: string
  name: string
  avatar_url: string | null
}

interface Comment {
  id: string
  content: string
  post_id: string
  user_id: string
  parent_id: string | null
  status: string
  created_at: string
  user: User
  replies?: Comment[]
}

interface Post {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string | null
  cover_image: string | null
  author_id: string
  category_id: string | null
  status: string
  view_count: number
  published_at: string
  created_at: string
  updated_at: string
  author?: Author
  category?: Category | null
  tags?: Tag[]
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function formatCommentDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  if (diffDays < 30) return `${diffDays} 天前`
  return formatDate(dateString)
}

function CommentItem({ 
  comment, 
  postId, 
  currentUser, 
  onReplySuccess,
  depth = 0 
}: { 
  comment: Comment
  postId: string
  currentUser: User | null
  onReplySuccess: () => void
  depth?: number
}) {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [replyName, setReplyName] = useState('')
  const [replyEmail, setReplyEmail] = useState('')

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyContent.trim()) {
      setError('请输入回复内容')
      return
    }

    const isGuest = !currentUser
    if (isGuest) {
      if (!replyName.trim()) {
        setError('请输入昵称')
        return
      }
      if (!replyEmail.trim()) {
        setError('请输入邮箱')
        return
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(replyEmail)) {
        setError('请输入有效的邮箱地址')
        return
      }
    }

    setSubmitting(true)
    setError('')

    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('access_token='))
        ?.split('=')[1]

      const res = await fetch(`/api/comments/posts/${postId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          content: replyContent,
          parent_id: comment.id,
          ...(isGuest ? { name: replyName, email: replyEmail } : {})
        })
      })

      const data = await res.json() as { success: boolean; error?: string }

      if (data.success) {
        setReplyContent('')
        setReplyName('')
        setReplyEmail('')
        setShowReplyForm(false)
        onReplySuccess()
      } else {
        setError(data.error || '回复失败')
      }
    } catch {
      setError('回复失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`${depth > 0 ? 'ml-8 pl-4 border-l-2 border-gray-200' : ''}`}>
      <div className="flex gap-3 py-3">
        <Avatar
          src={comment.user.avatar_url}
          name={comment.user.name}
          size={36}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-900 text-sm">{comment.user.name}</span>
            <span className="text-gray-400 text-xs">{formatCommentDate(comment.created_at)}</span>
          </div>
          <p className="text-gray-700 whitespace-pre-wrap text-sm">{comment.content}</p>
          
          <button
            onClick={() => setShowReplyForm(!showReplyForm)}
            className="text-gray-500 text-xs hover:text-primary-600 mt-2"
          >
            回复
          </button>

          {showReplyForm && (
            <form onSubmit={handleReplySubmit} className="mt-3">
              {!currentUser && (
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    type="text"
                    value={replyName}
                    onChange={(e) => setReplyName(e.target.value)}
                    placeholder="昵称 *"
                    className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-xs"
                    required
                  />
                  <input
                    type="email"
                    value={replyEmail}
                    onChange={(e) => setReplyEmail(e.target.value)}
                    placeholder="邮箱 *"
                    className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-xs"
                    required
                  />
                </div>
              )}
              <Textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={`回复 @${comment.user.name}...`}
                className="min-h-[80px] text-sm mb-2"
              />
              {error && (
                <p className="text-red-500 text-xs mb-2">{error}</p>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting} size="sm">
                  {submitting ? '提交中...' : '回复'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setShowReplyForm(false)
                    setReplyContent('')
                    setError('')
                  }}
                >
                  取消
                </Button>
              </div>
            </form>
          )}

          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3 space-y-2">
              {comment.replies.map(reply => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  postId={postId}
                  currentUser={currentUser}
                  onReplySuccess={onReplySuccess}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PostDetailPage() {
  const params = useParams()
  const slug = params.slug as string

  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  const [commentContent, setCommentContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json() as { success: boolean; data: { user: User }; error?: string }
      if (data.success) {
        setIsLoggedIn(true)
        setUser(data.data.user)
      }
    } catch {
      setIsLoggedIn(false)
    }
  }, [])

  const fetchPost = useCallback(async (postSlug: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/posts/${postSlug}`)
      const data = await res.json() as { 
        success: boolean 
        data: { post: Post }
        error?: string 
      }
      
      if (data.success && data.data.post) {
        setPost(data.data.post)
      } else {
        setError(data.error || '文章不存在')
      }
    } catch {
      setError('加载文章失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuth()
    if (slug) {
      fetchPost(slug)
    }
  }, [slug, checkAuth, fetchPost])

  useEffect(() => {
    if (post?.id) {
      fetchComments()
    }
  }, [post?.id, fetchComments])

  const fetchComments = useCallback(async () => {
    if (!post?.id) return
    try {
      const res = await fetch(`/api/comments/posts/${post.id}`)
      const data = await res.json() as {
        success: boolean
        data: { comments: Comment[] }
      }
      if (data.success) {
        setComments(data.data.comments || [])
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err)
    }
  }, [post?.id])

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentContent.trim()) {
      setCommentError('请输入评论内容')
      return
    }
    if (!post?.id) return

    setSubmitting(true)
    setCommentError('')

    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('access_token='))
        ?.split('=')[1]

      const res = await fetch(`/api/comments/posts/${post.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ content: commentContent })
      })

      const data = await res.json() as { success: boolean; error?: string }

      if (data.success) {
        setCommentContent('')
        fetchComments()
      } else {
        setCommentError(data.error || '发表评论失败')
      }
    } catch {
      setCommentError('发表评论失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGuestCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentContent.trim()) {
      setCommentError('请输入评论内容')
      return
    }
    if (!guestName.trim()) {
      setCommentError('请输入昵称')
      return
    }
    if (!guestEmail.trim()) {
      setCommentError('请输入邮箱')
      return
    }
    if (!post?.id) return

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(guestEmail)) {
      setCommentError('请输入有效的邮箱地址')
      return
    }

    setSubmitting(true)
    setCommentError('')

    try {
      const res = await fetch(`/api/comments/posts/${post.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          content: commentContent,
          name: guestName,
          email: guestEmail
        })
      })

      const data = await res.json() as { success: boolean; error?: string }

      if (data.success) {
        setCommentContent('')
        setGuestName('')
        setGuestEmail('')
        fetchComments()
      } else {
        setCommentError(data.error || '发表评论失败')
      }
    } catch {
      setCommentError('发表评论失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Container>
          <div className="py-12 flex justify-center">
            <div className="animate-pulse flex flex-col items-center">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-500">加载中...</p>
            </div>
          </div>
        </Container>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Container>
          <div className="py-12 text-center">
            <div className="text-6xl mb-4">📄</div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">{error || '文章不存在'}</h2>
          </div>
        </Container>
      </div>
    )
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
                {post.category && (
                  <>
                    <span>·</span>
                    <Link 
                      href={`/posts?category=${post.category.slug}`}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      {post.category.name}
                    </Link>
                  </>
                )}
                <span>·</span>
                <span>{post.view_count} 次阅读</span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                {post.title}
              </h1>

              {post.author && (
                <div className="flex items-center gap-3">
                  <Avatar
                    src={post.author.avatar_url}
                    name={post.author.name}
                    size={40}
                  />
                  <span className="text-gray-700">{post.author.name}</span>
                </div>
              )}
            </header>

            <div 
              className="prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{ __html: renderContent(post.content) }}
            />

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

          <div className="mt-12 bg-white rounded-2xl shadow-sm p-8 mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              评论
            </h3>

            {isLoggedIn ? (
              <form onSubmit={handleCommentSubmit} className="mb-8">
                <div className="flex items-start gap-4">
                  <Avatar
                    src={user?.avatar_url}
                    name={user?.name || 'User'}
                    size={40}
                  />
                  <div className="flex-1">
                    <Textarea
                      value={commentContent}
                      onChange={(e) => setCommentContent(e.target.value)}
                      placeholder="写下你的评论..."
                      className="min-h-[100px] mb-3"
                    />
                    {commentError && (
                      <p className="text-red-500 text-sm mb-2">{commentError}</p>
                    )}
                    <Button type="submit" disabled={submitting}>
                      {submitting ? '提交中...' : '发表评论'}
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleGuestCommentSubmit} className="mb-8 p-6 bg-gray-50 rounded-xl">
                <h4 className="text-base font-medium text-gray-900 mb-4">发表评论</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="昵称 *"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                      required
                    />
                  </div>
                  <div>
                    <input
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="邮箱 * (用于生成头像)"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                      required
                    />
                  </div>
                </div>
                <Textarea
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  placeholder="写下你的评论..."
                  className="min-h-[100px] mb-3"
                />
                {commentError && (
                  <p className="text-red-500 text-sm mb-2">{commentError}</p>
                )}
                <Button type="submit" disabled={submitting}>
                  {submitting ? '提交中...' : '发表评论'}
                </Button>
                <p className="text-gray-400 text-xs mt-2">发表评论即表示同意展示您的头像</p>
              </form>
            )}

            <div className="divide-y divide-gray-100">
              {comments.length > 0 ? (
                comments.map(comment => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    postId={post.id}
                    currentUser={user}
                    onReplySuccess={fetchComments}
                  />
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">暂无评论，快来抢沙发吧！</p>
              )}
            </div>
          </div>
        </article>
      </Container>
    </div>
  )
}

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
  html = html.replace(/<p class="my-4"><h/g, '<h')
  html = html.replace(/<\/h[1-6]><\/p>/g, '</h1>')
  html = html.replace(/<p class="my-4"><ul/g, '<ul')
  html = html.replace(/<\/ul><\/p>/g, '</ul>')
  html = html.replace(/<p class="my-4"><ol/g, '<ol')
  html = html.replace(/<\/ol><\/p>/g, '</ol>')
  html = html.replace(/<p class="my-4"><blockquote/g, '<blockquote')
  html = html.replace(/<\/blockquote><\/p>/g, '</blockquote>')
  html = html.replace(/<p class="my-4"><img/g, '<img')
  html = html.replace(/><\/p>/g, '>')
  
  return html
}
