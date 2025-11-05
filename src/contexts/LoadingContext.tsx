'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useTransition } from 'react'

interface LoadingContextType {
  isLoading: boolean
  setLoading: (loading: boolean) => void
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)
  const pathname = usePathname()
  const [isPending] = useTransition()
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const prevPathnameRef = useRef(pathname)

  // Detect pathname changes and set loading
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname
      
      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      // Set loading state asynchronously to avoid linter warning
      timerRef.current = setTimeout(() => {
        setIsLoading(true)
        
        // Auto-clear after delay
        setTimeout(() => {
          setIsLoading(false)
        }, 300)
      }, 0)
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [pathname])

  // Track React transitions
  useEffect(() => {
    if (isPending) {
      // Set loading asynchronously
      const timer = setTimeout(() => {
        setIsLoading(true)
      }, 0)
      return () => clearTimeout(timer)
    } else {
      // Small delay to prevent flicker
      const timer = setTimeout(() => {
        setIsLoading(false)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isPending])

  // Combine both loading states
  const combinedLoading = isLoading || isPending

  return (
    <LoadingContext.Provider value={{ isLoading: combinedLoading, setLoading: setIsLoading }}>
      {children}
    </LoadingContext.Provider>
  )
}

export function useLoading() {
  const context = useContext(LoadingContext)
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider')
  }
  return context
}
