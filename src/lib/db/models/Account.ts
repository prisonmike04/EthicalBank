import mongoose, { Schema } from 'mongoose'
import { IAccount } from '@/types'

const AccountMetadataSchema = new Schema({
  creditLimit: { type: Number, min: 0 },
  interestRate: { type: Number, min: 0, max: 100 },
  minimumBalance: { type: Number, min: 0 },
  overdraftLimit: { type: Number, min: 0 }
}, { _id: false })

const AccountSchema = new Schema<IAccount>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  accountNumber: {
    type: String,
    required: [true, 'Account number is required'],
    unique: true,
    trim: true,
    match: [/^\d{10,16}$/, 'Account number must be 10-16 digits']
  },
  accountType: {
    type: String,
    required: [true, 'Account type is required'],
    enum: ['checking', 'savings', 'credit', 'loan', 'investment'],
    index: true
  },
  balance: {
    type: Number,
    required: [true, 'Balance is required'],
    default: 0,
    set: (value: number) => Math.round(value * 100) / 100 // Round to 2 decimal places
  },
  currency: {
    type: String,
    required: true,
    default: 'INR',
    uppercase: true,
    match: [/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO code']
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'inactive', 'frozen', 'closed'],
    default: 'active',
    index: true
  },
  metadata: {
    type: AccountMetadataSchema,
    default: () => ({})
  }
}, {
  timestamps: true
})

// Compound indexes for performance (removed duplicate accountNumber index)
AccountSchema.index({ userId: 1, accountType: 1 })
AccountSchema.index({ userId: 1, status: 1 })
AccountSchema.index({ createdAt: -1 })

// Virtual for account display name
AccountSchema.virtual('displayName').get(function() {
  const typeMap = {
    checking: 'Checking Account',
    savings: 'Savings Account',
    credit: 'Credit Card',
    loan: 'Loan Account',
    investment: 'Investment Account'
  }
  return `${typeMap[this.accountType]} (...${this.accountNumber.slice(-4)})`
})

// Pre-save middleware to generate account number if not provided
AccountSchema.pre('save', async function(next) {
  if (!this.accountNumber) {
    // Generate a unique account number
    let accountNumber: string
    let isUnique = false
    
    while (!isUnique) {
      // Generate 12-digit account number
      accountNumber = '3' + Math.random().toString().slice(2, 13).padEnd(11, '0')
      
      // Check if it's unique
      const existingAccount = await mongoose.models.Account.findOne({ accountNumber })
      if (!existingAccount) {
        isUnique = true
        this.accountNumber = accountNumber
      }
    }
  }
  next()
})

// Static method to find user accounts
AccountSchema.statics.findByUser = function(userId: string, activeOnly = true) {
  const query: any = { userId }
  if (activeOnly) {
    query.status = { $in: ['active', 'frozen'] }
  }
  return this.find(query).sort({ createdAt: -1 })
}

// Instance method to check if account can transact
AccountSchema.methods.canTransact = function(): boolean {
  return this.status === 'active'
}

// Instance method to check available balance (considering credit limit for credit accounts)
AccountSchema.methods.getAvailableBalance = function(): number {
  if (this.accountType === 'credit') {
    const creditLimit = this.metadata?.creditLimit || 0
    return creditLimit + this.balance // balance is negative for credit accounts
  }
  return this.balance
}

// Ensure virtual fields are serialized
AccountSchema.set('toJSON', { virtuals: true })

export default mongoose.models.Account || mongoose.model<IAccount>('Account', AccountSchema)
