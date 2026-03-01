import { NextRequest } from 'next/server'
import { getEnv, successResponse, errorResponse, withRole } from '@/lib/api'
import { generateUUID, generateSlug, extractExcerpt } from '@/lib/utils'
import { z } from 'zod'
import type { User, Post, Category, Tag } from '@/types'

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  excerpt: z.string().max(500).optional(),
  cover_image: z.string().url().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  tag_ids: z.array(z.string().uuid()).optional(),
  status: z.enum(['draft', 'published']),
})

export async function POST(request: NextRequest): Promise<Response> {
  return withRole(request, ['author', 'admin'], async (user: User, env) => {
    try {
      const body = await request.json()
      const validationResult = createPostSchema.safeParse(body)
      
      if (!validationResult.success) {
        console.error('Validation error:', validationResult.error.flatten())
        return errorResponse('参数验证失败', 400, 'VALIDATION_ERROR',
          validationResult.error.flatten().fieldErrors as Record<string, string[]>)
      }
      
      const { title, content, excerpt, cover_image, category_id, tag_ids, status } = validationResult.data
      
      console.log('Creating post:', { title, status, category_id, tag_ids })
      
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
      const publishedAt = status === 'published' ? now : null
      
      console.log('Inserting post with ID:', id)
      
      await env.DB.prepare(`
        INSERT INTO posts (id, title, slug, content, excerpt, cover_image, author_id, category_id, status, published_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, title, slug, content, postExcerpt, cover_image || null, user.id, category_id || null, status, publishedAt, now, now).run()
      
      console.log('Post inserted successfully')
      
      if (tag_ids && tag_ids.length > 0) {
        console.log('Adding tags:', tag_ids)
        for (const tagId of tag_ids) {
          await env.DB.prepare(
            'INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)'
          ).bind(id, tagId).run()
        }
      }
      
      const post = await env.DB.prepare(
        'SELECT * FROM posts WHERE id = ?'
      ).bind(id).first<Post>()
      
      console.log('Post created successfully:', post?.id)
      return successResponse({ post }, 201)
    } catch (error) {
      console.error('Create post error:', error)
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
      return errorResponse('创建文章失败', 500)
    }
  })
}
