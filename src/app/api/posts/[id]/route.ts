import { NextRequest } from 'next/server'
import { getEnv, successResponse, errorResponse, withRole } from '@/lib/api'
import { extractExcerpt } from '@/lib/utils'
import { z } from 'zod'
import type { User, Post, Tag } from '@/types'

const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().max(100).regex(/^[a-z0-9-]+$/).optional(),
  content: z.string().min(1).optional(),
  excerpt: z.string().max(500).optional(),
  cover_image: z.string().url().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  tag_ids: z.array(z.string().uuid()).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  try {
    const env = getEnv()
    const { id } = await params
    
    let post: Post | undefined
    let actualId = id
    
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    
    if (isUuid) {
      const result = await env.DB.prepare(
        'SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL'
      ).bind(id).first<Post>()
      post = result ?? undefined
      actualId = id
    } else {
      const result = await env.DB.prepare(
        'SELECT * FROM posts WHERE slug = ? AND status = ? AND deleted_at IS NULL'
      ).bind(id, 'published').first<Post>()
      post = result ?? undefined
      actualId = post?.id || id
    }
    
    if (!post) {
      return errorResponse('文章不存在', 404, 'NOT_FOUND')
    }
    
    await env.DB.prepare(
      'UPDATE posts SET view_count = view_count + 1 WHERE id = ?'
    ).bind(actualId).run()
    
    const updatedPost = await env.DB.prepare(
      'SELECT view_count FROM posts WHERE id = ?'
    ).bind(actualId).first<{ view_count: number }>()
    
    const currentViewCount = updatedPost?.view_count || post.view_count
    
    const author = await env.DB.prepare(
      'SELECT id, name, avatar_url FROM users WHERE id = ?'
    ).bind(post.author_id).first<{ id: string; name: string; avatar_url: string | null }>()
    
    let category = null
    if (post.category_id) {
      category = await env.DB.prepare(
        'SELECT id, name, slug FROM categories WHERE id = ?'
      ).bind(post.category_id).first<{ id: string; name: string; slug: string }>()
    }
    
    const tags = await env.DB.prepare(`
      SELECT t.id, t.name, t.slug 
      FROM tags t
      JOIN post_tags pt ON t.id = pt.tag_id
      WHERE pt.post_id = ?
    `).bind(actualId).all<Tag>()
    
    return successResponse({
      post: {
        ...post,
        view_count: currentViewCount,
        author,
        category,
        tags: tags.results,
      },
    })
  } catch (error) {
    console.error('Get post error:', error)
    return errorResponse('获取文章失败', 500)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  return withRole(request, ['author', 'admin'], async (user: User, env) => {
    try {
      const { id } = await params
      const body = await request.json()
      const validationResult = updatePostSchema.safeParse(body)
      
      if (!validationResult.success) {
        return errorResponse('参数验证失败', 400, 'VALIDATION_ERROR',
          validationResult.error.flatten().fieldErrors as Record<string, string[]>)
      }
      
      const existing = await env.DB.prepare(
        'SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL'
      ).bind(id).first<Post>()
      
      if (!existing) {
        return errorResponse('文章不存在', 404, 'NOT_FOUND')
      }
      
      if (existing.author_id !== user.id && user.role !== 'admin') {
        return errorResponse('无权编辑此文章', 403, 'FORBIDDEN')
      }
      
      const { title, slug: providedSlug, content, excerpt, cover_image, category_id, tag_ids, status } = validationResult.data
      const updates: string[] = []
      const values: unknown[] = []
      
      if (title !== undefined) {
        updates.push('title = ?')
        values.push(title)
      }
      
      if (providedSlug !== undefined) {
        const slugExists = await env.DB.prepare(
          'SELECT id FROM posts WHERE slug = ? AND id != ? AND deleted_at IS NULL'
        ).bind(providedSlug, id).first()
        
        if (slugExists) {
          return errorResponse('文章 Slug 已存在，请使用其他 Slug', 400, 'SLUG_EXISTS')
        }
        
        updates.push('slug = ?')
        values.push(providedSlug)
      }
      
      if (content !== undefined) {
        updates.push('content = ?')
        values.push(content)
        if (!excerpt) {
          updates.push('excerpt = ?')
          values.push(extractExcerpt(content))
        }
      }
      
      if (excerpt !== undefined) {
        updates.push('excerpt = ?')
        values.push(excerpt)
      }
      
      if (cover_image !== undefined) {
        updates.push('cover_image = ?')
        values.push(cover_image)
      }
      
      if (category_id !== undefined) {
        updates.push('category_id = ?')
        values.push(category_id)
      }
      
      if (status !== undefined) {
        updates.push('status = ?')
        values.push(status)
        
        if (status === 'published' && !existing.published_at) {
          updates.push('published_at = ?')
          values.push(new Date().toISOString())
        }
      }
      
      if (updates.length === 0 && !tag_ids) {
        return successResponse({ post: existing })
      }
      
      updates.push('updated_at = ?')
      values.push(new Date().toISOString())
      values.push(id)
      
      await env.DB.prepare(
        `UPDATE posts SET ${updates.join(', ')} WHERE id = ?`
      ).bind(...values).run()
      
      if (tag_ids !== undefined) {
        await env.DB.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(id).run()
        for (const tagId of tag_ids) {
          await env.DB.prepare(
            'INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)'
          ).bind(id, tagId).run()
        }
      }
      
      const post = await env.DB.prepare(
        'SELECT * FROM posts WHERE id = ?'
      ).bind(id).first<Post>()
      
      return successResponse({ post })
    } catch (error) {
      console.error('Update post error:', error)
      return errorResponse('更新文章失败', 500)
    }
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  return withRole(request, ['author', 'admin'], async (user: User, env) => {
    try {
      const { id } = await params
      
      const existing = await env.DB.prepare(
        'SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL'
      ).bind(id).first<Post>()
      
      if (!existing) {
        return errorResponse('文章不存在', 404, 'NOT_FOUND')
      }
      
      if (existing.author_id !== user.id && user.role !== 'admin') {
        return errorResponse('无权删除此文章', 403, 'FORBIDDEN')
      }
      
      await env.DB.prepare(
        'UPDATE posts SET deleted_at = ? WHERE id = ?'
      ).bind(new Date().toISOString(), id).run()
      
      return successResponse({ message: '文章已删除' })
    } catch (error) {
      console.error('Delete post error:', error)
      return errorResponse('删除文章失败', 500)
    }
  })
}
