import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

/**
 * Authentication utility functions
 */
export class AuthUtils {
  /**
   * Hash a password
   */
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(12)
    return bcrypt.hash(password, salt)
  }

  /**
   * Compare password with hash
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  /**
   * Generate JWT token
   */
  static generateToken(payload: any): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions)
  }

  /**
   * Generate refresh token (longer expiry)
   */
  static generateRefreshToken(payload: any): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' } as jwt.SignOptions)
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET)
    } catch (error) {
      throw new Error('Invalid or expired token')
    }
  }

  /**
   * Extract token from Authorization header
   */
  static extractTokenFromHeader(request: NextRequest): string | null {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }
    return authHeader.substring(7) // Remove 'Bearer ' prefix
  }

  /**
   * Extract user from request (middleware helper)
   */
  static async extractUserFromRequest(request: NextRequest): Promise<any> {
    const token = this.extractTokenFromHeader(request)
    if (!token) {
      throw new Error('No token provided')
    }

    const decoded = this.verifyToken(token)
    return decoded
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long')
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number')
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Generate secure session data
   */
  static generateSessionData(user: any) {
    return {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        kycStatus: user.kycStatus,
        isActive: user.isActive,
        preferences: user.preferences
      },
      token: this.generateToken({ 
        userId: user._id, 
        email: user.email 
      }),
      refreshToken: this.generateRefreshToken({ 
        userId: user._id, 
        email: user.email 
      }),
      expiresIn: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
    }
  }

  /**
   * Sanitize user data (remove sensitive fields)
   */
  static sanitizeUser(user: any) {
    const { password, ...sanitizedUser } = user.toObject ? user.toObject() : user
    return sanitizedUser
  }
}
