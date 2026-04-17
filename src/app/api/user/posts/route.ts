import { NextRequest } from 'next/server'
import { getEnv, successResponse, errorResponse, getUserFromRequest } from '@/lib/api'
import { generateUUID, generateSlug, extractExcerpt } from '@/lib/utils'
import { z } from 'zod'
import type { User, Post } from '@/types'

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  excerpt: z.string().max(500).optional(),
  cover_image: z.string().url().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  tag_ids: z.array(z.string().uuid()).optional(),
  status: z.enum(['draft', 'published']).optional(),
})

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const env = getEnv()
    const user = await getUserFromRequest(request, env)
    
    if (!user) {
      return errorResponse('未登录', 401, 'UNAUTHORIZED')
    }

    const url = new URL(request.url)
    const status = url.searchParams.get('status') as 'draft' | 'published' | 'pending' | null
    const moderationStatus = url.searchParams.get('moderation_status') as 'pending' | 'approved' | 'rejected' | null
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    let query = `
      SELECT p.*, 
             u.name as author_name,
             c.name as category_name,
             c.slug as category_slug
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.author_id = ? AND p.deleted_at IS NULL
    `
    const params: any[] = [user.id]

    if (status) {
      query += ' AND p.status = ?'
      params.push(status)
    }

    if (moderationStatus) {
      query += ' AND p.moderation_status = ?'
      params.push(moderationStatus)
    }

    query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const postsResult = await env.DB.prepare(query).bind(...params).all()
    const posts = (postsResult.results || []) as unknown as (Post & { author_name: string; category_name?: string; category_slug?: string })[]

    let countQueryStr = `
      SELECT COUNT(*) as total
      FROM posts
      WHERE author_id = ? AND deleted_at IS NULL
    `
    const countParams: any[] = [user.id]

    if (status) {
      countQueryStr += ' AND status = ?'
      countParams.push(status)
    }

    if (moderationStatus) {
      countQueryStr += ' AND moderation_status = ?'
      countParams.push(moderationStatus)
    }

    const countResult = await env.DB.prepare(countQueryStr).bind(...countParams).first<{ total: number }>()
    const total = countResult?.total || 0

    const postsWithTags = []
    for (const post of posts) {
      const tags = await env.DB.prepare(`
        SELECT t.* FROM tags t
        JOIN post_tags pt ON t.id = pt.tag_id
        WHERE pt.post_id = ?
      `).bind(post.id).all()
      post.tags = (tags.results || []) as unknown as { id: string; name: string; slug: string }[]
      postsWithTags.push(post)
    }

    return successResponse({
      posts: postsWithTags,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get user posts error:', error)
    return errorResponse('获取文章列表失败', 500, 'INTERNAL_ERROR')
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const env = getEnv()
    const user = await getUserFromRequest(request, env)
    
    if (!user) {
      return errorResponse('未登录', 401, 'UNAUTHORIZED')
    }

    const body = await request.json()
    const validationResult = createPostSchema.safeParse(body)
    
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error.flatten())
      return errorResponse('参数验证失败', 400, 'VALIDATION_ERROR',
        validationResult.error.flatten().fieldErrors as Record<string, string[]>)
    }
    
    const { title, content, excerpt, cover_image, category_id, tag_ids, status } = validationResult.data
    
    const slug = generateSlug(title)
    const slugExists = await env.DB.prepare(
      'SELECT id FROM posts WHERE slug = ? AND deleted_at IS NULL'
    ).bind(slug).first()
    
    if (slugExists) {
      return errorResponse('文章 Slug 已存在，请修改标题', 400, 'SLUG_EXISTS')
    }
    
    const id = generateUUID()
    const now = new Date().toISOString()
    const postExcerpt = excerpt || extractExcerpt(content)
    const postStatus = status || 'draft'
    const publishedAt = postStatus === 'published' ? now : null
    
    await env.DB.prepare(`
      INSERT INTO posts (id, title, slug, content, excerpt, cover_image, author_id, category_id, status, published_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, title, slug, content, postExcerpt, cover_image || null, user.id, category_id || null, postStatus, publishedAt, now, now).run()
    
    if (tag_ids && tag_ids.length > 0) {
      for (const tagId of tag_ids) {
        await env.DB.prepare(
          'INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)'
        ).bind(id, tagId).run()
      }
    }

    await env.DB.prepare(`
      INSERT INTO post_versions (id, post_id, title, content, excerpt, cover_image, category_id, tag_ids, version, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).bind(generateUUID(), id, title, content, postExcerpt, cover_image || null, category_id || null, JSON.stringify(tag_ids || []), user.id, now).run()
    
    const post = await env.DB.prepare(
      'SELECT * FROM posts WHERE id = ?'
    ).bind(id).first<Post>()
    
    return successResponse({ post }, 201)
  } catch (error) {
    console.error('Create post error:', error)
    return errorResponse('创建文章失败', 500, 'INTERNAL_ERROR')
  }
}
