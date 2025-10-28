import { NextRequest, NextResponse } from 'next/server'
import { AuthUtils } from '@/lib/auth/utils'
import { connectDB, User, AIDecision } from '@/lib/db'

interface RouteParams {
  params: {
    decisionId: string
  }
}

/**
 * Get specific AI decision details
 * GET /api/ai-decisions/[decisionId]
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

    // Find AI decision and verify ownership
    const decision = await AIDecision.findOne({
      _id: params.decisionId,
      userId: user._id
    }).populate('transactionId', 'amount type description category reference')

    if (!decision) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'AI decision not found'
        }
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: { decision }
    }, { status: 200 })

  } catch (error) {
    console.error('Get AI decision error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve AI decision'
      }
    }, { status: 500 })
  }
}

/**
 * Update AI decision feedback
 * PUT /api/ai-decisions/[decisionId]
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

    // Find AI decision and verify ownership
    const decision = await AIDecision.findOne({
      _id: params.decisionId,
      userId: user._id
    })

    if (!decision) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'AI decision not found'
        }
      }, { status: 404 })
    }

    const body = await request.json()
    const { userFeedback, correctOutcome, feedbackNote } = body

    // Update feedback fields
    if (userFeedback !== undefined) {
      decision.userFeedback = userFeedback
    }
    
    if (correctOutcome !== undefined) {
      decision.correctOutcome = correctOutcome
    }
    
    if (feedbackNote !== undefined) {
      decision.feedbackNote = feedbackNote.trim()
    }

    decision.feedbackAt = new Date()
    await decision.save()

    return NextResponse.json({
      success: true,
      data: { decision },
      message: 'AI decision feedback updated successfully'
    }, { status: 200 })

  } catch (error) {
    console.error('Update AI decision error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update AI decision'
      }
    }, { status: 500 })
  }
}
