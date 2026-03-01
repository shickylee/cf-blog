import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/auth/jwt'
import { createDBInterface } from '@/lib/db/local'
import type { Env, User, ApiResponse } from '@/types'

export { verifyJWT }

const isLocal = process.env.NODE_ENV === 'development'

function getLocalDB() {
  try {
    return createDBInterface()
  } catch {
    return null
  }
}

export function getEnv(): Env {
  console.log('=== GETENV DEBUG ===')
  console.log('NODE_ENV:', process.env.NODE_ENV)
  console.log('isLocal:', isLocal)

  // Try to get Cloudflare environment from context first
  const cloudflareContext = (globalThis as any)[Symbol.for('__cloudflare-context__')]
  console.log('Cloudflare context exists:', !!cloudflareContext)
  console.log('Cloudflare env exists:', !!cloudflareContext?.env)
  
  if (cloudflareContext?.env?.DB) {
    console.log('Using Cloudflare environment')
    console.log('DB binding:', !!cloudflareContext.env.DB)
    console.log('JWT_SECRET exists:', !!cloudflareContext.env.JWT_SECRET)
    return {
      DB: cloudflareContext.env.DB as D1Database,
      R2: cloudflareContext.env.R2 as R2Bucket,
      JWT_SECRET: cloudflareContext.env.JWT_SECRET || '',
      RESEND_API_KEY: cloudflareContext.env.RESEND_API_KEY || '',
      SITE_URL: cloudflareContext.env.SITE_URL || 'http://localhost:3000',
      SITE_NAME: cloudflareContext.env.SITE_NAME || 'My Blog',
    }
  }

  // Fallback to local development
  if (isLocal) {
    console.log('Using local development environment')
    const localDb = getLocalDB()
    if (localDb) {
      return {
        DB: localDb as unknown as D1Database,
        R2: process.env.R2 as unknown as R2Bucket,
        JWT_SECRET: process.env.JWT_SECRET || 'dev-secret',
        RESEND_API_KEY: process.env.RESEND_API_KEY || '',
        SITE_URL: process.env.SITE_URL || 'http://localhost:3000',
        SITE_NAME: process.env.SITE_NAME || 'My Blog',
      }
    }
  }

  // Fallback to process.env for compatibility
  console.log('Using process.env fallback')
  return {
    DB: process.env.DB as unknown as D1Database,
    R2: process.env.R2 as unknown as R2Bucket,
    JWT_SECRET: process.env.JWT_SECRET || '',
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
    SITE_URL: process.env.SITE_URL || 'http://localhost:3000',
    SITE_NAME: process.env.SITE_NAME || 'My Blog',
  }
}

export function successResponse<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    { success: true, data },
    { status }
  )
}

export function errorResponse(
  error: string,
  status = 400,
  code?: string,
  details?: Record<string, string[]>
): NextResponse<ApiResponse> {
  return NextResponse.json(
    { success: false, error, code, details },
    { status }
  )
}

export function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  
  const token = request.cookies.get('access_token')?.value
  return token || null
}

export async function getUserFromRequest(
  request: NextRequest,
  env: Env
): Promise<User | null> {
  const token = getTokenFromRequest(request)
  if (!token) return null
  
  const payload = await verifyJWT(token, env.JWT_SECRET)
  if (!payload) return null
  
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL')
    .bind(payload.sub)
    .first<User>()
  
  return user
}

export async function withAuth(
  request: NextRequest,
  handler: (user: User, env: Env) => Promise<NextResponse>
): Promise<NextResponse> {
  const env = getEnv()
  const user = await getUserFromRequest(request, env)
  
  if (!user) {
    return errorResponse('未授权访问', 401, 'UNAUTHORIZED')
  }
  
  return handler(user, env)
}

export async function withRole(
  request: NextRequest,
  roles: string[],
  handler: (user: User, env: Env) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(request, async (user, env) => {
    if (!roles.includes(user.role)) {
      return errorResponse('权限不足', 403, 'FORBIDDEN')
    }
    return handler(user, env)
  })
}

export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
  remember = false
): void {
  const accessTokenMaxAge = 60 * 15
  const refreshTokenMaxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7
  
  response.cookies.set('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: accessTokenMaxAge,
    path: '/',
  })
  
  response.cookies.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: refreshTokenMaxAge,
    path: '/',
  })
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.delete('access_token')
  response.cookies.delete('refresh_token')
}

export function getClientInfo(request: NextRequest): {
  userAgent: string | null
  ipAddress: string | null
} {
  return {
    userAgent: request.headers.get('user-agent'),
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               request.headers.get('x-real-ip') || 
               null,
  }
}
