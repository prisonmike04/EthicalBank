'use client'

import { AppLayout } from '@/components/app-layout'
import { AIChatbot } from '@/components/AIChatbot'

export default function AIChatPage() {
  return (
    <AppLayout>
      <div className="flex flex-col h-full space-y-6">
        <div className="flex-shrink-0">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            AI Banking Assistant
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">
            Ask me anything about your banking - loans, accounts, transactions, offers, and more!
          </p>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <AIChatbot />
        </div>
      </div>
    </AppLayout>
  )
}
