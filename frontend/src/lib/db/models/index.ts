// Database Models Export
export { default as User } from './User'
export { default as Account } from './Account'
export { default as Transaction } from './Transaction'
export { default as AIDecision } from './AIDecision'
export { default as ConsentRecord } from './ConsentRecord'

// Re-export types for convenience
export type {
  IUser,
  IAccount,
  ITransaction,
  IAIDecision,
  IConsentRecord
} from '@/types'
