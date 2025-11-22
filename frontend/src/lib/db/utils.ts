import connectDB from './connection'
import { User, Account, Transaction, AIDecision, ConsentRecord } from './models'

/**
 * Database utility functions for common operations
 */

export class DatabaseUtils {
  /**
   * Initialize database connection and ensure indexes
   */
  static async initialize() {
    try {
      await connectDB()
      console.log('✅ Database connection initialized')
      
      // Ensure indexes are created
      await Promise.all([
        User.createIndexes(),
        Account.createIndexes(),
        Transaction.createIndexes(),
        AIDecision.createIndexes(),
        ConsentRecord.createIndexes()
      ])
      
      console.log('✅ Database indexes created')
      return true
    } catch (error) {
      console.error('❌ Database initialization failed:', error)
      throw error
    }
  }

  /**
   * Check database health
   */
  static async healthCheck() {
    try {
      await connectDB()
      
      // Test basic operations
      const userCount = await User.countDocuments()
      const accountCount = await Account.countDocuments()
      const transactionCount = await Transaction.countDocuments()
      
      return {
        status: 'healthy',
        collections: {
          users: userCount,
          accounts: accountCount,
          transactions: transactionCount
        },
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Seed initial data for development
   */
  static async seedDevelopmentData() {
    try {
      await connectDB()
      
      // Check if data already exists
      const userCount = await User.countDocuments()
      if (userCount > 0) {
        console.log('📊 Development data already exists, skipping seed')
        return
      }

      console.log('🌱 Seeding development data...')

      // Create test user
      const testUser = await User.create({
        email: 'jane.doe@ethicalbank.com',
        password: 'SecurePassword123!',
        firstName: 'Jane',
        lastName: 'Doe',
        phoneNumber: '+1-555-0123',
        dateOfBirth: new Date('1990-05-15'),
        address: {
          street: '123 Main Street',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94102',
          country: 'USA'
        },
        kycStatus: 'verified'
      })

      // Create test accounts
      const checkingAccount = await Account.create({
        userId: testUser._id,
        accountType: 'checking',
        balance: 3247.89,
        status: 'active'
      })

      const savingsAccount = await Account.create({
        userId: testUser._id,
        accountType: 'savings',
        balance: 9300.00,
        status: 'active',
        metadata: {
          interestRate: 4.5,
          minimumBalance: 100
        }
      })

      const creditAccount = await Account.create({
        userId: testUser._id,
        accountType: 'credit',
        balance: -245.67, // Negative balance for credit cards
        status: 'active',
        metadata: {
          creditLimit: 5000,
          interestRate: 18.99
        }
      })

      // Create sample transactions
      const transactions = [
        {
          accountId: checkingAccount._id,
          userId: testUser._id,
          type: 'debit',
          amount: 87.43,
          description: 'Grocery Store Purchase',
          category: 'groceries',
          merchantName: 'Fresh Foods Market',
          status: 'completed'
        },
        {
          accountId: checkingAccount._id,
          userId: testUser._id,
          type: 'credit',
          amount: 3200.00,
          description: 'Salary Deposit',
          category: 'salary',
          status: 'completed'
        },
        {
          accountId: checkingAccount._id,
          userId: testUser._id,
          type: 'debit',
          amount: 125.67,
          description: 'Electric Bill Payment',
          category: 'bills',
          merchantName: 'City Electric Company',
          status: 'completed'
        },
        {
          accountId: creditAccount._id,
          userId: testUser._id,
          type: 'debit',
          amount: 45.23,
          description: 'Coffee Shop',
          category: 'dining',
          merchantName: 'Downtown Coffee Co.',
          status: 'completed'
        }
      ]

      await Transaction.insertMany(transactions)

      // Create sample consent records
      const consents = [
        {
          userId: testUser._id,
          consentType: 'fraud_detection',
          status: 'granted',
          purpose: 'Protect your account from fraudulent transactions',
          dataTypes: ['transaction_history', 'behavioral_data'],
          version: '1.0'
        },
        {
          userId: testUser._id,
          consentType: 'personalized_offers',
          status: 'granted',
          purpose: 'Provide relevant product recommendations',
          dataTypes: ['financial_data', 'transaction_history'],
          version: '1.0'
        },
        {
          userId: testUser._id,
          consentType: 'third_party_sharing',
          status: 'revoked',
          purpose: 'Share anonymized data with partners',
          dataTypes: ['behavioral_data'],
          version: '1.0'
        }
      ]

      await ConsentRecord.insertMany(consents)

      console.log('✅ Development data seeded successfully')
      console.log(`👤 Test user created: ${testUser.email}`)
      console.log(`🏦 Created ${await Account.countDocuments()} accounts`)
      console.log(`💳 Created ${await Transaction.countDocuments()} transactions`)
      console.log(`🔒 Created ${await ConsentRecord.countDocuments()} consent records`)

    } catch (error) {
      console.error('❌ Failed to seed development data:', error)
      throw error
    }
  }

  /**
   * Clean up test data (for development only)
   */
  static async cleanupTestData() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot cleanup data in production environment')
    }

    try {
      await connectDB()
      
      await Promise.all([
        User.deleteMany({}),
        Account.deleteMany({}),
        Transaction.deleteMany({}),
        AIDecision.deleteMany({}),
        ConsentRecord.deleteMany({})
      ])

      console.log('🧹 Test data cleaned up successfully')
    } catch (error) {
      console.error('❌ Failed to cleanup test data:', error)
      throw error
    }
  }

  /**
   * Get database statistics
   */
  static async getStatistics() {
    try {
      await connectDB()
      
      const stats = await Promise.all([
        User.countDocuments(),
        Account.countDocuments(),
        Transaction.countDocuments(),
        AIDecision.countDocuments(),
        ConsentRecord.countDocuments()
      ])

      return {
        users: stats[0],
        accounts: stats[1],
        transactions: stats[2],
        aiDecisions: stats[3],
        consentRecords: stats[4],
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ Failed to get database statistics:', error)
      throw error
    }
  }
}

export default DatabaseUtils
