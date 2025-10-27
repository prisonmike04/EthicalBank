import { NextRequest, NextResponse } from "next/server"
import { AuthUtils } from "./utils"
import { connectDB, User } from "@/lib/db"

/**
 * Authentication middleware for API routes
 */
export async function withAuth(
  handler: (request: NextRequest, context: { user: any }) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Extract and verify token
      const token = AuthUtils.extractTokenFromHeader(request)
      if (!token) {
        return NextResponse.json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "No authentication token provided"
          }
        }, { status: 401 })
      }

      // Verify token
      const decoded = AuthUtils.verifyToken(token)
      
      // Connect to database and get user
      await connectDB()
      const user = await User.findById(decoded.userId).select("-password")
      
      if (!user || !user.isActive) {
        return NextResponse.json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid user or account inactive"
          }
        }, { status: 401 })
      }

      // Call the actual handler with user context
      return await handler(request, { user })

    } catch (error) {
      return NextResponse.json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: error instanceof Error ? error.message : "Authentication failed"
        }
      }, { status: 401 })
    }
  }
}

/**
 * Optional authentication middleware (user might or might not be logged in)
 */
export async function withOptionalAuth(
  handler: (request: NextRequest, context: { user?: any }) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const token = AuthUtils.extractTokenFromHeader(request)
      let user = null

      if (token) {
        try {
          const decoded = AuthUtils.verifyToken(token)
          await connectDB()
          user = await User.findById(decoded.userId).select("-password")
        } catch (error) {
          // Ignore authentication errors for optional auth
          console.warn("Optional auth failed:", error)
        }
      }

      return await handler(request, { user })

    } catch (error) {
      // For optional auth, continue without user if authentication fails
      return await handler(request, { user: null })
    }
  }
}

/**
 * Admin-only authentication middleware
 */
export async function withAdminAuth(
  handler: (request: NextRequest, context: { user: any }) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const token = AuthUtils.extractTokenFromHeader(request)
      if (!token) {
        return NextResponse.json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "No authentication token provided"
          }
        }, { status: 401 })
      }

      const decoded = AuthUtils.verifyToken(token)
      await connectDB()
      const user = await User.findById(decoded.userId).select("-password")
      
      if (!user || !user.isActive) {
        return NextResponse.json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid user or account inactive"
          }
        }, { status: 401 })
      }

      // Check if user has admin privileges (you can customize this logic)
      if (user.email !== "admin@ethicalbank.com" && user.role !== "admin") {
        return NextResponse.json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Admin access required"
          }
        }, { status: 403 })
      }

      return await handler(request, { user })

    } catch (error) {
      return NextResponse.json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: error instanceof Error ? error.message : "Authentication failed"
        }
      }, { status: 401 })
    }
  }
}
