import { NextRequest, NextResponse } from 'next/server'
import { AuthUtils } from '@/lib/auth/utils'
import { connectDB, User, AIDecision } from '@/lib/db'

/**
 * Get user AI decisions
 * GET /api/ai-decisions
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const decisionType = searchParams.get('type')
    const outcome = searchParams.get('outcome')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build query
    const query: any = { userId: user._id }
    
    if (decisionType) {
      query.decisionType = decisionType
    }

    if (outcome) {
      query.outcome = outcome
    }

    if (startDate || endDate) {
      query.createdAt = {}
      if (startDate) query.createdAt.$gte = new Date(startDate)
      if (endDate) query.createdAt.$lte = new Date(endDate)
    }

    // Execute query with pagination
    const skip = (page - 1) * limit
    const [decisions, totalCount] = await Promise.all([
      AIDecision.find(query)
        .populate('relatedEntityId', 'amount type description category reference')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      AIDecision.countDocuments(query)
    ])

    return NextResponse.json({
      success: true,
      data: {
        decisions,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      }
    }, { status: 200 })

  } catch (error) {
    console.error('Get AI decisions error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve AI decisions'
      }
    }, { status: 500 })
  }
}

/**
 * Create new AI decision (for testing/admin use)
 * POST /api/ai-decisions
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
    const { 
      entityType,
      relatedEntityId,
      decisionType,
      status,
      aiModel,
      explanation,
      humanReview
    } = body

    // Validate required fields
    if (!entityType || !decisionType || !status || !aiModel || !explanation) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Entity type, decision type, status, AI model, and explanation are required'
        }
      }, { status: 400 })
    }

    // Validate aiModel structure
    if (!aiModel.name || !aiModel.version || aiModel.confidence === undefined) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'AI model must include name, version, and confidence'
        }
      }, { status: 400 })
    }

    // Validate explanation structure
    if (!explanation.summary || !explanation.details || !explanation.factors || !Array.isArray(explanation.factors) || explanation.factors.length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Explanation must include summary, details, and at least one factor'
        }
      }, { status: 400 })
    }

    // Create AI decision
    const aiDecision = new AIDecision({
      userId: user._id,
      relatedEntityId: relatedEntityId || null,
      entityType,
      decisionType,
      status,
      aiModel: {
        name: aiModel.name.trim(),
        version: aiModel.version.trim(),
        confidence: Math.round(aiModel.confidence * 100) / 100,
        biasCheck: aiModel.biasCheck || false
      },
      explanation: {
        summary: explanation.summary.trim(),
        details: explanation.details.trim(),
        factors: explanation.factors,
        recommendations: explanation.recommendations || []
      },
      humanReview: humanReview || null
    })

    await aiDecision.save()

    return NextResponse.json({
      success: true,
      data: { aiDecision },
      message: 'AI decision created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Create AI decision error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create AI decision'
      }
    }, { status: 500 })
  }
}
