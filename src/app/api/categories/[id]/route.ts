import { NextRequest } from 'next/server'
import { getEnv, successResponse, errorResponse, withRole } from '@/lib/api'
import { generateSlug } from '@/lib/utils'
import { z } from 'zod'
import type { User, Category } from '@/types'

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(500).nullable().optional(),
  icon: z.string().max(50).optional(),
  sort_order: z.number().int().optional(),
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
    
    const category = await env.DB.prepare(
      'SELECT * FROM categories WHERE id = ?'
    ).bind(id).first<Category>()
    
    if (!category) {
      return errorResponse('分类不存在', 404, 'NOT_FOUND')
    }
    
    return successResponse({ category })
  } catch (error) {
    console.error('Get category error:', error)
    return errorResponse('获取分类失败', 500)
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
      const validationResult = updateCategorySchema.safeParse(body)
      
      if (!validationResult.success) {
        return errorResponse('参数验证失败', 400, 'VALIDATION_ERROR',
          validationResult.error.flatten().fieldErrors as Record<string, string[]>)
      }
      
      const existing = await env.DB.prepare(
        'SELECT * FROM categories WHERE id = ?'
      ).bind(id).first<Category>()
      
      if (!existing) {
        return errorResponse('分类不存在', 404, 'NOT_FOUND')
      }
      
      const { name, slug, description, icon, sort_order } = validationResult.data
      const updates: string[] = []
      const values: unknown[] = []
      
      if (name !== undefined) {
        updates.push('name = ?')
        values.push(name)
      }
      
      if (slug !== undefined) {
        const slugExists = await env.DB.prepare(
          'SELECT id FROM categories WHERE slug = ? AND id != ?'
        ).bind(slug, id).first()
        
        if (slugExists) {
          return errorResponse('分类 Slug 已存在', 400, 'SLUG_EXISTS')
        }
        updates.push('slug = ?')
        values.push(slug)
      }
      
      if (description !== undefined) {
        updates.push('description = ?')
        values.push(description)
      }
      
      if (icon !== undefined) {
        updates.push('icon = ?')
        values.push(icon)
      }
      
      if (sort_order !== undefined) {
        updates.push('sort_order = ?')
        values.push(sort_order)
      }
      
      if (updates.length === 0) {
        return successResponse({ category: existing })
      }
      
      updates.push('updated_at = ?')
      values.push(new Date().toISOString())
      values.push(id)
      
      await env.DB.prepare(
        `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`
      ).bind(...values).run()
      
      const category = await env.DB.prepare(
        'SELECT * FROM categories WHERE id = ?'
      ).bind(id).first<Category>()
      
      return successResponse({ category })
    } catch (error) {
      console.error('Update category error:', error)
      return errorResponse('更新分类失败', 500)
    }
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  return withRole(request, ['admin'], async (user: User, env) => {
    try {
      const { id } = await params
      
      const existing = await env.DB.prepare(
        'SELECT id FROM categories WHERE id = ?'
      ).bind(id).first()
      
      if (!existing) {
        return errorResponse('分类不存在', 404, 'NOT_FOUND')
      }
      
      await env.DB.prepare(
        'UPDATE posts SET category_id = NULL WHERE category_id = ?'
      ).bind(id).run()
      
      await env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run()
      
      return successResponse({ message: '分类已删除' })
    } catch (error) {
      console.error('Delete category error:', error)
      return errorResponse('删除分类失败', 500)
    }
  })
}
