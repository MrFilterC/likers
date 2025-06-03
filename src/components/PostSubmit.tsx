'use client'

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Send } from 'lucide-react'

interface PostSubmitProps {
  onSubmit: (content: string) => void
  disabled?: boolean
  preparationMode?: boolean
  loading?: boolean
}

export function PostSubmit({ onSubmit, disabled, preparationMode, loading }: PostSubmitProps) {
  const [content, setContent] = useState('')
  const { connected } = useWallet()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (content.trim() && content.length <= 140 && !preparationMode && !loading) {
      onSubmit(content.trim())
      setContent('')
    }
  }

  const isDisabled = !connected || disabled || preparationMode || loading

  return (
    <div className="w-full max-w-2xl mx-auto mb-6 sm:mb-8">
      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
        <div className="relative">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="How will you convince the community to win the next prize?"
            className="w-full p-3 sm:p-4 border border-[var(--border)] rounded-lg bg-[var(--card)] text-[var(--card-foreground)] placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-colors text-sm sm:text-base"
            rows={3}
            maxLength={140}
            disabled={isDisabled}
          />
          <div className="absolute bottom-2 right-2 text-xs sm:text-sm text-gray-500">
            {content.length}/140
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
          <div className="text-xs sm:text-sm text-gray-500">
            {!connected && "Connect your wallet to participate"}
            {preparationMode && "Round is ending, please wait for next round"}
          </div>
          <button
            type="submit"
            disabled={isDisabled || !content.trim() || content.length > 140}
            className="flex items-center justify-center gap-1 sm:gap-2 px-4 sm:px-6 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity text-sm sm:text-base"
          >
            {loading ? (
              <>
                <div className="animate-spin h-3 w-3 sm:h-4 sm:w-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Send size={14} className="sm:w-4 sm:h-4" />
                <span>Submit</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
} 