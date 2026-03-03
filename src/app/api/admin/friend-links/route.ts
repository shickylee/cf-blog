import { NextRequest } from 'next/server'
import { getEnv, successResponse, errorResponse, withRole } from '@/lib/api'
import { generateUUID } from '@/lib/utils'
import { z } from 'zod'
import type { User } from '@/types'

const updateFriendLinkSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  description: z.string().max(500).optional().or(z.literal('')),
  logo: z.string().url().optional().or(z.literal('')),
  contact_email: z.string().email().optional().or(z.literal('')),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  sort_order: z.number().int().min(0).optional(),
})

export async function GET(request: NextRequest): Promise<Response> {
  return withRole(request, ['admin'], async (user: User, env) => {
    try {
      const { searchParams } = new URL(request.url)
      const status = searchParams.get('status')
      
      let query = 'SELECT * FROM friend_links'
      
      if (status) {
        query += ' WHERE status = ?'
        const result = await env.DB.prepare(query).bind(status).all()
        return successResponse({ friendLinks: result.results || [] })
      }
      
      query += ' ORDER BY sort_order ASC, created_at DESC'
      const result = await env.DB.prepare(query).all()
      
      return successResponse({ friendLinks: result.results || [] })
    } catch (error) {
      console.error('Get friend links error:', error)
      return errorResponse('Failed to fetch friend links', 500)
    }
  })
}

export async function POST(request: NextRequest): Promise<Response> {
  return withRole(request, ['admin'], async (user: User, env) => {
    try {
      const body = await request.json() as {
        name: string
        url: string
        description?: string
        logo?: string
        contact_email?: string
        status?: 'pending' | 'approved' | 'rejected'
        sort_order?: number
      }
      
      const { name, url, description, logo, contact_email, status, sort_order } = body
      
      if (!name || !url) {
        return errorResponse('Name and URL are required', 400)
      }
      
      try {
        new URL(url)
      } catch {
        return errorResponse('Invalid URL format', 400)
      }
      
      const id = generateUUID()
      await env.DB.prepare(`
        INSERT INTO friend_links (id, name, url, description, logo, contact_email, status, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, name, url, description || '', logo || '', contact_email || '', status || 'pending', sort_order || 0).run()
      
      const newLink = await env.DB.prepare(
        'SELECT * FROM friend_links WHERE id = ?'
      ).bind(id).first()
      
      return successResponse({ friendLink: newLink }, 201)
    } catch (error) {
      console.error('Create friend link error:', error)
      return errorResponse('Failed to create friend link', 500)
    }
  })
}

export async function PUT(request: NextRequest): Promise<Response> {
  return withRole(request, ['admin'], async (user: User, env) => {
    try {
      const body = await request.json()
      const { id, ...updateData } = body as { id: string } & z.infer<typeof updateFriendLinkSchema>
      
      if (!id) {
        return errorResponse('Friend link ID is required', 400)
      }
      
      const existing = await env.DB.prepare(
        'SELECT id FROM friend_links WHERE id = ?'
      ).bind(id).first()
      
      if (!existing) {
        return errorResponse('Friend link not found', 404)
      }
      
      const fields: string[] = []
      const values: (string | number)[] = []
      
      if (updateData.name !== undefined) {
        fields.push('name = ?')
        values.push(updateData.name)
      }
      if (updateData.url !== undefined) {
        fields.push('url = ?')
        values.push(updateData.url)
      }
      if (updateData.description !== undefined) {
        fields.push('description = ?')
        values.push(updateData.description)
      }
      if (updateData.logo !== undefined) {
        fields.push('logo = ?')
        values.push(updateData.logo)
      }
      if (updateData.contact_email !== undefined) {
        fields.push('contact_email = ?')
        values.push(updateData.contact_email)
      }
      if (updateData.status !== undefined) {
        fields.push('status = ?')
        values.push(updateData.status)
      }
      if (updateData.sort_order !== undefined) {
        fields.push('sort_order = ?')
        values.push(updateData.sort_order)
      }
      
      if (fields.length === 0) {
        return errorResponse('No fields to update', 400)
      }
      
      fields.push('updated_at = ?')
      values.push(new Date().toISOString())
      values.push(id)
      
      await env.DB.prepare(`
        UPDATE friend_links SET ${fields.join(', ')} WHERE id = ?
      `).bind(...values).run()
      
      const updated = await env.DB.prepare(
        'SELECT * FROM friend_links WHERE id = ?'
      ).bind(id).first()
      
      return successResponse({ friendLink: updated })
    } catch (error) {
      console.error('Update friend link error:', error)
      return errorResponse('Failed to update friend link', 500)
    }
  })
}

export async function DELETE(request: NextRequest): Promise<Response> {
  return withRole(request, ['admin'], async (user: User, env) => {
    try {
      const { searchParams } = new URL(request.url)
      const id = searchParams.get('id')
      
      if (!id) {
        return errorResponse('Friend link ID is required', 400)
      }
      
      const existing = await env.DB.prepare(
        'SELECT id FROM friend_links WHERE id = ?'
      ).bind(id).first()
      
      if (!existing) {
        return errorResponse('Friend link not found', 404)
      }
      
      await env.DB.prepare(
        'DELETE FROM friend_links WHERE id = ?'
      ).bind(id).run()
      
      return successResponse({ message: 'Friend link deleted successfully' })
    } catch (error) {
      console.error('Delete friend link error:', error)
      return errorResponse('Failed to delete friend link', 500)
    }
  })
}
