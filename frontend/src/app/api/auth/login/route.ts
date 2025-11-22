import { NextRequest, NextResponse } from 'next/server'
import { connectDB, User } from '@/lib/db'
import { AuthUtils } from '@/lib/auth/utils'
import { APIResponse, LoginRequest } from '@/types'

/**
 * User login endpoint
 * POST /api/auth/login
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB()
    
    const body: LoginRequest = await request.json()
    const { email, password, rememberMe } = body

    // Validate input
    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required'
        }
      } as APIResponse, { status: 400 })
    }

    if (!AuthUtils.isValidEmail(email)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email format'
        }
      } as APIResponse, { status: 400 })
    }

    // Find user and verify credentials
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      isActive: true 
    }).select('+password')

    if (!user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      } as APIResponse, { status: 401 })
    }

    // Check password
    const isValidPassword = await AuthUtils.comparePassword(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      } as APIResponse, { status: 401 })
    }

    // Check KYC status
    if (user.kycStatus === 'rejected') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'ACCOUNT_REJECTED',
          message: 'Your account has been rejected. Please contact support.'
        }
      } as APIResponse, { status: 403 })
    }

    // Update last login
    user.lastLoginAt = new Date()
    await user.save()

    // Generate session data
    const sessionData = AuthUtils.generateSessionData(user)

    // Set HTTP-only cookie for refresh token if remember me is selected
    const response = NextResponse.json({
      success: true,
      data: sessionData
    } as APIResponse, { status: 200 })

    if (rememberMe) {
      response.cookies.set('refreshToken', sessionData.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      })
    }

    return response

  } catch (error) {
    console.error('Login error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Login failed. Please try again.'
      }
    } as APIResponse, { status: 500 })
  }
}
