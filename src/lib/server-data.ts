import { getEnv } from '@/lib/api'
import type { Post, Comment as CommentType, PostListItem } from '@/types'

export interface Pagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

export async function getPosts(page = 1, limit = 10, filters?: {
  status?: string
  category?: string
  tag?: string
  authorId?: string
  search?: string
}): Promise<{ posts: PostListItem[]; pagination: Pagination }> {
  try {
    const env = getEnv()
    
    const offset = (page - 1) * limit
    let whereClause = 'WHERE p.deleted_at IS NULL'
    const params: unknown[] = []
    
    if (filters?.status && filters.status !== 'all') {
      whereClause += ' AND p.status = ?'
      params.push(filters.status)
    } else if (!filters?.status) {
      whereClause += " AND p.status = 'published'"
    }
    
    if (filters?.category) {
      whereClause += ' AND c.slug = ?'
      params.push(filters.category)
    }
    
    if (filters?.authorId) {
      whereClause += ' AND p.author_id = ?'
      params.push(filters.authorId)
    }
    
    if (filters?.tag) {
      whereClause += ' AND EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = p.id AND t.slug = ?)'
      params.push(filters.tag)
    }
    
    if (filters?.search) {
      whereClause += ' AND (p.title LIKE ? OR p.content LIKE ? OR p.excerpt LIKE ?)'
      const searchPattern = `%${filters.search}%`
      params.push(searchPattern, searchPattern, searchPattern)
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
        c.id as category_id, c.name as category_name, c.slug as category_slug, c.icon as category_icon
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all()
    
    const posts: PostListItem[] = []
    
    for (const row of result.results) {
      const tagsResult = await env.DB.prepare(`
        SELECT t.id, t.name, t.slug 
        FROM tags t
        JOIN post_tags pt ON t.id = pt.tag_id
        WHERE pt.post_id = ?
      `).bind((row as { id: string }).id).all<{ id: string; name: string; slug: string }>()
      
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
          icon: (row as { category_icon: string }).category_icon || 'folder',
        } : null,
        tags: tagsResult.results,
      })
    }
    
    return {
      posts,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    }
  } catch (error) {
    return {
      posts: [],
      pagination: { page, limit, total: 0, total_pages: 1 },
    }
  }
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  try {
    const env = getEnv()
    
    const result = await env.DB.prepare(`
      SELECT 
        p.id, p.title, p.slug, p.content, p.excerpt, p.cover_image, 
        p.author_id, p.category_id, p.status, p.view_count, p.published_at,
        p.created_at, p.updated_at,
        u.id as author_id, u.name as author_name, u.avatar_url as author_avatar,
        c.id as category_id, c.name as category_name, c.slug as category_slug, c.icon as category_icon
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.slug = ? AND p.deleted_at IS NULL
    `).bind(slug).first()
    
    if (!result) {
      return null
    }
    
    const tagsResult = await env.DB.prepare(`
      SELECT t.id, t.name, t.slug 
      FROM tags t
      JOIN post_tags pt ON t.id = pt.tag_id
      WHERE pt.post_id = ?
    `).bind((result as { id: string }).id).all<{ id: string; name: string; slug: string }>()
    
    return {
      id: (result as { id: string }).id,
      title: (result as { title: string }).title,
      slug: (result as { slug: string }).slug,
      content: (result as { content: string }).content,
      excerpt: (result as { excerpt: string }).excerpt,
      cover_image: (result as { cover_image: string }).cover_image,
      author_id: (result as { author_id: string }).author_id,
      category_id: (result as { category_id: string }).category_id,
      status: (result as { status: 'draft' | 'published' | 'archived' }).status,
      view_count: (result as { view_count: number }).view_count,
      published_at: (result as { published_at: string }).published_at,
      created_at: (result as { created_at: string }).created_at,
      updated_at: (result as { updated_at: string }).updated_at,
      deleted_at: null,
      author: {
        id: (result as { author_id: string }).author_id,
        name: (result as { author_name: string }).author_name,
        avatar_url: (result as { author_avatar: string }).author_avatar,
      },
      category: (result as { category_id: string }).category_id ? {
        id: (result as { category_id: string }).category_id,
        name: (result as { category_name: string }).category_name,
        slug: (result as { category_slug: string }).category_slug,
        icon: (result as { category_icon: string }).category_icon || 'folder',
      } : null,
      tags: tagsResult.results,
    }
  } catch (error) {
    return null
  }
}

export async function getSettings(): Promise<Record<string, string>> {
  try {
    const env = getEnv()
    
    const settings = await env.DB.prepare(
      'SELECT key, value FROM settings WHERE deleted_at IS NULL'
    ).all<{ key: string; value: string }>()
    
    const settingsMap: Record<string, string> = {}
    for (const setting of settings.results || []) {
      settingsMap[setting.key] = setting.value
    }
    
    return settingsMap
  } catch (error) {
    return {}
  }
}

export async function getCommentsByPostSlug(slug: string): Promise<CommentType[]> {
  try {
    const env = getEnv()
    
    const post = await env.DB.prepare(
      'SELECT id FROM posts WHERE slug = ? AND deleted_at IS NULL'
    ).bind(slug).first<{ id: string }>()
    
    if (!post) {
      return []
    }
    
    const result = await env.DB.prepare(`
      SELECT c.*, u.name as user_name, u.avatar_url as user_avatar, c.guest_name, c.guest_email
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ? AND c.deleted_at IS NULL AND c.status = ?
      ORDER BY c.created_at ASC
    `).bind(post.id, 'approved').all()
    
    const comments: CommentType[] = result.results.map((row: any) => {
      const isGuest = !row.user_id
      const userName = isGuest ? row.guest_name : row.user_name
      const userAvatar = isGuest ? null : row.user_avatar
      
      return {
        id: row.id,
        content: row.content,
        post_id: row.post_id,
        author_id: row.user_id,
        user_id: row.user_id,
        guest_name: isGuest ? row.guest_name : null,
        guest_email: isGuest ? row.guest_email : null,
        parent_id: row.parent_id,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at || row.created_at,
        deleted_at: null,
        author: isGuest ? undefined : {
          id: row.user_id,
          name: row.user_name,
          avatar_url: row.user_avatar,
        },
        replies: [],
      }
    })
    
    return comments
  } catch (error) {
    return []
  }
}

export interface User {
  id: string
  name: string
  avatar_url: string | null
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const env = getEnv()
    const cloudflareContext = (globalThis as any)[Symbol.for('__cloudflare-context__')]
    
    if (!cloudflareContext?.request) {
      return null
    }
    
    const authHeader = cloudflareContext.request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return null
    }
    
    const token = authHeader.substring(7)
    const { verifyJWT } = await import('@/lib/auth/jwt')
    const payload = await verifyJWT(token, env.JWT_SECRET)
    
    if (!payload) {
      return null
    }
    
    const user = await env.DB.prepare(
      'SELECT id, name, avatar_url FROM users WHERE id = ? AND deleted_at IS NULL'
    ).bind(payload.sub).first<{ id: string; name: string; avatar_url: string | null }>()
    
    return user || null
  } catch (error) {
    return null
  }
}
