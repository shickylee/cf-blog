'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/components/toast'
import { Link2, ExternalLink, Trash2, Edit, Check, X, Clock } from 'lucide-react'

interface FriendLink {
  id: string
  name: string
  url: string
  description: string
  logo: string
  contact_email: string
  status: 'pending' | 'approved' | 'rejected'
  sort_order: number
  created_at: string
}

export default function AdminFriendLinksPage() {
  const [friendLinks, setFriendLinks] = useState<FriendLink[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingLink, setEditingLink] = useState<FriendLink | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { showToast } = useToast()
  
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    description: '',
    logo: '',
    contact_email: '',
    status: 'pending' as 'pending' | 'approved' | 'rejected',
    sort_order: 0
  })

  useEffect(() => {
    fetchFriendLinks()
  }, [])

  const fetchFriendLinks = async () => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('access_token='))
        ?.split('=')[1]

      const res = await fetch('/api/admin/friend-links', {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      })
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

  const handleOpenDialog = (link?: FriendLink) => {
    if (link) {
      setEditingLink(link)
      setFormData({
        name: link.name,
        url: link.url,
        description: link.description || '',
        logo: link.logo || '',
        contact_email: link.contact_email || '',
        status: link.status,
        sort_order: link.sort_order
      })
    } else {
      setEditingLink(null)
      setFormData({
        name: '',
        url: '',
        description: '',
        logo: '',
        contact_email: '',
        status: 'pending',
        sort_order: 0
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingLink(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('access_token='))
        ?.split('=')[1]

      const res = await fetch('/api/admin/friend-links', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          id: editingLink?.id,
          ...formData
        })
      })
      const data = await res.json() as { success: boolean; error?: string }

      if (data.success) {
        handleCloseDialog()
        fetchFriendLinks()
        showToast(editingLink ? '友链更新成功' : '友链创建成功', 'success')
      } else {
        showToast(data.error || '操作失败', 'error')
      }
    } catch (error) {
      console.error('Failed to save friend link:', error)
      showToast('操作失败', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个友链吗？')) return

    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('access_token='))
        ?.split('=')[1]

      const res = await fetch(`/api/admin/friend-links?id=${id}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      })
      const data = await res.json() as { success: boolean; error?: string }

      if (data.success) {
        fetchFriendLinks()
        showToast('友链删除成功', 'success')
      } else {
        showToast(data.error || '删除失败', 'error')
      }
    } catch (error) {
      console.error('Failed to delete friend link:', error)
      showToast('删除失败', 'error')
    }
  }

  const handleStatusChange = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('access_token='))
        ?.split('=')[1]

      const res = await fetch('/api/admin/friend-links', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ id, status })
      })
      const data = await res.json() as { success: boolean; error?: string }

      if (data.success) {
        fetchFriendLinks()
        showToast(status === 'approved' ? '已通过审核' : '已拒绝', 'success')
      } else {
        showToast(data.error || '操作失败', 'error')
      }
    } catch (error) {
      console.error('Failed to update status:', error)
      showToast('操作失败', 'error')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"><Check className="w-3 h-3" />已通过</span>
      case 'rejected':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><X className="w-3 h-3" />已拒绝</span>
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3" />待审核</span>
    }
  }

  const pendingLinks = friendLinks.filter(l => l.status === 'pending')
  const approvedLinks = friendLinks.filter(l => l.status === 'approved')
  const rejectedLinks = friendLinks.filter(l => l.status === 'rejected')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">友链管理</h1>
        <Button onClick={() => handleOpenDialog()}>
          <Link2 className="w-4 h-4 mr-2" />
          添加友链
        </Button>
      </div>

      {pendingLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              待审核 ({pendingLinks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingLinks.map(link => (
                <div key={link.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    {link.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={link.logo} alt={link.name} className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                        <Link2 className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium">{link.name}</div>
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        {link.url}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleStatusChange(link.id, 'approved')}>
                      <Check className="w-4 h-4 mr-1" />
                      通过
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleStatusChange(link.id, 'rejected')}>
                      <X className="w-4 h-4 mr-1" />
                      拒绝
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleOpenDialog(link)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(link.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>所有友链 ({friendLinks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
              ))}
            </div>
          ) : friendLinks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              暂无友链
            </div>
          ) : (
            <div className="space-y-4">
              {friendLinks.map(link => (
                <div key={link.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    {link.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={link.logo} alt={link.name} className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                        <Link2 className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {link.name}
                        {getStatusBadge(link.status)}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        {link.url}
                      </div>
                      {link.description && (
                        <div className="text-sm text-gray-400 mt-1">{link.description}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleOpenDialog(link)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(link.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md" onClose={() => setIsDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>{editingLink ? '编辑友链' : '添加友链'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">网站名称 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
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
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="logo">网站图标</Label>
              <Input
                id="logo"
                type="url"
                value={formData.logo}
                onChange={e => setFormData(prev => ({ ...prev, logo: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="contact_email">联系方式</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={e => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="description">网站描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status">状态</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  className="mt-1 w-full px-3 py-2 border rounded-md"
                >
                  <option value="pending">待审核</option>
                  <option value="approved">已通过</option>
                  <option value="rejected">已拒绝</option>
                </select>
              </div>
              <div>
                <Label htmlFor="sort_order">排序</Label>
                <Input
                  id="sort_order"
                  type="number"
                  min="0"
                  value={formData.sort_order}
                  onChange={e => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? '提交中...' : '保存'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
