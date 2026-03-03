'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'

export default function SearchBox() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    setKeyword(searchParams.get('search') || '')
  }, [searchParams])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(window.location.search)
    if (keyword.trim()) {
      params.set('search', keyword.trim())
    } else {
      params.delete('search')
    }
    params.set('page', '1')
    router.push(`/posts?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSearch} className="w-full max-w-md mx-auto">
      <div className="flex gap-2">
        <Input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索文章标题、内容..."
          className="flex-1 h-10"
        />
        <button
          type="submit"
          className="px-4 h-10 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors whitespace-nowrap flex items-center justify-center"
        >
          搜索
        </button>
      </div>
    </form>
  )
}
