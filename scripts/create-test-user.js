import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

async function createTestUser() {
  try {
    console.log('🧪 Creating test user for authentication testing...')
    
    const MONGODB_URI = 'mongodb://localhost:27017/ethical-bank'
    await mongoose.connect(MONGODB_URI)
    
    // Create proper User model
    const UserSchema = new mongoose.Schema({
      email: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      phoneNumber: String,
      kycStatus: { type: String, default: 'verified' },
      isActive: { type: Boolean, default: true },
      preferences: {
        theme: { type: String, default: 'system' },
        language: { type: String, default: 'en' },
        notifications: {
          email: { type: Boolean, default: true },
          sms: { type: Boolean, default: false },
          push: { type: Boolean, default: true }
        }
      },
      lastLoginAt: Date,
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    })
    
    const User = mongoose.models.User || mongoose.model('User', UserSchema)
    
    // Hash password
    const hashedPassword = await bcrypt.hash('TestPassword123!', 12)
    
    // Check if test user already exists
    const existingUser = await User.findOne({ email: 'test@ethicalbank.com' })
    if (existingUser) {
      console.log('✅ Test user already exists')
      console.log('📧 Email: test@ethicalbank.com')
      console.log('🔑 Password: TestPassword123!')
      await mongoose.disconnect()
      return
    }
    
    // Create test user
    const testUser = await User.create({
      email: 'test@ethicalbank.com',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      phoneNumber: '+1-555-0199',
      kycStatus: 'verified',
      isActive: true,
      preferences: {
        theme: 'system',
        language: 'en',
        notifications: {
          email: true,
          sms: true,
          push: true
        }
      }
    })
    
    console.log('✅ Test user created successfully!')
    console.log('📧 Email: test@ethicalbank.com')
    console.log('🔑 Password: TestPassword123!')
    console.log('👤 User ID:', testUser._id)
    
    await mongoose.disconnect()
    
  } catch (error) {
    console.error('❌ Failed to create test user:', error)
    process.exit(1)
  }
}

createTestUser()
