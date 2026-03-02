import { NextRequest, NextResponse } from 'next/server'
import { getEnv, errorResponse, successResponse } from '@/lib/api'
import { generateUUID } from '@/lib/utils'

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const env = getEnv()
    
    const token = request.cookies.get('access_token')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return errorResponse('请先登录', 401)
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return errorResponse('请选择要上传的文件', 400)
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return errorResponse('仅支持 JPG、PNG、GIF、WebP 格式的图片', 400)
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return errorResponse('图片大小不能超过 5MB', 400)
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${generateUUID()}.${ext}`

    let imageUrl = ''

    if (env.R2) {
      await env.R2.put(filename, buffer, {
        httpMetadata: {
          contentType: file.type,
        },
      })
      
      if (env.R2_PUBLIC_URL) {
        imageUrl = `${env.R2_PUBLIC_URL}/${filename}`
      } else {
        imageUrl = `/assets/${filename}`
      }
    } else {
      const fs = await import('fs')
      const path = await import('path')
      
      const uploadDir = path.join(process.cwd(), 'public', 'assets')
      
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true })
      }
      
      const filePath = path.join(uploadDir, filename)
      fs.writeFileSync(filePath, buffer)
      
      imageUrl = `/assets/${filename}`
    }

    return successResponse({
      url: imageUrl,
      filename,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return errorResponse('上传图片失败', 500)
  }
}
