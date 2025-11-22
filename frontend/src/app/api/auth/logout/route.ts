import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/middleware'
import { APIResponse } from '@/types'

/**
 * User logout endpoint
 * POST /api/auth/logout
 */
export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    // In a more advanced implementation, you might:
    // 1. Blacklist the current token
    // 2. Clear user sessions from database
    // 3. Log the logout event

    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    } as APIResponse, { status: 200 })

    // Clear refresh token cookie
    response.cookies.set('refreshToken', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0 // Expire immediately
    })

    return response

  } catch (error) {
    console.error('Logout error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Logout failed. Please try again.'
      }
    } as APIResponse, { status: 500 })
  }
})
