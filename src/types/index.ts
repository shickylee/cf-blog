export interface Post {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string | null
  cover_image: string | null
  author_id: string
  category_id: string | null
  status: string
  view_count: number
  published_at: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  author?: { id: string; name: string; avatar_url: string | null }
  category?: { id: string; name: string; slug: string } | null
  tags?: { id: string; name: string; slug: string }[]
}

export interface PostListItem {
  id: string
  title: string
  slug: string
  excerpt: string | null
  cover_image: string | null
  author_id: string
  category_id: string | null
  status: string
  view_count: number
  published_at: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  author?: { id: string; name: string; avatar_url: string | null }
  category?: { id: string; name: string; slug: string } | null
  tags?: { id: string; name: string; slug: string }[]
}

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  sort_order?: number
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  name: string
  slug: string
  created_at: string
  updated_at: string
}

export interface CategoryGroup {
  name: string
  slug: string
  posts: PostListItem[]
}

export interface Comment {
  id: string
  post_id: string
  author_id: string | null
  user_id: string | null
  guest_name: string | null
  guest_email: string | null
  content: string
  parent_id: string | null
  status: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  author?: { id: string; name: string; avatar_url: string | null }
  replies?: Comment[]
}

export interface User {
  id: string
  name: string
  email: string
  avatar_url: string | null
  role: string
  password_hash?: string
  email_verified_at?: string | null
  oauth_providers?: string
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  user_id: string
  refresh_token: string
  user_agent?: string
  ip_address?: string
  expires_at: string
  created_at: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
  details?: Record<string, string[]>
}

export interface JWTPayload {
  sub: string
  email: string
  role: string
  iat?: number
  exp?: number
}

export interface PasswordReset {
  id: string
  user_id: string
  email: string
  token: string
  expires_at: string
  created_at: string
}

export interface EmailVerification {
  id: string
  user_id: string
  email: string
  token: string
  expires_at: string
  created_at: string
}

export interface Env {
  DB: D1Database
  R2: R2Bucket
  JWT_SECRET: string
  RESEND_API_KEY?: string
  SITE_URL: string
  SITE_NAME: string
  request?: Request
}
