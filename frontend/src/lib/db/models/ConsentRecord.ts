import mongoose, { Schema } from 'mongoose'
import { IConsentRecord } from '@/types'

const ConsentMetadataSchema = new Schema({
  ipAddress: {
    type: String,
    trim: true,
    match: [/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/, 'Invalid IP address format']
  },
  userAgent: {
    type: String,
    trim: true,
    maxlength: [500, 'User agent cannot exceed 500 characters']
  },
  source: {
    type: String,
    required: [true, 'Source is required'],
    enum: ['web', 'mobile', 'api'],
    default: 'web'
  }
}, { _id: false })

const ConsentRecordSchema = new Schema<IConsentRecord>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  consentType: {
    type: String,
    required: [true, 'Consent type is required'],
    trim: true,
    enum: [
      'fraud_detection',
      'credit_scoring',
      'personalized_offers',
      'marketing_communications',
      'analytics_insights',
      'third_party_sharing',
      'product_recommendations',
      'spending_analysis',
      'ai_decisions',
      'data_processing'
    ],
    index: true
  },
  status: {
    type: String,
    required: [true, 'Consent status is required'],
    enum: ['granted', 'revoked', 'expired'],
    index: true
  },
  purpose: {
    type: String,
    required: [true, 'Purpose is required'],
    trim: true,
    maxlength: [500, 'Purpose cannot exceed 500 characters']
  },
  dataTypes: {
    type: [String],
    required: [true, 'Data types are required'],
    validate: {
      validator: function(dataTypes: string[]) {
        return dataTypes.length > 0
      },
      message: 'At least one data type must be specified'
    },
    enum: [
      'personal_info',
      'financial_data',
      'transaction_history',
      'account_information',
      'credit_information',
      'behavioral_data',
      'location_data',
      'device_information',
      'communication_preferences'
    ]
  },
  expiresAt: {
    type: Date,
    validate: {
      validator: function(expiresAt: Date) {
        return !expiresAt || expiresAt > new Date()
      },
      message: 'Expiration date must be in the future'
    }
  },
  metadata: {
    type: ConsentMetadataSchema,
    required: true,
    default: () => ({ source: 'web' })
  },
  version: {
    type: String,
    required: [true, 'Privacy policy version is required'],
    trim: true,
    match: [/^\d+\.\d+$/, 'Version must be in format x.y']
  }
}, {
  timestamps: true
})

// Compound indexes for performance
ConsentRecordSchema.index({ userId: 1, consentType: 1, createdAt: -1 })
ConsentRecordSchema.index({ userId: 1, status: 1 })
ConsentRecordSchema.index({ expiresAt: 1 }, { sparse: true })
ConsentRecordSchema.index({ status: 1, expiresAt: 1 })

// Virtual for consent age
ConsentRecordSchema.virtual('ageInDays').get(function() {
  const diffTime = Math.abs(new Date().getTime() - this.createdAt.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

// Virtual for days until expiration
ConsentRecordSchema.virtual('daysUntilExpiration').get(function() {
  if (!this.expiresAt) return null
  const diffTime = this.expiresAt.getTime() - new Date().getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

// Static method to get current consents for user
ConsentRecordSchema.statics.getCurrentConsents = function(userId: string) {
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId)
      }
    },
    {
      $sort: { createdAt: -1 }
    },
    {
      $group: {
        _id: '$consentType',
        latestConsent: { $first: '$$ROOT' }
      }
    },
    {
      $replaceRoot: { newRoot: '$latestConsent' }
    },
    {
      $match: {
        $or: [
          { status: 'granted', expiresAt: { $gt: new Date() } },
          { status: 'granted', expiresAt: null },
          { status: 'revoked' }
        ]
      }
    }
  ])
}

// Static method to check specific consent
ConsentRecordSchema.statics.hasConsent = async function(
  userId: string,
  consentType: string
): Promise<boolean> {
  const consent = await this.findOne({
    userId,
    consentType,
    status: 'granted',
    $or: [
      { expiresAt: { $gt: new Date() } },
      { expiresAt: null }
    ]
  }).sort({ createdAt: -1 })
  
  return !!consent
}

// Static method to get consent history
ConsentRecordSchema.statics.getConsentHistory = function(
  userId: string,
  consentType?: string,
  limit = 50
) {
  const query: any = { userId }
  if (consentType) query.consentType = consentType
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
}

// Static method to revoke consent
ConsentRecordSchema.statics.revokeConsent = async function(
  userId: string,
  consentType: string,
  metadata: any = {}
) {
  // Check if there's an active consent to revoke
  const activeConsent = await this.findOne({
    userId,
    consentType,
    status: 'granted',
    $or: [
      { expiresAt: { $gt: new Date() } },
      { expiresAt: null }
    ]
  }).sort({ createdAt: -1 })
  
  if (!activeConsent) {
    throw new Error('No active consent found to revoke')
  }
  
  // Create new revocation record
  return this.create({
    userId,
    consentType,
    status: 'revoked',
    purpose: `Revocation of: ${activeConsent.purpose}`,
    dataTypes: activeConsent.dataTypes,
    metadata: {
      ...metadata,
      source: metadata.source || 'web'
    },
    version: activeConsent.version
  })
}

// Static method to grant consent
ConsentRecordSchema.statics.grantConsent = async function(
  userId: string,
  consentType: string,
  purpose: string,
  dataTypes: string[],
  version: string,
  metadata: any = {},
  expiresAt?: Date
) {
  return this.create({
    userId,
    consentType,
    status: 'granted',
    purpose,
    dataTypes,
    expiresAt,
    metadata: {
      ...metadata,
      source: metadata.source || 'web'
    },
    version
  })
}

// Instance method to check if consent is active
ConsentRecordSchema.methods.isActive = function(): boolean {
  if (this.status !== 'granted') return false
  if (!this.expiresAt) return true
  return this.expiresAt > new Date()
}

// Instance method to check if consent is expiring soon
ConsentRecordSchema.methods.isExpiringSoon = function(days = 30): boolean {
  if (!this.expiresAt) return false
  const daysUntilExpiration = this.daysUntilExpiration
  return daysUntilExpiration !== null && daysUntilExpiration <= days && daysUntilExpiration > 0
}

// Pre-save middleware to handle expiration
ConsentRecordSchema.pre('save', function(next) {
  // If expiration date is in the past, set status to expired
  if (this.expiresAt && this.expiresAt <= new Date() && this.status === 'granted') {
    this.status = 'expired'
  }
  next()
})

// Ensure virtual fields are serialized
ConsentRecordSchema.set('toJSON', { virtuals: true })

export default mongoose.models.ConsentRecord || mongoose.model<IConsentRecord>('ConsentRecord', ConsentRecordSchema)
