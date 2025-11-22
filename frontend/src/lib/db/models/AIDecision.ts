import mongoose, { Schema } from 'mongoose'
import { IAIDecision } from '@/types'

const AIModelSchema = new Schema({
  name: {
    type: String,
    required: [true, 'AI model name is required'],
    trim: true,
    maxlength: [100, 'Model name cannot exceed 100 characters']
  },
  version: {
    type: String,
    required: [true, 'AI model version is required'],
    trim: true,
    match: [/^\d+\.\d+\.\d+$/, 'Version must be in semantic version format (x.y.z)']
  },
  confidence: {
    type: Number,
    required: [true, 'Confidence score is required'],
    min: [0, 'Confidence must be between 0 and 1'],
    max: [1, 'Confidence must be between 0 and 1']
  },
  biasCheck: {
    type: Boolean,
    required: true,
    default: false
  }
}, { _id: false })

const DecisionFactorSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Factor name is required'],
    trim: true,
    maxlength: [100, 'Factor name cannot exceed 100 characters']
  },
  value: {
    type: Schema.Types.Mixed,
    required: [true, 'Factor value is required']
  },
  weight: {
    type: Number,
    required: [true, 'Factor weight is required'],
    min: [0, 'Weight must be between 0 and 1'],
    max: [1, 'Weight must be between 0 and 1']
  },
  impact: {
    type: String,
    required: [true, 'Factor impact is required'],
    enum: ['positive', 'negative', 'neutral']
  }
}, { _id: false })

const ExplanationSchema = new Schema({
  summary: {
    type: String,
    required: [true, 'Explanation summary is required'],
    trim: true,
    maxlength: [500, 'Summary cannot exceed 500 characters']
  },
  details: {
    type: String,
    required: [true, 'Explanation details are required'],
    trim: true,
    maxlength: [2000, 'Details cannot exceed 2000 characters']
  },
  factors: {
    type: [DecisionFactorSchema],
    required: true,
    validate: {
      validator: function(factors: any[]) {
        return factors.length > 0
      },
      message: 'At least one decision factor is required'
    }
  },
  recommendations: {
    type: [String],
    default: []
  }
}, { _id: false })

const HumanReviewSchema = new Schema({
  reviewedBy: {
    type: String,
    required: [true, 'Reviewer identification is required'],
    trim: true
  },
  reviewedAt: {
    type: Date,
    required: [true, 'Review date is required'],
    default: Date.now
  },
  decision: {
    type: String,
    required: [true, 'Review decision is required'],
    enum: ['confirmed', 'overridden']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Review notes cannot exceed 1000 characters']
  }
}, { _id: false })

const AIDecisionSchema = new Schema<IAIDecision>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  relatedEntityId: {
    type: Schema.Types.ObjectId,
    index: true
  },
  entityType: {
    type: String,
    required: [true, 'Entity type is required'],
    enum: ['transaction', 'account', 'loan', 'credit_application', 'product_recommendation'],
    index: true
  },
  decisionType: {
    type: String,
    required: [true, 'Decision type is required'],
    enum: ['approval', 'denial', 'flag', 'recommendation', 'insight'],
    index: true
  },
  status: {
    type: String,
    required: [true, 'Decision status is required'],
    enum: ['approved', 'denied', 'flagged', 'under_review'],
    index: true
  },
  aiModel: {
    type: AIModelSchema,
    required: [true, 'AI model information is required']
  },
  explanation: {
    type: ExplanationSchema,
    required: [true, 'Decision explanation is required']
  },
  humanReview: HumanReviewSchema
}, {
  timestamps: true
})

// Compound indexes for performance
AIDecisionSchema.index({ userId: 1, createdAt: -1 })
AIDecisionSchema.index({ userId: 1, entityType: 1, createdAt: -1 })
AIDecisionSchema.index({ userId: 1, decisionType: 1, createdAt: -1 })
AIDecisionSchema.index({ relatedEntityId: 1, entityType: 1 })
AIDecisionSchema.index({ status: 1, createdAt: -1 })
AIDecisionSchema.index({ 'aiModel.name': 1, 'aiModel.version': 1 })

// Text search index
AIDecisionSchema.index({
  'explanation.summary': 'text',
  'explanation.details': 'text'
})

// Virtual for decision age
AIDecisionSchema.virtual('ageInDays').get(function() {
  const diffTime = Math.abs(new Date().getTime() - this.createdAt.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

// Static method to find user decisions
AIDecisionSchema.statics.findUserDecisions = function(
  userId: string,
  filters: {
    entityType?: string
    decisionType?: string
    status?: string
    dateFrom?: Date
    dateTo?: Date
    limit?: number
    skip?: number
  } = {}
) {
  const query: any = { userId }
  
  if (filters.entityType) query.entityType = filters.entityType
  if (filters.decisionType) query.decisionType = filters.decisionType
  if (filters.status) query.status = filters.status
  
  if (filters.dateFrom || filters.dateTo) {
    query.createdAt = {}
    if (filters.dateFrom) query.createdAt.$gte = filters.dateFrom
    if (filters.dateTo) query.createdAt.$lte = filters.dateTo
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(filters.limit || 50)
    .skip(filters.skip || 0)
}

// Static method to get decision statistics
AIDecisionSchema.statics.getDecisionStats = function(
  userId: string,
  dateFrom: Date,
  dateTo: Date
) {
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: dateFrom, $lte: dateTo }
      }
    },
    {
      $group: {
        _id: {
          decisionType: '$decisionType',
          status: '$status'
        },
        count: { $sum: 1 },
        avgConfidence: { $avg: '$aiModel.confidence' }
      }
    },
    {
      $group: {
        _id: '$_id.decisionType',
        statusBreakdown: {
          $push: {
            status: '$_id.status',
            count: '$count',
            avgConfidence: '$avgConfidence'
          }
        },
        total: { $sum: '$count' }
      }
    }
  ])
}

// Static method to find decisions requiring human review
AIDecisionSchema.statics.findForReview = function(filters: {
  lowConfidence?: boolean
  flaggedDecisions?: boolean
  limit?: number
} = {}) {
  const query: any = {}
  
  if (filters.lowConfidence) {
    query['aiModel.confidence'] = { $lt: 0.7 }
  }
  
  if (filters.flaggedDecisions) {
    query.status = 'flagged'
  }
  
  // Exclude already reviewed decisions
  query.humanReview = { $exists: false }
  
  return this.find(query)
    .sort({ createdAt: 1 }) // Oldest first for review queue
    .limit(filters.limit || 100)
}

// Instance method to check if decision needs review
AIDecisionSchema.methods.needsReview = function(): boolean {
  return (
    !this.humanReview &&
    (this.aiModel.confidence < 0.7 || 
     this.status === 'flagged' ||
     this.status === 'under_review')
  )
}

// Instance method to add human review
AIDecisionSchema.methods.addHumanReview = function(
  reviewedBy: string,
  decision: 'confirmed' | 'overridden',
  notes?: string
) {
  this.humanReview = {
    reviewedBy,
    reviewedAt: new Date(),
    decision,
    notes
  }
  
  // Update status based on review
  if (decision === 'confirmed') {
    // Keep original status
  } else if (decision === 'overridden') {
    // Flip the status
    if (this.status === 'approved') this.status = 'denied'
    else if (this.status === 'denied') this.status = 'approved'
    else if (this.status === 'flagged') this.status = 'approved'
  }
  
  return this.save()
}

// Ensure virtual fields are serialized
AIDecisionSchema.set('toJSON', { virtuals: true })

export default mongoose.models.AIDecision || mongoose.model<IAIDecision>('AIDecision', AIDecisionSchema)
