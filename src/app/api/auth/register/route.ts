import { NextRequest, NextResponse } from 'next/server'
import { connectDB, User } from '@/lib/db'
import { AuthUtils } from '@/lib/auth/utils'
import { APIResponse, RegisterRequest } from '@/types'

/**
 * User registration endpoint
 * POST /api/auth/register
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB()
    
    const body: RegisterRequest = await request.json()
    const { email, password, firstName, lastName, phoneNumber, agreeToTerms } = body

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !agreeToTerms) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'All required fields must be provided and terms must be agreed to'
        }
      } as APIResponse, { status: 400 })
    }

    // Validate email format
    if (!AuthUtils.isValidEmail(email)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email format'
        }
      } as APIResponse, { status: 400 })
    }

    // Validate password strength
    const passwordValidation = AuthUtils.validatePassword(password)
    if (!passwordValidation.valid) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password does not meet requirements',
          details: passwordValidation.errors
        }
      } as APIResponse, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      email: email.toLowerCase() 
    })

    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'An account with this email already exists'
        }
      } as APIResponse, { status: 409 })
    }

    // Hash password
    const hashedPassword = await AuthUtils.hashPassword(password)

    // Create new user
    const newUser = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phoneNumber: phoneNumber?.trim(),
      kycStatus: 'pending',
      isActive: true,
      preferences: {
        theme: 'system',
        language: 'en',
        notifications: {
          email: true,
          sms: false,
          push: true
        }
      }
    })

    // Generate session data
    const sessionData = AuthUtils.generateSessionData(newUser)

    return NextResponse.json({
      success: true,
      data: sessionData,
      message: 'Account created successfully'
    } as APIResponse, { status: 201 })

  } catch (error) {
    console.error('Registration error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Registration failed. Please try again.'
      }
    } as APIResponse, { status: 500 })
  }
}
