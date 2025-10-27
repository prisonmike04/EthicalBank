import { NextRequest, NextResponse } from 'next/server'
import { AuthUtils } from '@/lib/auth/utils'
import { connectDB, User, Account } from '@/lib/db'

/**
 * Get user accounts
 * GET /api/accounts
 */
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

    // Get user's accounts (only active ones)
    const accounts = await Account.find({ 
      userId: user._id,
      status: { $ne: 'closed' }
    }).sort({ createdAt: -1 })

    return NextResponse.json({
      success: true,
      data: {
        accounts,
        totalAccounts: accounts.length,
        totalBalance: accounts.reduce((sum, acc) => sum + acc.balance, 0)
      }
    }, { status: 200 })

  } catch (error) {
    console.error('Get accounts error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve accounts'
      }
    }, { status: 500 })
  }
}

/**
 * Create new account
 * POST /api/accounts
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { accountType, currency = 'USD', name } = body

    // Validate required fields
    if (!accountType || !name) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Account type and name are required'
        }
      }, { status: 400 })
    }

    // Check account limits (example: max 5 accounts per user)
    const existingAccounts = await Account.countDocuments({ userId: user._id })
    if (existingAccounts >= 5) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'LIMIT_EXCEEDED',
          message: 'Maximum number of accounts reached (5)'
        }
      }, { status: 400 })
    }

    // Generate unique account number
    const generateAccountNumber = async (): Promise<string> => {
      let accountNumber: string
      let isUnique = false
      
      while (!isUnique) {
        // Generate 12-digit account number
        accountNumber = Math.floor(100000000000 + Math.random() * 900000000000).toString()
        
        // Check if it's unique
        const existing = await Account.findOne({ accountNumber })
        if (!existing) {
          isUnique = true
        }
      }
      
      return accountNumber!
    }

    const accountNumber = await generateAccountNumber()

    // Create new account
    const account = new Account({
      userId: user._id,
      accountNumber,
      accountType,
      currency,
      name: name.trim(),
      balance: 0,
      status: 'active'
    })

    await account.save()

    return NextResponse.json({
      success: true,
      data: { account },
      message: 'Account created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Create account error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create account'
      }
    }, { status: 500 })
  }
}
