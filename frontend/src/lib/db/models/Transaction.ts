import mongoose, { Schema } from 'mongoose'
import { ITransaction } from '@/types'

const LocationSchema = new Schema({
  country: { type: String, required: true },
  city: { type: String, required: true },
  coordinates: {
    type: [Number],
    validate: {
      validator: function(coordinates: number[]) {
        return coordinates.length === 2 && 
               coordinates[0] >= -180 && coordinates[0] <= 180 && // longitude
               coordinates[1] >= -90 && coordinates[1] <= 90     // latitude
      },
      message: 'Coordinates must be [longitude, latitude] within valid ranges'
    }
  }
}, { _id: false })

const TransactionMetadataSchema = new Schema({
  reference: { type: String, trim: true },
  externalId: { type: String, trim: true },
  fees: { type: Number, min: 0, default: 0 },
  exchangeRate: { type: Number, min: 0 }
}, { _id: false })

const AIAnalysisSchema = new Schema({
  fraudScore: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    default: 0
  },
  riskLevel: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high'],
    default: 'low'
  },
  categoryConfidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    default: 0.5
  },
  anomalyScore: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    default: 0
  },
  explanation: { type: String, trim: true }
}, { _id: false })

const TransactionSchema = new Schema<ITransaction>({
  accountId: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
    required: [true, 'Account ID is required'],
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  type: {
    type: String,
    required: [true, 'Transaction type is required'],
    enum: ['debit', 'credit'],
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0'],
    set: (value: number) => Math.round(value * 100) / 100 // Round to 2 decimal places
  },
  currency: {
    type: String,
    required: true,
    default: 'INR',
    uppercase: true,
    match: [/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO code']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    enum: [
      'groceries', 'dining', 'transportation', 'entertainment', 'shopping',
      'bills', 'healthcare', 'education', 'travel', 'investments',
      'insurance', 'taxes', 'charity', 'transfers', 'fees', 'salary',
      'business', 'rental', 'other'
    ],
    index: true
  },
  merchantName: {
    type: String,
    trim: true,
    maxlength: [200, 'Merchant name cannot exceed 200 characters']
  },
  merchantCategory: {
    type: String,
    trim: true,
    maxlength: [100, 'Merchant category cannot exceed 100 characters']
  },
  location: LocationSchema,
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  metadata: {
    type: TransactionMetadataSchema,
    default: () => ({})
  },
  aiAnalysis: {
    type: AIAnalysisSchema,
    required: true,
    default: () => ({})
  }
}, {
  timestamps: true
})

// Compound indexes for performance
TransactionSchema.index({ userId: 1, createdAt: -1 })
TransactionSchema.index({ accountId: 1, createdAt: -1 })
TransactionSchema.index({ userId: 1, category: 1, createdAt: -1 })
TransactionSchema.index({ userId: 1, status: 1 })
TransactionSchema.index({ 'aiAnalysis.fraudScore': -1 })
TransactionSchema.index({ 'aiAnalysis.riskLevel': 1 })

// Text index for searching
TransactionSchema.index({
  description: 'text',
  merchantName: 'text',
  category: 'text'
})

// Virtual for formatted amount
TransactionSchema.virtual('formattedAmount').get(function() {
  const sign = this.type === 'debit' ? '-' : '+'
  return `${sign}${this.currency} ${this.amount.toLocaleString()}`
})

// Static method to get user transactions with filters
TransactionSchema.statics.findUserTransactions = function(
  userId: string,
  filters: {
    accountId?: string
    category?: string
    dateFrom?: Date
    dateTo?: Date
    minAmount?: number
    maxAmount?: number
    status?: string
    limit?: number
    skip?: number
  } = {}
) {
  const query: any = { userId }
  
  if (filters.accountId) query.accountId = filters.accountId
  if (filters.category) query.category = filters.category
  if (filters.status) query.status = filters.status
  
  if (filters.dateFrom || filters.dateTo) {
    query.createdAt = {}
    if (filters.dateFrom) query.createdAt.$gte = filters.dateFrom
    if (filters.dateTo) query.createdAt.$lte = filters.dateTo
  }
  
  if (filters.minAmount || filters.maxAmount) {
    query.amount = {}
    if (filters.minAmount) query.amount.$gte = filters.minAmount
    if (filters.maxAmount) query.amount.$lte = filters.maxAmount
  }
  
  return this.find(query)
    .populate('accountId', 'accountType accountNumber')
    .sort({ createdAt: -1 })
    .limit(filters.limit || 50)
    .skip(filters.skip || 0)
}

// Static method to get spending analysis
TransactionSchema.statics.getSpendingAnalysis = function(
  userId: string,
  dateFrom: Date,
  dateTo: Date
) {
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        type: 'debit',
        status: 'completed',
        createdAt: { $gte: dateFrom, $lte: dateTo }
      }
    },
    {
      $group: {
        _id: '$category',
        totalAmount: { $sum: '$amount' },
        transactionCount: { $sum: 1 },
        avgAmount: { $avg: '$amount' }
      }
    },
    {
      $sort: { totalAmount: -1 }
    }
  ])
}

// Instance method to check if transaction is suspicious
TransactionSchema.methods.isSuspicious = function(): boolean {
  return this.aiAnalysis.fraudScore > 0.7 || this.aiAnalysis.riskLevel === 'high'
}

// Pre-save middleware to run AI analysis
TransactionSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Run basic AI analysis (this would be replaced with actual ML models)
    await runAIAnalysisForTransaction(this)
  }
  next()
})

// Helper function for AI analysis (placeholder)
async function runAIAnalysisForTransaction(transaction: any) {
  // Placeholder AI analysis - in production, this would call ML models
  
  // Basic fraud score calculation
  let fraudScore = 0
  
  // Large amounts are slightly more suspicious
  if (transaction.amount > 10000) fraudScore += 0.2
  if (transaction.amount > 50000) fraudScore += 0.3
  
  // Late night transactions
  const hour = new Date().getHours()
  if (hour < 6 || hour > 22) fraudScore += 0.1
  
  // Unknown merchant category
  if (!transaction.merchantCategory) fraudScore += 0.1
  
  transaction.aiAnalysis.fraudScore = Math.min(fraudScore, 1)
  transaction.aiAnalysis.riskLevel = fraudScore > 0.7 ? 'high' : fraudScore > 0.3 ? 'medium' : 'low'
  transaction.aiAnalysis.categoryConfidence = 0.9 // Placeholder
  transaction.aiAnalysis.anomalyScore = fraudScore * 0.8 // Placeholder
  
  if (fraudScore > 0.5) {
    transaction.aiAnalysis.explanation = 'Transaction flagged due to amount, timing, or merchant factors'
  }
}

// Ensure virtual fields are serialized
TransactionSchema.set('toJSON', { virtuals: true })

export default mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', TransactionSchema)
