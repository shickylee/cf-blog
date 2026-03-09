import { NextRequest, NextResponse } from 'next/server'
import { getEnv, successResponse, errorResponse, getClientInfo } from '@/lib/api'
import { generateUUID } from '@/lib/utils'
import { verifyTurnstile } from '@/lib/turnstile'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const env = getEnv()
    
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'approved'
    
    const friendLinks = await env.DB.prepare(`
      SELECT id, name, url, description, logo, contact_email, status, sort_order, created_at
      FROM friend_links 
      WHERE status = ?
      ORDER BY sort_order ASC, created_at DESC
    `).bind(status).all()
    
    return successResponse({
      friendLinks: friendLinks.results || []
    })
  } catch (error) {
    console.error('Get friend links error:', error)
    return errorResponse('Failed to fetch friend links', 500)
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const env = getEnv()
    const { ipAddress } = getClientInfo(request)
    
    const cookieToken = request.cookies.get('friend_link_token')?.value
    
    const existingSubmission = await env.DB.prepare(`
      SELECT id FROM friend_link_submissions 
      WHERE (ip_address = ? OR cookie_token = ?)
      AND created_at > datetime('now', '-1 day')
    `).bind(
      ipAddress || '',
      cookieToken || ''
    ).first<{ id: string }>()
    
    if (existingSubmission) {
      return errorResponse('24小时内已提交过友链申请，请勿重复提交', 429, 'RATE_LIMITED')
    }
    
    const body = await request.json() as {
      name: string
      url: string
      description?: string
      logo?: string
      contact_email?: string
      'cf-turnstile-response'?: string
    }
    
    const { name, url, description, logo, contact_email, 'cf-turnstile-response': turnstileToken } = body
    
    if (!name || !url) {
      return errorResponse('Name and URL are required', 400)
    }
    
    try {
      new URL(url)
    } catch {
      return errorResponse('Invalid URL format', 400)
    }
    
    if (env.TURNSTILE_SECRET_KEY) {
      const isValid = await verifyTurnstile(
        turnstileToken || '',
        env.TURNSTILE_SECRET_KEY,
        ipAddress || undefined
      )
      
      if (!isValid) {
        return errorResponse('验证失败，请重试', 400, 'TURNSTILE_FAILED')
      }
    }
    
    const submissionId = generateUUID()
    await env.DB.prepare(`
      INSERT INTO friend_link_submissions (id, ip_address, cookie_token, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).bind(submissionId, ipAddress || '', cookieToken || '').run()
    
    const id = generateUUID()
    await env.DB.prepare(`
      INSERT INTO friend_links (id, name, url, description, logo, contact_email, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).bind(id, name, url, description || '', logo || '', contact_email || '').run()
    
    const response = successResponse({
      message: 'Friend link application submitted, pending approval'
    })
    
    response.cookies.set('friend_link_token', cookieToken || submissionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    
    return response
  } catch (error) {
    console.error('Create friend link error:', error)
    return errorResponse('Failed to submit friend link', 500)
  }
}
