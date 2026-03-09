import { NextRequest } from 'next/server'
import { getEnv, successResponse, errorResponse, withAuth, getClientInfo } from '@/lib/api'
import { generateUUID } from '@/lib/utils'
import { verifyTurnstile } from '@/lib/turnstile'
import { z } from 'zod'
import type { User } from '@/types'
import crypto from 'crypto'

const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  post_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(50).optional(),
  email: z.string().email().optional().or(z.literal('')),
})

const createGuestCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  post_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(50),
  email: z.string().email(),
  'cf-turnstile-response': z.string().optional(),
})

interface RouteParams {
  params: Promise<{ postId: string }>
}

interface CommentWithUser {
  id: string
  content: string
  post_id: string
  user_id: string | null
  parent_id: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
  user: {
    id: string
    name: string
    avatar_url: string | null
    email?: string
  }
  replies?: CommentWithUser[]
}

function buildCommentTree(comments: CommentWithUser[]): CommentWithUser[] {
  const commentMap = new Map<string, CommentWithUser>()
  const rootComments: CommentWithUser[] = []

  comments.forEach(comment => {
    commentMap.set(comment.id, { ...comment, replies: [] })
  })

  comments.forEach(comment => {
    const commentWithReplies = commentMap.get(comment.id)!
    if (comment.parent_id && commentMap.has(comment.parent_id)) {
      const parent = commentMap.get(comment.parent_id)!
      parent.replies = parent.replies || []
      parent.replies.push(commentWithReplies)
    } else {
      rootComments.push(commentWithReplies)
    }
  })

  return rootComments
}

