import { NextRequest, NextResponse } from 'next/server'
import { AuthUtils } from '@/lib/auth/utils'
import { connectDB, User } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Extract and verify token
    const token = AuthUtils.extractTokenFromHeader(request)
    if (!token) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No authentication token provided'
        }
      }, { status: 401 })
    }

    // Verify token
    const decoded = AuthUtils.verifyToken(token)
    
    // Connect to database and get user
    await connectDB()
    const user = await User.findById(decoded.userId).select('-password')
    
    if (!user || !user.isActive) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid user or account inactive'
        }
      }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      data: {
        user: AuthUtils.sanitizeUser(user)
      }
    }, { status: 200 })

  } catch (error) {
    console.error('Get profile error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: error instanceof Error ? error.message : 'Authentication failed'
      }
    }, { status: 401 })
  }
}
