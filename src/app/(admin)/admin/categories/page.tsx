'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FolderOpen, BookOpen, Code, Lightbulb, Camera, Music, Globe, Heart, Star, Rocket, Paintbrush } from 'lucide-react'

const CATEGORY_ICONS = [
  { value: 'folder', icon: FolderOpen, label: '文件夹', color: 'from-primary-500 to-primary-600' },
  { value: 'book-open', icon: BookOpen, label: '技术', color: 'from-blue-500 to-blue-600' },
  { value: 'code', icon: Code, label: '编程', color: 'from-gray-500 to-gray-600' },
  { value: 'lightbulb', icon: Lightbulb, label: '创意', color: 'from-yellow-500 to-yellow-600' },
  { value: 'camera', icon: Camera, label: '摄影', color: 'from-pink-500 to-pink-600' },
  { value: 'music', icon: Music, label: '音乐', color: 'from-purple-500 to-purple-600' },
  { value: 'globe', icon: Globe, label: '互联网', color: 'from-cyan-500 to-cyan-600' },
  { value: 'heart', icon: Heart, label: '生活', color: 'from-red-500 to-red-600' },
  { value: 'star', icon: Star, label: '收藏', color: 'from-orange-500 to-orange-600' },
  { value: 'rocket', icon: Rocket, label: '科技', color: 'from-indigo-500 to-indigo-600' },
  { value: 'paintbrush', icon: Paintbrush, label: '设计', color: 'from-green-500 to-green-600' },
]

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string
  sort_order: number
  created_at: string
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({ name: '', slug: '', description: '', icon: 'folder', sort_order: 0 })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = () => {
    fetch('/api/categories')
      .then<{ success: boolean; data: { categories: Category[] }; error?: string }>(res => res.json())
      .then(data => {
        if (data.success) {
          setCategories(data.data.categories || [])
        } else {
          setError(data.error || '获取分类列表失败')
        }
      })
      .catch(() => {
        setError('获取分类列表失败')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  const handleOpenDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category)
      setFormData({
        name: category.name,
        slug: category.slug,
        description: category.description || '',
        icon: category.icon || 'folder',
        sort_order: category.sort_order
      })
    } else {
      setEditingCategory(null)
      setFormData({ name: '', slug: '', description: '', icon: 'folder', sort_order: 0 })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingCategory(null)
    setFormData({ name: '', slug: '', description: '', icon: 'folder', sort_order: 0 })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('access_token='))
        ?.split('=')[1]

      const url = editingCategory 
        ? `/api/categories/${editingCategory.id}`
        : '/api/categories'
      const method = editingCategory ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(formData)
      })

      const data = await res.json() as { success: boolean; error?: string }

      if (data.success) {
        handleCloseDialog()
        fetchCategories()
      } else {
        setError(data.error || (editingCategory ? '更新分类失败' : '创建分类失败'))
      }
    } catch {
      setError(editingCategory ? '更新分类失败' : '创建分类失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个分类吗？')) return

    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('access_token='))
        ?.split('=')[1]

      const res = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      })

      const data = await res.json() as { success: boolean; error?: string }

      if (data.success) {
        fetchCategories()
      } else {
        setError(data.error || '删除分类失败')
      }
    } catch {
      setError('删除分类失败')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">分类管理</h2>
        <Button onClick={() => handleOpenDialog()}>新建分类</Button>
      </div>

      {error && (
        <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center py-12 text-gray-500">加载中...</div>
            ) : categories.length > 0 ? (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      图标
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      名称
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Slug
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      描述
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      排序
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {categories.map((category) => {
                    const iconData = CATEGORY_ICONS.find(i => i.value === (category.icon || 'folder')) || CATEGORY_ICONS[0]
                    const IconComponent = iconData.icon
                    return (
                    <tr key={category.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${iconData.color} flex items-center justify-center`}>
                          <IconComponent className="w-5 h-5 text-white" />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{category.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{category.slug}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500 max-w-xs truncate">
                          {category.description || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{category.sort_order}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => handleOpenDialog(category)}
                          className="text-primary-600 hover:text-primary-900 mr-4"
                        >
                          编辑
                        </button>
                        <button 
                          onClick={() => handleDelete(category.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12 text-gray-500">暂无分类</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent onClose={handleCloseDialog}>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingCategory ? '编辑分类' : '新建分类'}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">名称 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="请输入分类名称"
                  required
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="slug">Slug（可选）</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={e => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="留空则根据名称自动生成"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label>图标</Label>
                <div className="mt-2 grid grid-cols-6 gap-2">
                  {CATEGORY_ICONS.map((item) => {
                    const IconComponent = item.icon
                    const isSelected = formData.icon === item.value
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon: item.value })}
                        className={`p-2 rounded-lg flex flex-col items-center gap-1 transition-all ${
                          isSelected 
                            ? 'ring-2 ring-primary-500 bg-primary-50' 
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center shadow-md`}>
                          <IconComponent className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xs text-gray-600">{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">描述</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="请输入分类描述（可选）"
                  className="mt-1"
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="sort_order">排序</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? '提交中...' : (editingCategory ? '更新' : '创建')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
