import { NextRequest } from 'next/server'
import { getEnv, successResponse, errorResponse, getUserFromRequest } from '@/lib/api'
import { generateUUID, generateSlug, extractExcerpt } from '@/lib/utils'
import { z } from 'zod'
import type { User, Post, Tag } from '@/types'

const updatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  excerpt: z.string().max(500).optional(),
  cover_image: z.string().url().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  tag_ids: z.array(z.string().uuid()).optional(),
  status: z.enum(['draft', 'published']).optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params
  try {
    const env = getEnv()
    const user = await getUserFromRequest(request, env)
    
    if (!user) {
      return errorResponse('未登录', 401, 'UNAUTHORIZED')
    }

    const post = await env.DB.prepare(`
      SELECT p.*, 
             u.name as author_name,
             c.name as category_name,
             c.slug as category_slug
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ? AND p.deleted_at IS NULL
    `).bind(id).first<Post>()
    
    if (!post) {
      return errorResponse('文章不存在', 404, 'NOT_FOUND')
    }

    if (post.author_id !== user.id) {
      return errorResponse('无权访问此文章', 403, 'FORBIDDEN')
    }

    const tagsResult = await env.DB.prepare(`
      SELECT t.* FROM tags t
      JOIN post_tags pt ON t.id = pt.tag_id
      WHERE pt.post_id = ?
    `).bind(post.id).all()
    post.tags = (tagsResult.results || []) as unknown as { id: string; name: string; slug: string }[]

    return successResponse({ post })
  } catch (error) {
    console.error('Get user post error:', error)
    return errorResponse('获取文章失败', 500, 'INTERNAL_ERROR')
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params
  try {
    const env = getEnv()
    const user = await getUserFromRequest(request, env)
    
    if (!user) {
      return errorResponse('未登录', 401, 'UNAUTHORIZED')
    }

    const existingPost = await env.DB.prepare('SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL')
      .bind(id)
      .first<Post>()
    
    if (!existingPost) {
      return errorResponse('文章不存在', 404, 'NOT_FOUND')
    }

    if (existingPost.author_id !== user.id) {
      return errorResponse('无权编辑此文章', 403, 'FORBIDDEN')
    }

    const body = await request.json()
    const validationResult = updatePostSchema.safeParse(body)
    
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error.flatten())
      return errorResponse('参数验证失败', 400, 'VALIDATION_ERROR',
        validationResult.error.flatten().fieldErrors as Record<string, string[]>)
    }
    
    const { title, content, excerpt, cover_image, category_id, tag_ids, status } = validationResult.data
    
    const now = new Date().toISOString()
    const postExcerpt = excerpt || extractExcerpt(content)
    const postStatus = status || existingPost.status
    const publishedAt = postStatus === 'published' ? now : existingPost.published_at
    
    const newSlug = generateSlug(title)
    const slugChanged = newSlug !== existingPost.slug
    if (slugChanged) {
      const slugExists = await env.DB.prepare(
        'SELECT id FROM posts WHERE slug = ? AND id != ? AND deleted_at IS NULL'
      ).bind(newSlug, id).first()
      
      if (slugExists) {
        return errorResponse('文章 Slug 已存在，请修改标题', 400, 'SLUG_EXISTS')
      }
    }

    await env.DB.prepare(`
      UPDATE posts 
      SET title = ?, slug = ?, content = ?, excerpt = ?, cover_image = ?, category_id = ?, status = ?, published_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(title, newSlug, content, postExcerpt, cover_image || null, category_id || null, postStatus, publishedAt, now, id).run()

    const maxVersion = await env.DB.prepare(`
      SELECT MAX(version) as max_version FROM post_versions WHERE post_id = ?
    `).bind(id).first<{ max_version: number }>()
    const newVersion = (maxVersion?.max_version || 0) + 1

    await env.DB.prepare(`
      INSERT INTO post_versions (id, post_id, title, content, excerpt, cover_image, category_id, tag_ids, version, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(generateUUID(), id, title, content, postExcerpt, cover_image || null, category_id || null, JSON.stringify(tag_ids || []), newVersion, user.id, now).run()

    await env.DB.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(id).run()
    
    if (tag_ids && tag_ids.length > 0) {
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
    return errorResponse('更新文章失败', 500, 'INTERNAL_ERROR')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params
  try {
    const env = getEnv()
    const user = await getUserFromRequest(request, env)
    
    if (!user) {
      return errorResponse('未登录', 401, 'UNAUTHORIZED')
    }

    const post = await env.DB.prepare('SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL')
      .bind(id)
      .first<Post>()
    
    if (!post) {
      return errorResponse('文章不存在', 404, 'NOT_FOUND')
    }

    if (post.author_id !== user.id) {
      return errorResponse('无权删除此文章', 403, 'FORBIDDEN')
    }

    const now = new Date().toISOString()
    await env.DB.prepare('UPDATE posts SET deleted_at = ? WHERE id = ?').bind(now, id).run()
    
    return successResponse({ message: '文章已删除' })
  } catch (error) {
    console.error('Delete post error:', error)
    return errorResponse('删除文章失败', 500, 'INTERNAL_ERROR')
  }
}
