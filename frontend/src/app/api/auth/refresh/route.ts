import { NextRequest, NextResponse } from 'next/server'
import { connectDB, User } from '@/lib/db'
import { AuthUtils } from '@/lib/auth/utils'
import { APIResponse } from '@/types'

/**
 * Refresh authentication token
 * POST /api/auth/refresh
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB()
    
    // Try to get refresh token from cookie or body
    const refreshToken = request.cookies.get('refreshToken')?.value || 
                        (await request.json()).refreshToken

    if (!refreshToken) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NO_REFRESH_TOKEN',
          message: 'No refresh token provided'
        }
      } as APIResponse, { status: 401 })
    }

    // Verify refresh token
    const decoded = AuthUtils.verifyToken(refreshToken)
    
    // Get user from database
    const user = await User.findById(decoded.userId).select('-password')
    
    if (!user || !user.isActive) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_USER',
          message: 'Invalid user or account inactive'
        }
      } as APIResponse, { status: 401 })
    }

    // Generate new tokens
    const sessionData = AuthUtils.generateSessionData(user)

    // Set new refresh token cookie
    const response = NextResponse.json({
      success: true,
      data: sessionData
    } as APIResponse, { status: 200 })

    response.cookies.set('refreshToken', sessionData.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    })

    return response

  } catch (error) {
    console.error('Token refresh error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'REFRESH_FAILED',
        message: 'Failed to refresh token'
      }
    } as APIResponse, { status: 401 })
  }
}
