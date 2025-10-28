import { NextRequest, NextResponse } from 'next/server'
import { AuthUtils } from '@/lib/auth/utils'
import { connectDB, User, Account, Transaction, AIDecision, ConsentRecord } from '@/lib/db'

/**
 * Get user dashboard summary
 * GET /api/dashboard/summary
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

    // Get all user accounts
    const accounts = await Account.find({ 
      userId: user._id,
      status: { $ne: 'closed' }
    }).sort({ createdAt: -1 })

    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)

    // Get recent transactions (last 10)
    const recentTransactions = await Transaction.find({
      accountId: { $in: accounts.map(acc => acc._id) }
    })
      .populate('accountId', 'name accountNumber accountType')
      .sort({ createdAt: -1 })
      .limit(10)

    // Get transaction statistics
    const transactionStats = await Transaction.aggregate([
      {
        $match: {
          accountId: { $in: accounts.map(acc => acc._id) }
        }
      },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalCredits: {
            $sum: {
              $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0]
            }
          },
          totalDebits: {
            $sum: {
              $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0]
            }
          },
          avgTransactionAmount: { $avg: '$amount' }
        }
      }
    ])

    // Get recent AI decisions (last 5)
    const recentAIDecisions = await AIDecision.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(5)

    // Get AI decision statistics
    const aiStats = await AIDecision.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ])

    // Get active consent records
    const activeConsents = await ConsentRecord.find({
      userId: user._id,
      status: 'granted',
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    }).sort({ createdAt: -1 })

    // Get consent statistics
    const consentStats = await ConsentRecord.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ])

    // Calculate account types distribution
    const accountTypesDistribution = accounts.reduce((acc, account) => {
      acc[account.accountType] = (acc[account.accountType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Calculate monthly spending trend (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlySpending = await Transaction.aggregate([
      {
        $match: {
          accountId: { $in: accounts.map(acc => acc._id) },
          type: 'debit',
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalAmount: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ])

    return NextResponse.json({
      success: true,
      data: {
        user: AuthUtils.sanitizeUser(user),
        accounts: {
          list: accounts,
          totalBalance,
          count: accounts.length,
          distribution: accountTypesDistribution
        },
        transactions: {
          recent: recentTransactions,
          statistics: transactionStats[0] || {
            totalTransactions: 0,
            totalCredits: 0,
            totalDebits: 0,
            avgTransactionAmount: 0
          },
          monthlySpending
        },
        aiDecisions: {
          recent: recentAIDecisions,
          statistics: aiStats
        },
        consents: {
          active: activeConsents,
          statistics: consentStats
        },
        summary: {
          totalAccounts: accounts.length,
          totalBalance,
          totalTransactions: transactionStats[0]?.totalTransactions || 0,
          totalAIDecisions: recentAIDecisions.length,
          activeConsents: activeConsents.length,
          memberSince: user.createdAt,
          lastLoginAt: user.lastLoginAt
        }
      }
    }, { status: 200 })

  } catch (error) {
    console.error('Get dashboard summary error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve dashboard summary'
      }
    }, { status: 500 })
  }
}
