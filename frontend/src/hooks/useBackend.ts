/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Hooks for Backend API (Python FastAPI)
 */
import { useState, useCallback, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { backendAPI, BackendResponse } from '@/lib/backend-api'
import { dataPrefetchService } from '@/lib/data-prefetch'

export function useBackendProfile() {
  const { user } = useUser()
  const [profile, setProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return
    
    try {
      setIsLoading(true)
      setError(null)
      const data = await backendAPI.getProfile(user.id)
      setProfile(data)
      return data
    } catch (err: any) {
      setError(err.message || 'Failed to fetch profile')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  const updateProfile = useCallback(async (profileData: any) => {
    if (!user?.id) throw new Error('User not authenticated')
    
    try {
      setIsLoading(true)
      setError(null)
      const data = await backendAPI.updateProfile(user.id, profileData)
      setProfile(data)
      return data
    } catch (err: any) {
      setError(err.message || 'Failed to update profile')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  const checkCompletion = useCallback(async () => {
    if (!user?.id) return null
    
    try {
      return await backendAPI.checkProfileCompletion(user.id)
    } catch (err: any) {
      console.error('Failed to check profile completion:', err)
      return null
    }
  }, [user?.id])

  return {
    profile,
    isLoading,
    error,
    fetchProfile,
    updateProfile,
    checkCompletion,
  }
}

export function useAIChat() {
  const { user } = useUser()
  const [response, setResponse] = useState<BackendResponse<any> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendQuery = useCallback(async (query: string, context?: Record<string, any>) => {
    if (!user?.id) throw new Error('User not authenticated')
    
    try {
      setIsLoading(true)
      setError(null)
      const data = await backendAPI.chatQuery(user.id, query, context)
      setResponse(data)
      return data
    } catch (err: any) {
      setError(err.message || 'Failed to send query')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  return {
    response,
    isLoading,
    error,
    sendQuery,
  }
}

export function useLoanEligibility() {
  const { user } = useUser()
  const [result, setResult] = useState<BackendResponse<any> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkEligibility = useCallback(async (
    loanAmount: number,
    loanType: string = 'personal',
    purpose?: string
  ) => {
    if (!user?.id) throw new Error('User not authenticated')
    
    try {
      setIsLoading(true)
      setError(null)
      const data = await backendAPI.checkLoanEligibility(user.id, loanAmount, loanType, purpose)
      setResult(data)
      return data
    } catch (err: any) {
      setError(err.message || 'Failed to check loan eligibility')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  return {
    result,
    isLoading,
    error,
    checkEligibility,
  }
}

export function useProfileExplanation() {
  const { user } = useUser()
  const [explanation, setExplanation] = useState<BackendResponse<any> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const explain = useCallback(async (aspects?: string[]) => {
    if (!user?.id) throw new Error('User not authenticated')
    
    try {
      setIsLoading(true)
      setError(null)
      const data = await backendAPI.explainProfile(user.id, aspects)
      setExplanation(data)
      return data
    } catch (err: any) {
      setError(err.message || 'Failed to explain profile')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  return {
    explanation,
    isLoading,
    error,
    explain,
  }
}

export function useQueryLogs() {
  const { user } = useUser()
  const [logs, setLogs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  const fetchLogs = useCallback(async (limit: number = 50, skip: number = 0) => {
    if (!user?.id) return
    
    try {
      setIsLoading(true)
      setError(null)
      const data = await backendAPI.listQueryLogs(user.id, limit, skip) as any
      setLogs(data.logs || [])
      setTotal(data.total || 0)
      return data
    } catch (err: any) {
      setError(err.message || 'Failed to fetch query logs')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  const getLog = useCallback(async (logId: string) => {
    if (!user?.id) throw new Error('User not authenticated')
    
    try {
      return await backendAPI.getQueryLog(user.id, logId)
    } catch (err: any) {
      throw err
    }
  }, [user?.id])

  return {
    logs,
    total,
    isLoading,
    error,
    fetchLogs,
    getLog,
  }
}

export function useSavings() {
  const { user } = useUser()
  const [accounts, setAccounts] = useState<any[]>([])
  const [goals, setGoals] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAccounts = useCallback(async () => {
    if (!user?.id) return
    
    try {
      setIsLoading(true)
      setError(null)
      const data = await backendAPI.getSavingsAccounts(user.id) as any
      setAccounts(Array.isArray(data) ? data : [])
      return data
    } catch (err: any) {
      setError(err.message || 'Failed to fetch savings accounts')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  const fetchGoals = useCallback(async () => {
    if (!user?.id) return
    
    try {
      setIsLoading(true)
      setError(null)
      const data = await backendAPI.getSavingsGoals(user.id) as any
      setGoals(Array.isArray(data) ? data : [])
      return data
    } catch (err: any) {
      setError(err.message || 'Failed to fetch savings goals')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  const fetchSummary = useCallback(async () => {
    if (!user?.id) return
    
    try {
      setIsLoading(true)
      setError(null)
      
      // Check cache first
      const cacheKey = `savings-summary:${user.id}`
      const cached = dataPrefetchService.get(cacheKey)
      if (cached) {
        setSummary(cached)
        setIsLoading(false)
        // Still fetch in background to update cache
        backendAPI.getSavingsSummary(user.id).then(data => {
          dataPrefetchService.set(cacheKey, data)
          setSummary(data)
        }).catch(() => {})
        return cached
      }
      
      const data = await backendAPI.getSavingsSummary(user.id)
      dataPrefetchService.set(cacheKey, data)
      setSummary(data)
      return data
    } catch (err: any) {
      setError(err.message || 'Failed to fetch savings summary')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  const fetchAll = useCallback(async () => {
    await Promise.all([
      fetchAccounts(),
      fetchGoals(),
      fetchSummary(),
    ])
  }, [fetchAccounts, fetchGoals, fetchSummary])

  const createAccount = useCallback(async (data: any) => {
    if (!user?.id) throw new Error('User not authenticated')
    
    try {
      setIsLoading(true)
      setError(null)
      const newAccount = await backendAPI.createSavingsAccount(user.id, data)
      setAccounts(prev => [newAccount, ...prev])
      await fetchSummary()
      return newAccount
    } catch (err: any) {
      setError(err.message || 'Failed to create savings account')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, fetchSummary])

  const updateAccount = useCallback(async (accountId: string, data: any) => {
    if (!user?.id) throw new Error('User not authenticated')
    
    try {
      setIsLoading(true)
      setError(null)
      const updated = await backendAPI.updateSavingsAccount(user.id, accountId, data)
      setAccounts(prev => prev.map(acc => acc.id === accountId ? updated : acc))
      await fetchSummary()
      return updated
    } catch (err: any) {
      setError(err.message || 'Failed to update savings account')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, fetchSummary])

  const deleteAccount = useCallback(async (accountId: string) => {
    if (!user?.id) throw new Error('User not authenticated')
    
    try {
      setIsLoading(true)
      setError(null)
      await backendAPI.deleteSavingsAccount(user.id, accountId)
      setAccounts(prev => prev.filter(acc => acc.id !== accountId))
      await fetchSummary()
    } catch (err: any) {
      setError(err.message || 'Failed to delete savings account')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, fetchSummary])

  const depositToAccount = useCallback(async (accountId: string, amount: number) => {
    if (!user?.id) throw new Error('User not authenticated')
    
    try {
      setIsLoading(true)
      setError(null)
      const result = await backendAPI.depositToSavingsAccount(user.id, accountId, amount)
      await fetchAccounts()
      await fetchSummary()
      return result
    } catch (err: any) {
      setError(err.message || 'Failed to deposit')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, fetchAccounts, fetchSummary])

  const withdrawFromAccount = useCallback(async (accountId: string, amount: number) => {
    if (!user?.id) throw new Error('User not authenticated')
    
    try {
      setIsLoading(true)
      setError(null)
      const result = await backendAPI.withdrawFromSavingsAccount(user.id, accountId, amount)
      await fetchAccounts()
      await fetchSummary()
      return result
    } catch (err: any) {
      setError(err.message || 'Failed to withdraw')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, fetchAccounts, fetchSummary])

  const createGoal = useCallback(async (data: any) => {
    if (!user?.id) throw new Error('User not authenticated')
    
    try {
      setIsLoading(true)
      setError(null)
      const newGoal = await backendAPI.createSavingsGoal(user.id, data)
      setGoals(prev => [newGoal, ...prev])
      await fetchSummary()
      return newGoal
    } catch (err: any) {
      setError(err.message || 'Failed to create savings goal')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, fetchSummary])

  const updateGoal = useCallback(async (goalId: string, data: any) => {
    if (!user?.id) throw new Error('User not authenticated')
    
    try {
      setIsLoading(true)
      setError(null)
      const updated = await backendAPI.updateSavingsGoal(user.id, goalId, data)
      setGoals(prev => prev.map(goal => goal.id === goalId ? updated : goal))
      await fetchSummary()
      return updated
    } catch (err: any) {
      setError(err.message || 'Failed to update savings goal')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, fetchSummary])

  const deleteGoal = useCallback(async (goalId: string) => {
    if (!user?.id) throw new Error('User not authenticated')
    
    try {
      setIsLoading(true)
      setError(null)
      await backendAPI.deleteSavingsGoal(user.id, goalId)
      setGoals(prev => prev.filter(goal => goal.id !== goalId))
      await fetchSummary()
    } catch (err: any) {
      setError(err.message || 'Failed to delete savings goal')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, fetchSummary])

  const contributeToGoal = useCallback(async (goalId: string, amount: number) => {
    if (!user?.id) throw new Error('User not authenticated')
    
    try {
      setIsLoading(true)
      setError(null)
      const result = await backendAPI.contributeToGoal(user.id, goalId, amount)
      await fetchGoals()
      await fetchSummary()
      return result
    } catch (err: any) {
      setError(err.message || 'Failed to contribute')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, fetchGoals, fetchSummary])

  return {
    accounts,
    goals,
    summary,
    isLoading,
    error,
    fetchAccounts,
    fetchGoals,
    fetchSummary,
    fetchAll,
    createAccount,
    updateAccount,
    deleteAccount,
    depositToAccount,
    withdrawFromAccount,
    createGoal,
    updateGoal,
    deleteGoal,
    contributeToGoal,
  }
}

export function useAccounts() {
  const { user } = useUser()
  
  // Initialize from cache if available
  const getInitialAccounts = () => {
    if (!user?.id) return []
    const cached = dataPrefetchService.getSync<any[]>(`accounts:${user.id}`)
    return cached || []
  }
  
  const getInitialSummary = () => {
    if (!user?.id) return null
    return dataPrefetchService.getSync<any>(`accounts-summary:${user.id}`)
  }
  
  const [accounts, setAccounts] = useState<any[]>(getInitialAccounts)
  const [summary, setSummary] = useState<any>(getInitialSummary)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasFetched, setHasFetched] = useState(false)

  const fetchAccounts = useCallback(async (force: boolean = false) => {
    if (!user?.id) return
    
    // Skip if already fetched and not forcing
    if (hasFetched && !force && accounts.length > 0) {
      return accounts
    }
    
    try {
      setIsLoading(true)
      setError(null)
      
      // Check cache first - use stale-while-revalidate
      const cacheKey = `accounts:${user.id}`
      const cached = dataPrefetchService.getSync<any[]>(cacheKey)
      
      if (cached && cached.length > 0 && !force) {
        setAccounts(cached)
        setIsLoading(false)
        setHasFetched(true)
        // Fetch fresh data in background
        backendAPI.getAccounts(user.id).then(data => {
          const accountsData = Array.isArray(data) ? data : []
          dataPrefetchService.set(cacheKey, accountsData)
          setAccounts(accountsData)
        }).catch(() => {})
        return cached
      }
      
      const data = await backendAPI.getAccounts(user.id) as any
      const accountsData = Array.isArray(data) ? data : []
      dataPrefetchService.set(cacheKey, accountsData)
      setAccounts(accountsData)
      setHasFetched(true)
      return data
    } catch (err: any) {
      setError(err.message || 'Failed to fetch accounts')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, hasFetched, accounts.length])

  const fetchSummary = useCallback(async (force: boolean = false) => {
    if (!user?.id) return
    
    // Skip if already fetched and not forcing
    if (hasFetched && !force && summary) {
      return summary
    }
    
    try {
      setIsLoading(true)
      setError(null)
      
      // Check cache first - use stale-while-revalidate
      const cacheKey = `accounts-summary:${user.id}`
      const cached = dataPrefetchService.getSync<any>(cacheKey)
      
      if (cached && !force) {
        setSummary(cached)
        setIsLoading(false)
        // Fetch fresh data in background
        backendAPI.getAccountsSummary(user.id).then(data => {
          dataPrefetchService.set(cacheKey, data)
          setSummary(data)
        }).catch(() => {})
        return cached
      }
      
      const data = await backendAPI.getAccountsSummary(user.id)
      dataPrefetchService.set(cacheKey, data)
      setSummary(data)
      return data
    } catch (err: any) {
      setError(err.message || 'Failed to fetch accounts summary')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, hasFetched, summary])

  const fetchAll = useCallback(async (force: boolean = false) => {
    // Only fetch if not already loaded or forcing
    if (!force && hasFetched && accounts.length > 0 && summary) {
      return
    }
    await Promise.all([
      fetchAccounts(force),
      fetchSummary(force),
    ])
  }, [fetchAccounts, fetchSummary, hasFetched, accounts.length, summary])

  const createAccount = useCallback(async (data: any) => {
    if (!user?.id) throw new Error('User not authenticated')
    
    try {
      setIsLoading(true)
      setError(null)
      const newAccount = await backendAPI.createAccount(user.id, data)
      setAccounts(prev => [newAccount, ...prev])
      await fetchSummary()
      return newAccount
    } catch (err: any) {
      setError(err.message || 'Failed to create account')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, fetchSummary])

  const updateAccount = useCallback(async (accountId: string, data: any) => {
    if (!user?.id) throw new Error('User not authenticated')
    
    try {
      setIsLoading(true)
      setError(null)
      const updated = await backendAPI.updateAccount(user.id, accountId, data)
      setAccounts(prev => prev.map(acc => acc.id === accountId ? updated : acc))
      await fetchSummary()
      return updated
    } catch (err: any) {
      setError(err.message || 'Failed to update account')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, fetchSummary])

  const deleteAccount = useCallback(async (accountId: string) => {
    if (!user?.id) throw new Error('User not authenticated')
    
    try {
      setIsLoading(true)
      setError(null)
      await backendAPI.deleteAccount(user.id, accountId)
      setAccounts(prev => prev.filter(acc => acc.id !== accountId))
      await fetchSummary()
    } catch (err: any) {
      setError(err.message || 'Failed to delete account')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, fetchSummary])

  const getAccount = useCallback(async (accountId: string) => {
    if (!user?.id) throw new Error('User not authenticated')
    
    try {
      return await backendAPI.getAccount(user.id, accountId)
    } catch (err: any) {
      throw err
    }
  }, [user?.id])

  return {
    accounts,
    summary,
    isLoading,
    error,
    fetchAccounts,
    fetchSummary,
    fetchAll,
    createAccount,
    updateAccount,
    deleteAccount,
    getAccount,
  }
}

export function useTransactions() {
  const { user } = useUser()
  const [transactions, setTransactions] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTransactions = useCallback(async (params?: {
    accountId?: string
    type?: string
    category?: string
    limit?: number
    skip?: number
  }) => {
    if (!user?.id) return
    
    try {
      setIsLoading(true)
      setError(null)
      
      // Check cache first (only for default params)
      if (!params || (!params.accountId && !params.type && !params.category)) {
        const cacheKey = `transactions:${user.id}`
        const cached = dataPrefetchService.get(cacheKey)
        if (cached) {
          setTransactions(Array.isArray(cached) ? cached : [])
          setIsLoading(false)
          // Still fetch in background to update cache
          backendAPI.getTransactions(user.id, params).then(data => {
            const transactionsData = Array.isArray(data) ? data : []
            dataPrefetchService.set(cacheKey, transactionsData)
            setTransactions(transactionsData)
          }).catch(() => {})
          return cached
        }
      }
      
      const data = await backendAPI.getTransactions(user.id, params) as any
      if (!params || (!params.accountId && !params.type && !params.category)) {
        const transactionsData = Array.isArray(data) ? data : []
        dataPrefetchService.set(`transactions:${user.id}`, transactionsData)
        setTransactions(transactionsData)
      } else {
        setTransactions(Array.isArray(data) ? data : [])
      }
      return data
    } catch (err: any) {
      setError(err.message || 'Failed to fetch transactions')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  const fetchStats = useCallback(async () => {
    if (!user?.id) return
    
    try {
      setIsLoading(true)
      setError(null)
      
      // Check cache first
      const cacheKey = `transactions-stats:${user.id}`
      const cached = dataPrefetchService.get(cacheKey)
      if (cached) {
        setStats(cached)
        setIsLoading(false)
        // Still fetch in background to update cache
        backendAPI.getTransactionStats(user.id).then(data => {
          dataPrefetchService.set(cacheKey, data)
          setStats(data)
        }).catch(() => {})
        return cached
      }
      
      const data = await backendAPI.getTransactionStats(user.id)
      dataPrefetchService.set(cacheKey, data)
      setStats(data)
      return data
    } catch (err: any) {
      setError(err.message || 'Failed to fetch transaction stats')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  const fetchRecommendations = useCallback(async (forceRefresh: boolean = false) => {
    if (!user?.id) return
    
    const cacheKey = `transaction_recommendations_${user.id}`
    const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes in milliseconds
    
    // Check localStorage cache first (unless forcing refresh)
    if (!forceRefresh && typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          const { data, timestamp } = JSON.parse(cached)
          const age = Date.now() - timestamp
          if (age < CACHE_DURATION) {
            // Show cached data immediately
            setRecommendations(data.recommendations || [])
            setIsRecommendationsLoading(false)
            
            // Fetch fresh data in background
            backendAPI.getTransactionRecommendations(user.id, false).then((freshData: any) => {
              setRecommendations(freshData.recommendations || [])
              localStorage.setItem(cacheKey, JSON.stringify({
                data: freshData,
                timestamp: Date.now()
              }))
            }).catch(() => {})
            return data
          }
        }
      } catch (e) {
        // Ignore cache errors
      }
    }
    
    try {
      setIsRecommendationsLoading(true)
      setError(null)
      
      const data = await backendAPI.getTransactionRecommendations(user.id, forceRefresh) as any
      setRecommendations(data.recommendations || [])
      
      // Cache in localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            data,
            timestamp: Date.now()
          }))
        } catch (e) {
          // Ignore localStorage errors (quota exceeded, etc.)
        }
      }
      
      return data
    } catch (err: any) {
      setError(err.message || 'Failed to fetch recommendations')
      throw err
    } finally {
      setIsRecommendationsLoading(false)
    }
  }, [user?.id])

  const fetchAll = useCallback(async () => {
    await Promise.all([
      fetchTransactions(),
      fetchStats(),
      fetchRecommendations(),
    ])
  }, [fetchTransactions, fetchStats, fetchRecommendations])

  const createTransaction = useCallback(async (data: any, skipAI: boolean = false) => {
    if (!user?.id) throw new Error('User not authenticated')
    
    try {
      setIsLoading(true)
      setError(null)
      const newTransaction = await backendAPI.createTransaction(user.id, data, skipAI)
      setTransactions(prev => [newTransaction, ...prev])
      
      // Invalidate localStorage caches (new transaction affects recommendations and insights)
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(`transaction_recommendations_${user.id}`)
          localStorage.removeItem(`ai_insights_${user.id}`)
        } catch (e) {
          // Ignore errors
        }
      }
      
      // Don't await these - let them run in background
      Promise.all([
        fetchStats().catch(() => {}),
        fetchRecommendations().catch(() => {})
      ])
      return newTransaction
    } catch (err: any) {
      setError(err.message || 'Failed to create transaction')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, fetchStats, fetchRecommendations])

  const deleteTransaction = useCallback(async (transactionId: string) => {
    if (!user?.id) throw new Error('User not authenticated')
    
    try {
      setIsLoading(true)
      setError(null)
      await backendAPI.deleteTransaction(user.id, transactionId)
      setTransactions(prev => prev.filter(t => t.id !== transactionId))
      
      // Invalidate localStorage caches (deleted transaction affects recommendations and insights)
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(`transaction_recommendations_${user.id}`)
          localStorage.removeItem(`ai_insights_${user.id}`)
        } catch (e) {
          // Ignore errors
        }
      }
      
      await fetchStats()
      await fetchRecommendations()
    } catch (err: any) {
      setError(err.message || 'Failed to delete transaction')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, fetchStats, fetchRecommendations])

  return {
    transactions,
    stats,
    recommendations,
    isLoading,
    isRecommendationsLoading,
    error,
    fetchTransactions,
    fetchStats,
    fetchRecommendations,
    fetchAll,
    createTransaction,
    deleteTransaction,
  }
}

export function useSavingsRecommendations() {
  const { user } = useUser()
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRecommendations = useCallback(async () => {
    if (!user?.id) return
    
    try {
      setIsLoading(true)
      setError(null)
      const data = await backendAPI.getSavingsAccountRecommendations(user.id) as any
      setRecommendations(data.recommendations || [])
      return data
    } catch (err: any) {
      setError(err.message || 'Failed to fetch savings recommendations')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  return {
    recommendations,
    isLoading,
    error,
    fetchRecommendations,
  }
}

export function useAIInsights() {
  const { user } = useUser()
  const [insights, setInsights] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Load from cache on mount
  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return
    
    const cacheKey = `ai_insights_${user.id}`
    const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes
    
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const { data, timestamp } = JSON.parse(cached)
        const age = Date.now() - timestamp
        if (age < CACHE_DURATION) {
          // Load cached data immediately
          setInsights(data)
        }
      }
    } catch (e) {
      // Ignore cache errors
    }
  }, [user?.id])

  const fetchInsights = useCallback(async (forceRefresh: boolean = false) => {
    if (!user?.id) return
    
    const cacheKey = `ai_insights_${user.id}`
    const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes in milliseconds
    
    // Check localStorage cache first (unless forcing refresh)
    if (!forceRefresh && typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          const { data, timestamp } = JSON.parse(cached)
          const age = Date.now() - timestamp
          if (age < CACHE_DURATION) {
            // Show cached data immediately
            setInsights(data)
            setIsLoading(false)
            setIsRefreshing(true)
            
            // Fetch fresh data in background
            backendAPI.getComprehensiveInsights(user.id, false).then((freshData) => {
              setInsights(freshData)
              setIsRefreshing(false)
              localStorage.setItem(cacheKey, JSON.stringify({
                data: freshData,
                timestamp: Date.now()
              }))
            }).catch(() => {
              setIsRefreshing(false)
            })
            return data
          }
        }
      } catch (e) {
        // Ignore cache errors
      }
    }
    
    try {
      setIsLoading(true)
      setError(null)
      
      const data = await backendAPI.getComprehensiveInsights(user.id, forceRefresh)
      setInsights(data)
      
      // Cache in localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            data,
            timestamp: Date.now()
          }))
        } catch (e) {
          // Ignore localStorage errors (quota exceeded, etc.)
        }
      }
      
      return data
    } catch (err: any) {
      setError(err.message || 'Failed to fetch AI insights')
      setInsights(null)
      return null
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [user?.id])

  return {
    insights,
    isLoading,
    isRefreshing,
    error,
    fetchInsights,
  }
}

export function useDataAccessControl() {
  const { user } = useUser()
  const [attributes, setAttributes] = useState<any>(null)
  const [permissions, setPermissions] = useState<any>(null)
  const [consentHistory, setConsentHistory] = useState<any[]>([])
  const [privacyScore, setPrivacyScore] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Load privacy score from cache on mount
  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return
    
    const cacheKey = `privacy_score_${user.id}`
    const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes
    
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const { data, timestamp } = JSON.parse(cached)
        const age = Date.now() - timestamp
        if (age < CACHE_DURATION) {
          // Load cached data immediately
          setPrivacyScore(data)
        }
      }
    } catch (e) {
      // Ignore cache errors
    }
  }, [user?.id])

  const fetchAttributes = useCallback(async () => {
    if (!user?.id) return
    
    try {
      setIsLoading(true)
      setError(null)
      const data = await backendAPI.getDataAttributes(user.id)
      setAttributes(data)
      return data
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data attributes')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  const fetchPermissions = useCallback(async () => {
    if (!user?.id) return
    
    try {
      setIsLoading(true)
      setError(null)
      const data = await backendAPI.getDataAccessPermissions(user.id)
      setPermissions(data)
      return data
    } catch (err: any) {
      setError(err.message || 'Failed to fetch permissions')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  const fetchConsentHistory = useCallback(async () => {
    if (!user?.id) return
    
    try {
      setIsLoading(true)
      setError(null)
      const data = await backendAPI.getConsentHistory(user.id) as any
      setConsentHistory(data.records || [])
      return data
    } catch (err: any) {
      setError(err.message || 'Failed to fetch consent history')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  const fetchPrivacyScore = useCallback(async (forceRefresh: boolean = false) => {
    if (!user?.id) return
    
    const cacheKey = `privacy_score_${user.id}`
    const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes in milliseconds
    
    // Check localStorage cache first (unless forcing refresh)
    if (!forceRefresh && typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          const { data, timestamp } = JSON.parse(cached)
          const age = Date.now() - timestamp
          if (age < CACHE_DURATION) {
            // Show cached data immediately
            setPrivacyScore(data)
            setIsLoading(false)
            setIsRefreshing(true)
            
            // Fetch fresh data in background
            backendAPI.getPrivacyScore(user.id, false).then((freshData) => {
              setPrivacyScore(freshData)
              setIsRefreshing(false)
              localStorage.setItem(cacheKey, JSON.stringify({
                data: freshData,
                timestamp: Date.now()
              }))
            }).catch(() => {
              setIsRefreshing(false)
            })
            return data
          }
        }
      } catch (e) {
        // Ignore cache errors
      }
    }
    
    try {
      setIsLoading(true)
      setError(null)
      
      const data = await backendAPI.getPrivacyScore(user.id, forceRefresh)
      setPrivacyScore(data)
      
      // Cache in localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            data,
            timestamp: Date.now()
          }))
        } catch (e) {
          // Ignore localStorage errors (quota exceeded, etc.)
        }
      }
      
      return data
    } catch (err: any) {
      setError(err.message || 'Failed to fetch privacy score')
      throw err
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [user?.id])

  const updatePermissions = useCallback(async (permissions: any[]) => {
    if (!user?.id) throw new Error('User not authenticated')
    
    try {
      setIsLoading(true)
      setError(null)
      const data = await backendAPI.updateDataAccessPermissions(user.id, permissions)
      setPermissions(data)
      
      // Invalidate localStorage cache (permissions changed affects privacy score)
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(`privacy_score_${user.id}`)
        } catch (e) {
          // Ignore errors
        }
      }
      
      await fetchConsentHistory()
      await fetchPrivacyScore()
      return data
    } catch (err: any) {
      setError(err.message || 'Failed to update permissions')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, fetchConsentHistory, fetchPrivacyScore])

  const fetchAll = useCallback(async () => {
    await Promise.all([
      fetchAttributes(),
      fetchPermissions(),
      fetchConsentHistory(),
      fetchPrivacyScore(),
    ])
  }, [fetchAttributes, fetchPermissions, fetchConsentHistory, fetchPrivacyScore])

  return {
    attributes,
    permissions,
    consentHistory,
    privacyScore,
    isLoading,
    isRefreshing,
    error,
    fetchAttributes,
    fetchPermissions,
    updatePermissions,
    fetchConsentHistory,
    fetchPrivacyScore,
    fetchAll,
  }
}

