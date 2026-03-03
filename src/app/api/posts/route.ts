import { NextRequest } from 'next/server'
import { getEnv, successResponse, errorResponse, withAuth, withRole } from '@/lib/api'
import { generateUUID, generateSlug, extractExcerpt } from '@/lib/utils'
import { z } from 'zod'
import type { User, Post, Category, Tag, PostListItem } from '@/types'

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().max(100).regex(/^[a-z0-9-]+$/).optional(),
  content: z.string().min(1),
  excerpt: z.string().max(500).optional(),
  cover_image: z.string().url().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  tag_ids: z.array(z.string().uuid()).optional(),
  status: z.enum(['draft', 'published']),
})

interface PostWithRelations extends Post {
  author?: { id: string; name: string; avatar_url: string | null }
  category?: Category | null
  tags?: Tag[]
}

interface PostListItemWithRelations extends PostListItem {
  author?: { id: string; name: string; avatar_url: string | null }
  category?: Category | null
  tags?: Tag[]
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const env = getEnv()
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const tag = searchParams.get('tag')
    const authorId = searchParams.get('author_id')
    
    const offset = (page - 1) * limit
    
    let whereClause = 'WHERE p.deleted_at IS NULL'
    const params: unknown[] = []
    
    if (status && status !== 'all') {
      whereClause += ' AND p.status = ?'
      params.push(status)
    } else if (!status) {
      whereClause += " AND p.status = 'published'"
    }
    
    if (category) {
      whereClause += ' AND c.slug = ?'
      params.push(category)
    }
    
    if (authorId) {
      whereClause += ' AND p.author_id = ?'
      params.push(authorId)
    }
    
    if (tag) {
      whereClause += ' AND EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = p.id AND t.slug = ?)'
      params.push(tag)
    }
    
    const countResult = await env.DB.prepare(
      `SELECT COUNT(DISTINCT p.id) as count FROM posts p 
       LEFT JOIN categories c ON p.category_id = c.id
       ${whereClause}`
    ).bind(...params).first<{ count: number }>()
    
    const total = countResult?.count || 0
    
    const result = await env.DB.prepare(`
      SELECT 
        p.id, p.title, p.slug, p.excerpt, p.cover_image, 
        p.author_id, p.category_id, p.status, p.view_count, p.published_at,
        p.created_at, p.updated_at,
        u.id as author_id, u.name as author_name, u.avatar_url as author_avatar,
        c.id as category_id, c.name as category_name, c.slug as category_slug
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all()
    
    const posts: PostListItemWithRelations[] = []
    
    for (const row of result.results) {
      const tagsResult = await env.DB.prepare(`
        SELECT t.id, t.name, t.slug 
        FROM tags t
        JOIN post_tags pt ON t.id = pt.tag_id
        WHERE pt.post_id = ?
      `).bind((row as { id: string }).id).all<Tag>()
      
      posts.push({
        id: (row as { id: string }).id,
        title: (row as { title: string }).title,
        slug: (row as { slug: string }).slug,
        excerpt: (row as { excerpt: string }).excerpt,
        cover_image: (row as { cover_image: string }).cover_image,
        author_id: (row as { author_id: string }).author_id,
        category_id: (row as { category_id: string }).category_id,
        status: (row as { status: 'draft' | 'published' | 'archived' }).status,
        view_count: (row as { view_count: number }).view_count,
        published_at: (row as { published_at: string }).published_at,
        created_at: (row as { created_at: string }).created_at,
        updated_at: (row as { updated_at: string }).updated_at,
        deleted_at: null,
        author: {
          id: (row as { author_id: string }).author_id,
          name: (row as { author_name: string }).author_name,
          avatar_url: (row as { author_avatar: string }).author_avatar,
        },
        category: (row as { category_id: string }).category_id ? {
          id: (row as { category_id: string }).category_id,
          name: (row as { category_name: string }).category_name,
          slug: (row as { category_slug: string }).category_slug,
          sort_order: 0,
          created_at: '',
          updated_at: '',
        } : null,
        tags: tagsResult.results,
      })
    }
    
    return successResponse({
      posts,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get posts error:', error)
    return errorResponse('获取文章列表失败', 500)
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  return withRole(request, ['author', 'admin'], async (user: User, env) => {
    try {
      const body = await request.json()
      const validationResult = createPostSchema.safeParse(body)
      
      if (!validationResult.success) {
        return errorResponse('参数验证失败', 400, 'VALIDATION_ERROR',
          validationResult.error.flatten().fieldErrors as Record<string, string[]>)
      }
      
      const { title, slug: providedSlug, content, excerpt, cover_image, category_id, tag_ids, status } = validationResult.data
      
      const slug = providedSlug ? providedSlug : generateSlug(title)
      const slugExists = await env.DB.prepare(
        'SELECT id FROM posts WHERE slug = ? AND deleted_at IS NULL'
      ).bind(slug).first()
      
      if (slugExists) {
        return errorResponse('文章 Slug 已存在，请使用其他 Slug', 400, 'SLUG_EXISTS')
      }
      
      const id = generateUUID()
      const now = new Date().toISOString()
      const postExcerpt = excerpt || extractExcerpt(content)
      const publishedAt = status === 'published' ? now : null
      
      await env.DB.prepare(`
        INSERT INTO posts (id, title, slug, content, excerpt, cover_image, author_id, category_id, status, published_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, title, slug, content, postExcerpt, cover_image || null, user.id, category_id || null, status, publishedAt, now, now).run()
      
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
      
      return successResponse({ post }, 201)
    } catch (error) {
      console.error('Create post error:', error)
      return errorResponse('创建文章失败', 500)
    }
  })
}
