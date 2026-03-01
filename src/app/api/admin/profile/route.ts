import { NextRequest, NextResponse } from 'next/server'
import { withRole } from '@/lib/api'
import { hashPassword } from '@/lib/auth/password'
import type { User } from '@/types'

export async function PUT(request: NextRequest): Promise<NextResponse> {
  return withRole(request, ['admin'], async (user: User, env) => {
    try {
      console.log('=== UPDATE PROFILE DEBUG START ===')
      console.log('User ID:', user.id)
      
      const body = await request.json() as { name?: string; email?: string; avatar_url?: string; currentPassword?: string; newPassword?: string }
      const { name, email, avatar_url, currentPassword, newPassword } = body

      console.log('Request body:', { name, email, avatar_url, hasNewPassword: !!newPassword, hasCurrentPassword: !!currentPassword })

      if (!name && !email && !avatar_url && !newPassword) {
        console.log('No fields to update')
        return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 })
      }

      if (newPassword) {
        console.log('Updating password')
        
        if (!currentPassword) {
          console.log('Missing current password')
          return NextResponse.json({ success: false, error: '请输入当前密码' }, { status: 400 })
        }

        console.log('Querying user password from database...')
        const userRecord: any = await env.DB.prepare(
          'SELECT password_hash FROM users WHERE id = ?'
        ).bind(user.id).first()

        console.log('User record found:', !!userRecord)
        console.log('Stored password hash:', userRecord?.password_hash?.substring(0, 20) + '...')

        if (!userRecord) {
          console.log('User not found')
          return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 })
        }

        console.log('Hashing current password for verification...')
        const currentPasswordHash = await hashPassword(currentPassword)
        console.log('Computed current password hash:', currentPasswordHash.substring(0, 20) + '...')

        const validPassword = currentPasswordHash === userRecord.password_hash
        
        console.log('Password valid:', validPassword)
        
        if (!validPassword) {
          console.log('Current password incorrect')
          return NextResponse.json({ success: false, error: '当前密码错误' }, { status: 400 })
        }

        console.log('Hashing new password...')
        const hashedPassword = await hashPassword(newPassword)
        console.log('New password hash:', hashedPassword.substring(0, 20) + '...')
        
        console.log('Updating user with new password...')
        await env.DB.prepare(
          'UPDATE users SET name = ?, email = ?, avatar_url = ?, password_hash = ?, updated_at = ? WHERE id = ?'
        ).bind(name || user.name, email || user.email, avatar_url || user.avatar_url, hashedPassword, new Date().toISOString(), user.id).run()
        
        console.log('Password update successful')
      } else {
        console.log('Updating user without password...')
        await env.DB.prepare(
          'UPDATE users SET name = ?, email = ?, avatar_url = ?, updated_at = ? WHERE id = ?'
        ).bind(name || user.name, email || user.email, avatar_url || user.avatar_url, new Date().toISOString(), user.id).run()
        
        console.log('Profile update successful')
      }

      console.log('=== UPDATE PROFILE DEBUG END ===')
      return NextResponse.json({ success: true })
    } catch (error: any) {
      console.error('Update profile error:', error)
      console.error('Error stack:', error?.stack)
      return NextResponse.json({ success: false, error: 'Failed to update profile', details: error?.message }, { status: 500 })
    }
  })
}