function getGravatarUrl(email: string, size: number = 80): string {
  const hash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex')
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon&r=g`
}

async function getCommentSettings(env: ReturnType<typeof getEnv>) {
  const results = await env.DB.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>()
  const settings: Record<string, string> = {}
  results.results.forEach((row: { key: string; value: string }) => {
    settings[row.key] = row.value || ''
  })
  return {
    moderationEnabled: settings.comment_moderation === 'true',
    keywords: settings.comment_keywords || '',
    turnstileEnabled: !!settings.turnstile_site_key && !!settings.turnstile_secret_key,
    turnstileSecretKey: settings.turnstile_secret_key || '',
  }
}

function shouldRejectComment(content: string, keywords: string): boolean {
  if (!keywords) return false
  const keywordList = keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k)
  const lowerContent = content.toLowerCase()
  return keywordList.some(keyword => lowerContent.includes(keyword))
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  try {
    const env = getEnv()
    const { postId } = await params
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = (page - 1) * limit
    
    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM comments WHERE post_id = ? AND deleted_at IS NULL AND status = ?'
    ).bind(postId, 'approved').first<{ count: number }>()
    
    const total = countResult?.count || 0
    
    const result = await env.DB.prepare(`
      SELECT c.*, u.name as user_name, u.avatar_url as user_avatar, c.guest_name, c.guest_email
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ? AND c.deleted_at IS NULL AND c.status = ?
      ORDER BY c.created_at ASC
      LIMIT ? OFFSET ?
    `).bind(postId, 'approved', limit, offset).all()
    
    const comments: CommentWithUser[] = result.results.map((row: any) => {
      const isGuest = !row.user_id
      const userName = isGuest ? row.guest_name : row.user_name
      const userAvatar = isGuest ? null : row.user_avatar
      const userEmail = isGuest ? row.guest_email : undefined
      
      const avatarUrl = isGuest && userEmail 
        ? getGravatarUrl(userEmail)
        : userAvatar
      
      return {
        id: row.id,
        content: row.content,
        post_id: row.post_id,
        user_id: row.user_id,
        parent_id: row.parent_id,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        user: {
          id: isGuest ? `guest-${row.id}` : row.user_id,
          name: userName,
          avatar_url: avatarUrl,
          email: userEmail,
        },
        replies: [],
      }
    })
    
    const commentTree = buildCommentTree(comments)
    
    return successResponse({
      comments: commentTree,
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
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  try {
    const env = getEnv()
    const { postId } = await params
    const body = await request.json()
    const { ipAddress } = getClientInfo(request)
    
    const { moderationEnabled, keywords, turnstileEnabled, turnstileSecretKey } = await getCommentSettings(env)
    
    const token = request.cookies.get('access_token')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (token) {
      return withAuth(request, async (user: User, env) => {
        try {
          const validationResult = createCommentSchema.safeParse({
            ...(typeof body === 'object' && body !== null ? body : {}),
            post_id: postId
          })
          
          if (!validationResult.success) {
            return errorResponse('参数验证失败', 400, 'VALIDATION_ERROR',
              validationResult.error.flatten().fieldErrors as Record<string, string[]>)
          }
          
          const { content, parent_id } = validationResult.data
          
          const post = await env.DB.prepare(
            'SELECT id FROM posts WHERE id = ? AND deleted_at IS NULL AND status = ?'
          ).bind(postId, 'published').first()
          
          if (!post) {
            return errorResponse('文章不存在', 404, 'NOT_FOUND')
          }
          
          if (parent_id) {
            const parentComment = await env.DB.prepare(
              'SELECT id FROM comments WHERE id = ? AND post_id = ? AND deleted_at IS NULL'
            ).bind(parent_id, postId).first()
            
            if (!parentComment) {
              return errorResponse('父评论不存在', 404, 'PARENT_NOT_FOUND')
            }
          }
          
          let status: 'pending' | 'approved' | 'rejected' = 'approved'
          if (moderationEnabled) {
            status = 'pending'
          } else if (shouldRejectComment(content, keywords)) {
            status = 'rejected'
          }
          
          const id = generateUUID()
          const now = new Date().toISOString()
          
          await env.DB.prepare(`
            INSERT INTO comments (id, content, post_id, user_id, parent_id, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id, content, postId, user.id, parent_id || null, status, now, now).run()
          
          const avatarUrl = user.avatar_url || getGravatarUrl(user.email)
          
          if (status === 'pending') {
            return successResponse({ 
              comment: {
                id,
                content,
                post_id: postId,
                user_id: user.id,
                parent_id: parent_id || null,
                status,
                created_at: now,
                updated_at: now,
                user: {
                  id: user.id,
                  name: user.name,
                  avatar_url: avatarUrl,
                },
              },
              message: '评论已提交，待审核后显示'
            }, 201)
          }
          
          return successResponse({ 
            comment: {
              id,
              content,
              post_id: postId,
              user_id: user.id,
              parent_id: parent_id || null,
              status,
              created_at: now,
              updated_at: now,
              user: {
                id: user.id,
                name: user.name,
                avatar_url: avatarUrl,
              },
            }
          }, 201)
        } catch (error) {
          console.error('Create comment error:', error)
          return errorResponse('发表评论失败', 500)
        }
      })
    } else {
      const cookieToken = request.cookies.get('comment_token')?.value
      
      const existingCount = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM comment_submissions 
        WHERE (ip_address = ? OR cookie_token = ?)
        AND created_at > datetime('now', '-1 day')
      `).bind(ipAddress || '', cookieToken || '').first<{ count: number }>()
      
      if (existingCount && existingCount.count >= 3) {
        return errorResponse('24小时内评论次数已达上限（3次），请明天再来', 429, 'RATE_LIMITED')
      }
      
      if (turnstileEnabled && turnstileSecretKey) {
        const turnstileToken = (body as any)['cf-turnstile-response']
        const isValid = await verifyTurnstile(
          turnstileToken || '',
          turnstileSecretKey,
          ipAddress || undefined
        )
        
        if (!isValid) {
          return errorResponse('人机验证失败，请重试', 400, 'TURNSTILE_FAILED')
        }
      }
      
      const validationResult = createGuestCommentSchema.safeParse({
        ...(typeof body === 'object' && body !== null ? body : {}),
        post_id: postId
      })
      
      if (!validationResult.success) {
        return errorResponse('参数验证失败', 400, 'VALIDATION_ERROR',
          validationResult.error.flatten().fieldErrors as Record<string, string[]>)
      }
      
      const { content, parent_id, name, email } = validationResult.data
      
      const post = await env.DB.prepare(
        'SELECT id FROM posts WHERE id = ? AND deleted_at IS NULL AND status = ?'
      ).bind(postId, 'published').first()
      
      if (!post) {
        return errorResponse('文章不存在', 404, 'NOT_FOUND')
      }
      
      if (parent_id) {
        const parentComment = await env.DB.prepare(
          'SELECT id FROM comments WHERE id = ? AND post_id = ? AND deleted_at IS NULL'
        ).bind(parent_id, postId).first()
        
        if (!parentComment) {
          return errorResponse('父评论不存在', 404, 'PARENT_NOT_FOUND')
        }
      }
      
      let status: 'pending' | 'approved' | 'rejected' = 'approved'
      if (moderationEnabled) {
        status = 'pending'
      } else if (shouldRejectComment(content, keywords)) {
        status = 'rejected'
      }
      
      const id = generateUUID()
      const now = new Date().toISOString()
      
      await env.DB.prepare(`
        INSERT INTO comments (id, content, post_id, user_id, parent_id, status, guest_name, guest_email, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, content, postId, null, parent_id || null, status, name, email, now, now).run()
      
      const submissionId = generateUUID()
      await env.DB.prepare(`
        INSERT INTO comment_submissions (id, ip_address, cookie_token, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).bind(submissionId, ipAddress || '', cookieToken || '').run()
      
      const avatarUrl = getGravatarUrl(email)
      
      const response = successResponse({ 
        comment: {
          id,
          content,
          post_id: postId,
          user_id: null,
          parent_id: parent_id || null,
          status,
          created_at: now,
          updated_at: now,
          user: {
            id: `guest-${id}`,
            name,
            avatar_url: avatarUrl,
            email,
          },
        },
        message: status === 'pending' ? '评论已提交，待审核后显示' : undefined
      }, 201)
      
      response.cookies.set('comment_token', cookieToken || submissionId, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      })
      
      return response
    }
  } catch (error) {
    console.error('Create comment error:', error)
    return errorResponse('发表评论失败', 500)
  }
}
