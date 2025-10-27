import { NextRequest, NextResponse } from 'next/server'
import { AuthUtils } from '@/lib/auth/utils'
import { connectDB, User, Account } from '@/lib/db'

interface RouteParams {
  params: {
    accountId: string
  }
}

/**
 * Get specific account details
 * GET /api/accounts/[accountId]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const decoded = AuthUtils.verifyToken(token)
    await connectDB()
    
    const user = await User.findById(decoded.userId)
    if (!user || !user.isActive) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid user or account inactive'
        }
      }, { status: 401 })
    }

    // Find account and verify ownership (exclude closed accounts)
    const account = await Account.findOne({
      _id: params.accountId,
      userId: user._id,
      status: { $ne: 'closed' }
    })

    if (!account) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Account not found'
        }
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: { account }
    }, { status: 200 })

  } catch (error) {
    console.error('Get account error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve account'
      }
    }, { status: 500 })
  }
}

/**
 * Update account details
 * PUT /api/accounts/[accountId]
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const decoded = AuthUtils.verifyToken(token)
    await connectDB()
    
    const user = await User.findById(decoded.userId)
    if (!user || !user.isActive) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid user or account inactive'
        }
      }, { status: 401 })
    }

    // Find account and verify ownership
    const account = await Account.findOne({
      _id: params.accountId,
      userId: user._id
    })

    if (!account) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Account not found'
        }
      }, { status: 404 })
    }

    const body = await request.json()
    const { name, status } = body

    // Update allowed fields only
    if (name !== undefined) account.name = name.trim()
    if (status !== undefined && ['active', 'inactive', 'frozen'].includes(status)) {
      account.status = status
    }
    
    await account.save()

    return NextResponse.json({
      success: true,
      data: { account },
      message: 'Account updated successfully'
    }, { status: 200 })

  } catch (error) {
    console.error('Update account error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update account'
      }
    }, { status: 500 })
  }
}

/**
 * Close/Delete account
 * DELETE /api/accounts/[accountId]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const decoded = AuthUtils.verifyToken(token)
    await connectDB()
    
    const user = await User.findById(decoded.userId)
    if (!user || !user.isActive) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid user or account inactive'
        }
      }, { status: 401 })
    }

    // Find account and verify ownership
    const account = await Account.findOne({
      _id: params.accountId,
      userId: user._id
    })

    if (!account) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Account not found'
        }
      }, { status: 404 })
    }

    // Check if account has balance
    if (account.balance > 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Cannot close account with positive balance'
        }
      }, { status: 400 })
    }

    // Soft delete (mark as closed) rather than hard delete
    account.status = 'closed'
    account.closedAt = new Date()
    await account.save()

    return NextResponse.json({
      success: true,
      message: 'Account closed successfully'
    }, { status: 200 })

  } catch (error) {
    console.error('Delete account error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to close account'
      }
    }, { status: 500 })
  }
}
