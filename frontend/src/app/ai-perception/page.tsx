'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppLayout } from '@/components/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useUser } from '@clerk/nextjs'
import { backendAPI } from '@/lib/backend-api'
import { Loader2, AlertTriangle, Brain, Scale, History, RefreshCw, Clock } from 'lucide-react'

interface PerceptionAttribute {
  category: string
  label: string
  confidence: number
  evidence: string[]
  lastUpdated: string
  status: 'active' | 'disputed' | 'corrected'
}

interface PerceptionData {
  summary: string
  attributes: PerceptionAttribute[]
  lastAnalysis: string
}

export default function AIPerceptionPage() {
  const { user } = useUser()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState<PerceptionData | null>(null)
  const [selectedAttribute, setSelectedAttribute] = useState<PerceptionAttribute | null>(null)
  const [disputeReason, setDisputeReason] = useState('')
  const [correction, setCorrection] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPerception = useCallback(async (forceRefresh: boolean = false) => {
    if (!user?.id) return
    
    try {
      if (forceRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)
      
      // Use the backend API client with proper timeout and refresh parameter
      const endpoint = forceRefresh ? '/api/ai-perception?refresh=true' : '/api/ai-perception'
      const res = await backendAPI.request<PerceptionData>(endpoint, {
        clerkUserId: user.id,
        timeout: 120000 // 120 seconds timeout for complex AI analysis
      })
      setData(res)
    } catch (err: any) {
      console.error('Failed to fetch perception:', err)
      setError(err.message || 'Failed to load AI perception. This may take a while - please try refreshing.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (user?.id) {
      fetchPerception(false) // Don't force refresh on initial load - use cache
    }
  }, [user?.id]) // Removed fetchPerception from deps to prevent re-fetching

  const handleDispute = async () => {
    if (!selectedAttribute || !user?.id) return

    try {
      setSubmitting(true)
      await backendAPI.disputeAIPerception(user.id, {
        category: selectedAttribute.category,
        label: selectedAttribute.label,
        reason: disputeReason,
        correction: correction || undefined
      })
      
      // Refresh data to show "disputed" status (don't force refresh - use cache if available)
      await fetchPerception(false)
      setSelectedAttribute(null)
      setDisputeReason('')
      setCorrection('')
    } catch (err) {
      console.error('Dispute failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-col h-[60vh] items-center justify-center space-y-6">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Brain className="h-6 w-6 text-purple-400 animate-pulse" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              Analyzing Your Financial Profile
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md">
              Our AI is analyzing your transactions, spending patterns, and financial behavior. 
              This may take 30-90 seconds...
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className="h-2 w-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="h-2 w-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Brain className="h-8 w-8 text-purple-600" />
              My AI Perception
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              See exactly how our AI categorizes you, and dispute anything that feels wrong.
              Transparency is your right.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => fetchPerception(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2"
            title="Force refresh AI perception (bypasses 24-hour cache)"
          >
            {refreshing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Refresh Analysis
              </>
            )}
          </Button>
        </div>

        {error && (
          <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Summary Card */}
        <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-neutral-900 border-purple-100 dark:border-purple-900">
          <CardHeader>
            <CardTitle className="text-purple-900 dark:text-purple-100">AI Executive Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg leading-relaxed text-neutral-800 dark:text-neutral-200">
              &ldquo;{data?.summary}&rdquo;
            </p>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <History className="h-3 w-3" />
                Last analyzed: {data?.lastAnalysis ? new Date(data.lastAnalysis).toLocaleString() : 'Just now'}
              </div>
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Cached for 24h
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Attributes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.attributes.map((attr, idx) => (
            <Card key={idx} className={`relative overflow-hidden transition-all hover:shadow-md ${
              attr.status === 'disputed' ? 'opacity-75 border-dashed border-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/10' : ''
            }`}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <Badge variant="outline" className="mb-2">{attr.category}</Badge>
                  {attr.status === 'disputed' && (
                    <Badge variant="warning" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Disputed
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-xl">{attr.label}</CardTitle>
                <CardDescription>
                  Confidence: {(attr.confidence * 100).toFixed(0)}%
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs font-semibold uppercase text-neutral-500">Why we think this:</span>
                    <ul className="mt-1 space-y-1">
                      {attr.evidence.map((ev, i) => (
                        <li key={i} className="text-sm text-neutral-700 dark:text-neutral-300 flex items-start gap-2">
                          <span className="text-blue-500 mt-1">•</span>
                          {ev}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4 flex justify-end">
                    {attr.status !== 'disputed' && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                            onClick={() => setSelectedAttribute(attr)}
                          >
                            <Scale className="h-4 w-4 mr-2" />
                            That&apos;s Wrong (Dispute)
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Dispute AI Perception</DialogTitle>
                            <DialogDescription>
                              Tell us why the label &ldquo;{attr.label}&rdquo; is incorrect. This will trigger a manual review and model retraining.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Why is this wrong?</Label>
                              <Textarea 
                                placeholder="E.g., I made a large purchase for my wedding, not because I'm an impulsive spender."
                                value={disputeReason}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDisputeReason(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Proposed Correction (Optional)</Label>
                              <Input 
                                placeholder="E.g., Moderate Spender"
                                value={correction}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCorrection(e.target.value)}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setSelectedAttribute(null)}>Cancel</Button>
                            <Button 
                              onClick={handleDispute} 
                              disabled={!disputeReason || submitting}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Dispute'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

