'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/toast'

interface UserProfile {
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
  site_favicon: string
  turnstile_site_key: string
  turnstile_secret_key: string
}

interface AuthResponse {
  success: boolean
  data?: { user: UserProfile }
  error?: string
}

interface SettingsResponse {
  success: boolean
  data?: { settings: Record<string, string> }
  error?: string
}

interface ProfileUpdateResponse {
  success: boolean
  error?: string
}

interface UploadResponse {
  success: boolean
  data?: { url: string }
  error?: string
}

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'site'>('profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileForm, setProfileForm] = useState({
    email: '',
    name: '',
    avatar_url: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    site_name: '',
    site_title: '',
    site_subtitle: '',
    site_description: '',
    site_copyright: '',
    site_favicon: '',
    turnstile_site_key: '',
    turnstile_secret_key: '',
  })
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then<AuthResponse>(res => res.json()),
      fetch('/api/admin/settings').then<SettingsResponse>(res => res.json())
    ])
      .then(([userRes, settingsRes]) => {
        if (userRes.success && userRes.data) {
          setProfile(userRes.data.user)
          setProfileForm(prev => ({
            ...prev,
            email: userRes.data!.user.email || '',
            name: userRes.data!.user.name || '',
            avatar_url: userRes.data!.user.avatar_url || '',
          }))
        }
        if (settingsRes.success && settingsRes.data) {
          setSiteSettings({
            site_name: settingsRes.data.settings.site_name || '',
            site_title: settingsRes.data.settings.site_title || '',
            site_subtitle: settingsRes.data.settings.site_subtitle || '',
            site_description: settingsRes.data.settings.site_description || '',
            site_copyright: settingsRes.data.settings.site_copyright || '',
            site_favicon: settingsRes.data.settings.site_favicon || '',
            turnstile_site_key: settingsRes.data.settings.turnstile_site_key || '',
            turnstile_secret_key: settingsRes.data.settings.turnstile_secret_key || '',
          })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const handleProfileSave = async () => {
    if (profileForm.newPassword && profileForm.newPassword !== profileForm.confirmPassword) {
      showToast('两次输入的密码不一致', 'error')
      return
    }
    
    setSaving(true)
    
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profileForm.email,
          name: profileForm.name,
          avatar_url: profileForm.avatar_url,
          currentPassword: profileForm.currentPassword || undefined,
          newPassword: profileForm.newPassword || undefined,
        }),
      })
      const data = await res.json() as ProfileUpdateResponse
      
      if (data.success) {
        showToast('保存成功', 'success')
        setProfile(prev => prev ? { ...prev, email: profileForm.email, name: profileForm.name, avatar_url: profileForm.avatar_url } : null)
        setProfileForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }))
      } else {
        showToast(data.error || '保存失败', 'error')
      }
    } catch {
      showToast('保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSiteSettingsSave = async (key: string, value: string) => {
    setSaving(true)
    
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      const data = await res.json() as ProfileUpdateResponse
      
      if (data.success) {
        showToast('保存成功', 'success')
      } else {
        showToast(data.error || '保存失败', 'error')
      }
    } catch {
      showToast('保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json() as UploadResponse
      
      if (data.success && data.data) {
        setProfileForm(prev => ({ ...prev, avatar_url: data.data!.url }))
        showToast('头像已上传，请点击"保存"按钮生效', 'info')
      }
    } catch (error) {
      console.error('Upload failed:', error)
      showToast('上传失败', 'error')
    }
  }

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json() as UploadResponse
      
      if (data.success && data.data) {
        setSiteSettings(prev => ({ ...prev, site_favicon: data.data!.url }))
        showToast('图标已上传，请点击"保存"按钮生效', 'info')
      }
    } catch (error) {
      console.error('Upload failed:', error)
      showToast('上传失败', 'error')
    }
  }

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">系统设置</h2>
        <div className="text-center py-12 text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">系统设置</h2>
      
      <div className="flex gap-4 border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 px-1 text-sm font-medium transition-colors ${
            activeTab === 'profile'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          个人资料
        </button>
        <button
          onClick={() => setActiveTab('site')}
          className={`pb-3 px-1 text-sm font-medium transition-colors ${
            activeTab === 'site'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          网站设置
        </button>
      </div>

      {activeTab === 'profile' && (
        <Card>
          <CardHeader>
            <CardTitle>个人资料</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                {profileForm.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileForm.avatar_url}
                    alt="头像"
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-600 text-2xl font-medium">
                      {(profile?.name || profile?.email || 'A').charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center hover:bg-primary-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
              <div>
                <p className="text-sm text-gray-500">点击图标上传头像</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
              <input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="请输入邮箱"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-red-500 mt-1">邮箱地址是管理员登录账号，谨慎修改，点击保存前请确保输入正确的信息</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">昵称</label>
              <input
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="请输入昵称"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">头像链接</label>
              <input
                type="url"
                value={profileForm.avatar_url}
                onChange={(e) => setProfileForm(prev => ({ ...prev, avatar_url: e.target.value }))}
                placeholder="输入头像图片URL"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-4">修改密码（可选）</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">当前密码</label>
                  <input
                    type="password"
                    value={profileForm.currentPassword}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="请输入当前密码"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
                  <input
                    type="password"
                    value={profileForm.newPassword}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="请输入新密码"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">确认新密码</label>
                  <input
                    type="password"
                    value={profileForm.confirmPassword}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="请再次输入新密码"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleProfileSave}
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'site' && (
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">网站名称</label>
              <input
                type="text"
                value={siteSettings.site_name}
                onChange={(e) => setSiteSettings(prev => ({ ...prev, site_name: e.target.value }))}
                placeholder="请输入网站名称"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">首页标题</label>
              <input
                type="text"
                value={siteSettings.site_title}
                onChange={(e) => setSiteSettings(prev => ({ ...prev, site_title: e.target.value }))}
                placeholder="显示在首页的大标题，如：我的博客"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">首页副标题</label>
              <input
                type="text"
                value={siteSettings.site_subtitle}
                onChange={(e) => setSiteSettings(prev => ({ ...prev, site_subtitle: e.target.value }))}
                placeholder="显示在首页标题下方的描述文字"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">网站描述</label>
              <textarea
                value={siteSettings.site_description}
                onChange={(e) => setSiteSettings(prev => ({ ...prev, site_description: e.target.value }))}
                placeholder="请输入网站描述"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">版权信息</label>
              <input
                type="text"
                value={siteSettings.site_copyright}
                onChange={(e) => setSiteSettings(prev => ({ ...prev, site_copyright: e.target.value }))}
                placeholder="© 2026 My Blog. All rights reserved."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="pt-6 mt-6 border-t border-gray-200">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Cloudflare Turnstile 验证</h4>
              <p className="text-sm text-gray-500 mb-4">用于Blog前台用户交互时人机验证，有效防止垃圾信息或者恶意提交</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Site Key（前端使用）</label>
                  <input
                    type="text"
                    value={siteSettings.turnstile_site_key}
                    onChange={(e) => setSiteSettings(prev => ({ ...prev, turnstile_site_key: e.target.value }))}
                    placeholder="0x4AAAAAAAxxx"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Secret Key（后端验证）</label>
                  <input
                    type="text"
                    value={siteSettings.turnstile_secret_key}
                    onChange={(e) => setSiteSettings(prev => ({ ...prev, turnstile_secret_key: e.target.value }))}
                    placeholder="0x4AAAAAAAxxx"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">请前往 <a href="https://www.cloudflare.com/products/turnstile/" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Cloudflare Turnstile</a> 获取密钥</p>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">网站图标 (Favicon)</label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {siteSettings.site_favicon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={siteSettings.site_favicon}
                      alt="Favicon"
                      className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <button
                    onClick={() => faviconInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center hover:bg-primary-700"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <input
                    ref={faviconInputRef}
                    type="file"
                    accept="image/x-icon,image/png,image/svg+xml"
                    onChange={handleFaviconUpload}
                    className="hidden"
                  />
                </div>
                <div>
                  <p className="text-sm text-gray-500">推荐 32x32 或 48x48 的 PNG/SVG 图标</p>
                  {siteSettings.site_favicon && (
                    <button
                      onClick={() => setSiteSettings(prev => ({ ...prev, site_favicon: '' }))}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      移除图标
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <button
                onClick={async () => {
                  await handleSiteSettingsSave('site_name', siteSettings.site_name)
                  await handleSiteSettingsSave('site_title', siteSettings.site_title)
                  await handleSiteSettingsSave('site_subtitle', siteSettings.site_subtitle)
                  await handleSiteSettingsSave('site_description', siteSettings.site_description)
                  await handleSiteSettingsSave('site_copyright', siteSettings.site_copyright)
                  await handleSiteSettingsSave('site_favicon', siteSettings.site_favicon)
                  await handleSiteSettingsSave('turnstile_site_key', siteSettings.turnstile_site_key)
                  await handleSiteSettingsSave('turnstile_secret_key', siteSettings.turnstile_secret_key)
                }}
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
