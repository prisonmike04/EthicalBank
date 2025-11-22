import { NextRequest, NextResponse } from 'next/server'
import { DatabaseUtils } from '@/lib/db'

/**
 * Database health check endpoint
 * GET /api/health/database
 */
export async function GET(request: NextRequest) {
  try {
    // Check database health
    const healthCheck = await DatabaseUtils.healthCheck()
    
    // Get database statistics
    const stats = await DatabaseUtils.getStatistics()
    
    return NextResponse.json({
      success: true,
      data: {
        health: healthCheck,
        statistics: stats
      }
    }, { status: 200 })
  } catch (error) {
    console.error('Database health check failed:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Database health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}

/**
 * Initialize database (for development)
 * POST /api/health/database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body
    
    if (action === 'initialize') {
      await DatabaseUtils.initialize()
      
      return NextResponse.json({
        success: true,
        data: {
          message: 'Database initialized successfully'
        }
      }, { status: 200 })
    }
    
    if (action === 'seed' && process.env.NODE_ENV === 'development') {
      await DatabaseUtils.seedDevelopmentData()
      
      return NextResponse.json({
        success: true,
        data: {
          message: 'Development data seeded successfully'
        }
      }, { status: 200 })
    }
    
    if (action === 'cleanup' && process.env.NODE_ENV === 'development') {
      await DatabaseUtils.cleanupTestData()
      
      return NextResponse.json({
        success: true,
        data: {
          message: 'Test data cleaned up successfully'
        }
      }, { status: 200 })
    }
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INVALID_ACTION',
        message: 'Invalid action specified'
      }
    }, { status: 400 })
    
  } catch (error) {
    console.error('Database operation failed:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Database operation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}
