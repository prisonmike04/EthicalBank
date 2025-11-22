import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/middleware'
import { AuthUtils } from '@/lib/auth/utils'
import { APIResponse } from '@/types'

/**
 * Get current user profile
 * GET /api/auth/me
 */
export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    return NextResponse.json({
      success: true,
      data: {
        user: AuthUtils.sanitizeUser(user)
      }
    } as APIResponse, { status: 200 })

  } catch (error) {
    console.error('Get profile error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get user profile'
      }
    } as APIResponse, { status: 500 })
  }
})

/**
 * Update user profile
 * PUT /api/auth/me
 */
export const PUT = withAuth(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json()
    const { firstName, lastName, phoneNumber, preferences } = body

    // Update allowed fields only
    if (firstName) user.firstName = firstName.trim()
    if (lastName) user.lastName = lastName.trim()
    if (phoneNumber) user.phoneNumber = phoneNumber.trim()
    if (preferences) {
      user.preferences = {
        ...user.preferences,
        ...preferences
      }
    }

    await user.save()

    return NextResponse.json({
      success: true,
      data: {
        user: AuthUtils.sanitizeUser(user)
      },
      message: 'Profile updated successfully'
    } as APIResponse, { status: 200 })

  } catch (error) {
    console.error('Update profile error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update profile'
      }
    } as APIResponse, { status: 500 })
  }
})
