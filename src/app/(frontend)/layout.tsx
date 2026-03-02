'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Container } from '@/components/ui/container'

interface User {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  role: string
}

interface SiteSettings {
  site_name: string
  site_title: string
  site_subtitle: string
  site_description: string
  site_copyright: string
}

export default function FrontendLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json() as { success: boolean; data: { user: User } }
          if (data.success) {
            setUser(data.data.user)
          }
        }
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    const fetchSettings = async () => {
      setSettingsLoading(true)
      try {
        const res = await fetch('/api/settings')
        const data = await res.json() as { success: boolean; data: Record<string, string> }
        if (data.success && data.data) {
          setSiteSettings({
            site_name: data.data.site_name || 'My Blog',
            site_title: data.data.site_title || '我的博客',
            site_subtitle: data.data.site_subtitle || '分享技术，记录生活',
            site_description: data.data.site_description || '',
            site_copyright: data.data.site_copyright || '',
          })
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error)
      } finally {
        setSettingsLoading(false)
      }
    }

    checkAuth()
    fetchSettings()
  }, [pathname])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      window.location.href = '/'
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const displayName = siteSettings?.site_name || 'My Blog'
  const displayCopyright = siteSettings?.site_copyright || `© ${new Date().getFullYear()} My Blog. All rights reserved.`

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <Container>
          <div className="flex items-center justify-between h-16">
            {settingsLoading ? (
              <div className="animate-pulse h-6 w-32 bg-gray-200 rounded"></div>
            ) : (
              <Link href="/" className="text-xl font-bold text-primary-600">
                {displayName}
              </Link>
            )}
            <nav className="flex items-center space-x-6">
              <Link 
                href="/" 
                className={`text-gray-600 hover:text-gray-900 ${pathname === '/' ? 'text-primary-600' : ''}`}
              >
                首页
              </Link>
              <Link 
                href="/posts" 
                className={`text-gray-600 hover:text-gray-900 ${pathname === '/posts' ? 'text-primary-600' : ''}`}
              >
                文章
              </Link>
              {!loading && (
                user ? (
                  <div className="flex items-center gap-4">
                    <Link
                      href="/admin"
                      className="text-sm text-gray-600 hover:text-gray-900"
                    >
                      管理后台
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      退出
                    </button>
                  </div>
                ) : (
                  <Link href="/login" className="text-gray-600 hover:text-gray-900">
                    登录
                  </Link>
                )
              )}
            </nav>
          </div>
        </Container>
      </header>
      <main className="flex-1 bg-gray-50 pb-8">{children}</main>
      <footer className="bg-gray-50 border-t border-gray-200">
        <Container>
          <div className="py-8 text-center text-gray-600">
            {settingsLoading ? (
              <div className="animate-pulse h-4 w-48 bg-gray-200 rounded mx-auto"></div>
            ) : (
              <p>{displayCopyright}</p>
            )}
            <p className="text-sm text-gray-400 mt-2">
              本站基于 <a href="https://cf-blog.huoli.fun" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700">CF-blog</a> 搭建
            </p>
            <Link href="/sitemap.xml" className="text-sm text-gray-400 hover:text-gray-600 mt-2 inline-block">
              Sitemap
            </Link>
          </div>
        </Container>
      </footer>
    </div>
  )
}
