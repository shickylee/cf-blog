'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

const MDEditor = dynamic(
  () => import('@uiw/react-md-editor'),
  { ssr: false }
)

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

interface Post {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string | null
  cover_image: string | null
  category_id: string | null
  status: 'draft' | 'published' | 'archived'
}

export default function EditPostPage() {
  const router = useRouter()
  const params = useParams()
  const postId = params.id as string

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [content, setContent] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [creating, setCreating] = useState(false)
  
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<any>(null)
  const coverFileInputRef = useRef<HTMLInputElement>(null)
  const [coverUploading, setCoverUploading] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then<{ success: boolean; data: { categories: Category[] } }>(res => res.json()),
      fetch('/api/tags').then<{ success: boolean; data: { tags: Tag[] } }>(res => res.json()),
      fetch(`/api/posts/${postId}`).then<{ success: boolean; data: { post: Post } }>(res => res.json())
    ]).then(([categoriesData, tagsData, postData]) => {
      if (categoriesData.success) {
        setCategories(categoriesData.data.categories || [])
      }
      if (tagsData.success) {
        setTags(tagsData.data.tags || [])
      }
      if (postData.success && postData.data.post) {
        const post = postData.data.post
        setTitle(post.title)
        setSlug(post.slug || '')
        setContent(post.content)
        setExcerpt(post.excerpt || '')
        setCoverImage(post.cover_image || '')
        setCategoryId(post.category_id || '')
        setStatus(post.status as 'draft' | 'published')
      }
    }).catch(() => {
      setError('加载数据失败')
    }).finally(() => {
      setLoading(false)
    })
  }, [postId])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('access_token='))
        ?.split('=')[1]

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData
      })

      const data = await res.json() as { success: boolean; data?: { url: string }; error?: string }

      if (data.success && data.data?.url) {
        const imageMarkdown = `![${file.name}](${data.data.url})`
        
        if (editorRef.current?.insertText) {
          editorRef.current.insertText(imageMarkdown)
        } else if (editorRef.current?.textarea) {
          const textarea = editorRef.current.textarea
          const start = textarea.selectionStart
          const end = textarea.selectionEnd
          const text = textarea.value
          
          const newText = text.substring(0, start) + imageMarkdown + text.substring(end)
          setContent(newText)
          
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + imageMarkdown.length
          }, 0)
        } else {
          setContent(prev => prev + '\n' + imageMarkdown)
        }
      } else {
        setError(data.error || '上传图片失败')
      }
    } catch {
      setError('上传图片失败')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCoverUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('access_token='))
        ?.split('=')[1]

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData
      })

      const data = await res.json() as { success: boolean; data?: { url: string }; error?: string }

      if (data.success && data.data?.url) {
        setCoverImage(data.data.url)
      } else {
        setError(data.error || '上传图片失败')
      }
    } catch {
      setError('上传图片失败')
    } finally {
      setCoverUploading(false)
      if (coverFileInputRef.current) {
        coverFileInputRef.current.value = ''
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('access_token='))
        ?.split('=')[1]

      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          title,
          slug: slug || undefined,
          content,
          excerpt: excerpt || undefined,
          cover_image: coverImage || null,
          category_id: categoryId || null,
          tag_ids: selectedTags.length > 0 ? selectedTags : undefined,
          status
        })
      })

      const data = await res.json() as { success: boolean; error?: string }

      if (data.success) {
        router.push('/admin/posts')
      } else {
        setError(data.error || '更新文章失败')
      }
    } catch {
      setError('更新文章失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleTagChange = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    
    setCreating(true)
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('access_token='))
        ?.split('=')[1]

      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ name: newTagName.trim() })
      })

      const data = await res.json() as { success: boolean; data?: { tag: Tag }; error?: string }

      if (data.success && data.data?.tag) {
        setTags(prev => [...prev, data.data!.tag])
        setSelectedTags(prev => [...prev, data.data!.tag.id])
        setNewTagName('')
      } else {
        setError(data.error || '创建标签失败')
      }
    } catch {
      setError('创建标签失败')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">加载中...</div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">编辑文章</h2>
        <Link href="/admin/posts">
          <Button variant="outline">返回列表</Button>
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">标题 *</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="请输入文章标题"
                      required
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="slug">Slug（可选）</Label>
                    <Input
                      id="slug"
                      value={slug}
                      onChange={e => setSlug(e.target.value)}
                      placeholder="留空则自动生成，如：my-article"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">用于文章 URL，如：/posts/your-slug</p>
                  </div>
                  
                  <div>
                    <Label htmlFor="excerpt">摘要</Label>
                    <Input
                      id="excerpt"
                      value={excerpt}
                      onChange={e => setExcerpt(e.target.value)}
                      placeholder="请输入文章摘要（可选）"
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="content">内容 *</Label>
                      <div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleImageUpload}
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          className="hidden"
                          id="image-upload"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          {uploading ? '上传中...' : '上传图片'}
                        </Button>
                      </div>
                    </div>
                    <div data-color-mode="light">
                      <MDEditor
                        ref={editorRef}
                        value={content}
                        onChange={(val) => setContent(val || '')}
                        height={500}
                        preview="edit"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">发布设置</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="coverImage">封面图 URL</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="coverImage"
                        value={coverImage}
                        onChange={e => setCoverImage(e.target.value)}
                        placeholder="输入封面图 URL 或点击上传"
                        className="flex-1 min-w-0"
                      />
                      <input
                        type="file"
                        ref={coverFileInputRef}
                        onChange={handleCoverImageUpload}
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        id="cover-image-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => coverFileInputRef.current?.click()}
                        disabled={coverUploading}
                        className="whitespace-nowrap"
                      >
                        {coverUploading ? '上传中...' : '+ 上传'}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="status">状态</Label>
                    <Select
                      id="status"
                      value={status}
                      onChange={e => setStatus(e.target.value as 'draft' | 'published')}
                      className="mt-1"
                    >
                      <option value="draft">草稿</option>
                      <option value="published">已发布</option>
                    </Select>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="flex-1"
                    >
                      {submitting ? '提交中...' : '更新文章'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">分类</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className="w-full"
                >
                  <option value="">选择分类</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">标签</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={newTagName}
                      onChange={e => setNewTagName(e.target.value)}
                      placeholder="新标签名称"
                      className="flex-1 min-w-0"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleCreateTag()
                        }
                      }}
                    />
                    <Button
                      type="button"
                      onClick={handleCreateTag}
                      disabled={!newTagName.trim() || creating}
                      className="whitespace-nowrap"
                    >
                      {creating ? '创建中...' : '+ 添加'}
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {tags.map(tag => (
                      <label key={tag.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag.id)}
                          onChange={() => handleTagChange(tag.id)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{tag.name}</span>
                      </label>
                    ))}
                    {tags.length === 0 && (
                      <p className="text-sm text-gray-500">暂无标签，请先创建</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  )
}
