import { NextRequest } from 'next/server'
import { getEnv, successResponse, errorResponse, withRole } from '@/lib/api'
import { generateUUID, generateSlug } from '@/lib/utils'
import { z } from 'zod'
import type { User, Category } from '@/types'

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional().or(z.literal('')),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
  sort_order: z.number().int().optional(),
})

export async function GET(): Promise<Response> {
  try {
    const env = getEnv()
    const result = await env.DB.prepare(
      'SELECT * FROM categories ORDER BY sort_order ASC, created_at DESC'
    ).all<Category>()
    
    return successResponse({ categories: result.results })
  } catch (error) {
    console.error('Get categories error:', error)
    return errorResponse('获取分类列表失败', 500)
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  return withRole(request, ['author', 'admin'], async (user: User, env) => {
    try {
      const body = await request.json()
      const validationResult = createCategorySchema.safeParse(body)
      
      if (!validationResult.success) {
        return errorResponse('参数验证失败', 400, 'VALIDATION_ERROR',
          validationResult.error.flatten().fieldErrors as Record<string, string[]>)
      }
      
      const { name, slug, description, icon, sort_order } = validationResult.data
      const categorySlug = slug || generateSlug(name)
      
      const existing = await env.DB.prepare(
        'SELECT id FROM categories WHERE slug = ?'
      ).bind(categorySlug).first()
      
      if (existing) {
        return errorResponse('分类 Slug 已存在', 400, 'SLUG_EXISTS')
      }
      
      const id = generateUUID()
      const now = new Date().toISOString()
      
      await env.DB.prepare(`
        INSERT INTO categories (id, name, slug, description, icon, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, name, categorySlug, description || null, icon || 'folder', sort_order || 0, now, now).run()
      
      const category = await env.DB.prepare(
        'SELECT * FROM categories WHERE id = ?'
      ).bind(id).first<Category>()
      
      return successResponse({ category }, 201)
    } catch (error) {
      console.error('Create category error:', error)
      return errorResponse('创建分类失败', 500)
    }
  })
}
