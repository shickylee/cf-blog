'use client'

import { useState, useEffect } from 'react'
import { Container } from '@/components/ui/container'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/toast'
import { Link2, ExternalLink, Loader2, CheckCircle } from 'lucide-react'

interface FriendLink {
  id: string
  name: string
  url: string
  description: string
  logo: string
  status: string
  sort_order: number
}

export default function FriendsPage() {
  const [friendLinks, setFriendLinks] = useState<FriendLink[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { showToast } = useToast()
  
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    description: '',
    logo: '',
    contact_email: ''
  })

  useEffect(() => {
    fetchFriendLinks()
  }, [])

  const fetchFriendLinks = async () => {
    try {
      const res = await fetch('/api/friend-links?status=approved')
      const data = await res.json() as { success: boolean; data: { friendLinks: FriendLink[] } }
      if (data.success) {
        setFriendLinks(data.data.friendLinks || [])
      }
    } catch (error) {
      console.error('Failed to fetch friend links:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch('/api/friend-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json() as { success: boolean; error?: string }

      if (data.success) {
        showToast('友链申请已提交，等待审核', 'success')
        setFormData({
          name: '',
          url: '',
          description: '',
          logo: '',
          contact_email: ''
        })
      } else {
        showToast(data.error || '提交失败', 'error')
      }
    } catch (error) {
      console.error('Failed to submit friend link:', error)
      showToast('提交失败，请稍后重试', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container>
      <div className="max-w-4xl mx-auto py-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">友情链接</h1>
          <p className="text-gray-600">与志同道合的朋友们相互链接</p>
        </div>

        {friendLinks.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              合作伙伴
            </h2>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse"></div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {friendLinks.map(link => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      {link.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={link.logo} alt={link.name} className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                          <Link2 className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 truncate group-hover:text-primary-600">
                            {link.name}
                          </h3>
                          <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        </div>
                        {link.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{link.description}</p>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-800">申请友链须知</h3>
                <ul className="text-sm text-amber-700 mt-1 space-y-1">
                  <li>• 请先在您的网站上添加本站链接后再申请</li>
                  <li>• 申请后需要等待审核，审核通过后才会显示</li>
                  <li>• 请确保网站内容合法健康，遵守互联网规范</li>
                </ul>
              </div>
            </div>
          </div>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">申请友链</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">网站名称 *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="请输入网站名称"
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="url">网站地址 *</Label>
                    <Input
                      id="url"
                      type="url"
                      value={formData.url}
                      onChange={e => setFormData(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://example.com"
                      required
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="logo">网站图标（可选）</Label>
                    <Input
                      id="logo"
                      type="url"
                      value={formData.logo}
                      onChange={e => setFormData(prev => ({ ...prev, logo: e.target.value }))}
                      placeholder="https://example.com/logo.png"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact_email">联系方式（可选）</Label>
                    <Input
                      id="contact_email"
                      type="email"
                      value={formData.contact_email}
                      onChange={e => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                      placeholder="your@email.com"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">网站描述（可选）</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="请简要介绍您的网站"
                    rows={3}
                    className="mt-1"
                  />
                </div>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    '提交申请'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  )
}
