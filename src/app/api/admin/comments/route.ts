import { NextRequest } from 'next/server'
import { getEnv, successResponse, errorResponse, withRole } from '@/lib/api'
import type { User } from '@/types'

export async function GET(request: NextRequest): Promise<Response> {
  return withRole(request, ['admin'], async (user: User, env) => {
    try {
      const { searchParams } = new URL(request.url)
      const page = parseInt(searchParams.get('page') || '1', 10)
      const limit = parseInt(searchParams.get('limit') || '20', 10)
      const status = searchParams.get('status')
      const postId = searchParams.get('post_id')
      const offset = (page - 1) * limit

      let whereClause = 'WHERE c.deleted_at IS NULL'
      const params: unknown[] = []

      if (status) {
        whereClause += ' AND c.status = ?'
        params.push(status)
      }

      if (postId) {
        whereClause += ' AND c.post_id = ?'
        params.push(postId)
      }

      const countResult = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM comments c ${whereClause}`
      ).bind(...params).first<{ count: number }>()

      const total = countResult?.count || 0

      const result = await env.DB.prepare(`
        SELECT 
          c.id, c.content, c.status, c.parent_id, c.post_id, c.user_id, c.created_at, c.updated_at,
          p.title as post_title,
          u.name as user_name, u.email as user_email, u.avatar_url as user_avatar
        FROM comments c
        LEFT JOIN posts p ON c.post_id = p.id
        LEFT JOIN users u ON c.user_id = u.id
        ${whereClause}
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `).bind(...params, limit, offset).all()

      const comments = result.results.map((row) => ({
        id: (row as { id: string }).id,
        content: (row as { content: string }).content,
        status: (row as { status: 'pending' | 'approved' | 'rejected' }).status,
        parent_id: (row as { parent_id: string | null }).parent_id,
        post_id: (row as { post_id: string }).post_id,
        user_id: (row as { user_id: string }).user_id,
        created_at: (row as { created_at: string }).created_at,
        updated_at: (row as { updated_at: string }).updated_at,
        post_title: (row as { post_title: string | null }).post_title,
        user_name: (row as { user_name: string | null }).user_name,
        user_email: (row as { user_email: string | null }).user_email,
        user_avatar: (row as { user_avatar: string | null }).user_avatar,
      }))

      return successResponse({
        comments,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      console.error('Get comments error:', error)
      return errorResponse('获取评论列表失败', 500)
    }
  })
}

export async function PUT(request: NextRequest): Promise<Response> {
  return withRole(request, ['admin'], async (user: User, env) => {
    try {
      const { searchParams } = new URL(request.url)
      const commentId = searchParams.get('id')

      if (!commentId) {
        return errorResponse('缺少评论ID', 400)
      }

      const body = await request.json() as { status?: string }
      const { status } = body

      if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
        return errorResponse('无效的评论状态', 400)
      }

      await env.DB.prepare(
        'UPDATE comments SET status = ?, updated_at = ? WHERE id = ?'
      ).bind(status, new Date().toISOString(), commentId).run()

      const comment = await env.DB.prepare(
        'SELECT * FROM comments WHERE id = ?'
      ).bind(commentId).first<{
        id: string
        content: string
        status: string
        parent_id: string | null
        post_id: string
        user_id: string
        created_at: string
        updated_at: string
      }>()

      return successResponse({ comment })
    } catch (error) {
      console.error('Update comment error:', error)
      return errorResponse('更新评论失败', 500)
    }
  })
}

export async function DELETE(request: NextRequest): Promise<Response> {
  return withRole(request, ['admin'], async (user: User, env) => {
    try {
      const { searchParams } = new URL(request.url)
      const commentId = searchParams.get('id')

      if (!commentId) {
        return errorResponse('缺少评论ID', 400)
      }

      const now = new Date().toISOString()
      await env.DB.prepare(
        'UPDATE comments SET deleted_at = ? WHERE id = ?'
      ).bind(now, commentId).run()

      return successResponse({ message: '评论已删除' })
    } catch (error) {
      console.error('Delete comment error:', error)
      return errorResponse('删除评论失败', 500)
    }
  })
}
