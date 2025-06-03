'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { ThumbsUp, ThumbsDown, Trophy, Copy, Check } from 'lucide-react'

interface PostCardProps {
  id: string
  content: string
  author: string
  upvotes: number
  downvotes: number
  userVote?: 'upvote' | 'downvote' | null
  isWinner?: boolean
  isVoting?: boolean
  onVote: (postId: string, voteType: 'upvote' | 'downvote') => void
  createdAt: string
  rank?: number // Position in the ranking (1, 2, 3...)
}

export function PostCard({ 
  id, 
  content, 
  author, 
  upvotes, 
  downvotes, 
  userVote, 
  isWinner,
  isVoting,
  onVote,
  createdAt,
  rank
}: PostCardProps) {
  const { connected, publicKey } = useWallet()
  const [animatingVotes, setAnimatingVotes] = useState<{upvotes: boolean, downvotes: boolean}>({
    upvotes: false,
    downvotes: false
  })
  const [prevUpvotes, setPrevUpvotes] = useState(upvotes)
  const [prevDownvotes, setPrevDownvotes] = useState(downvotes)
  const [copied, setCopied] = useState(false)

  // Check if this is user's own post
  const isOwnPost = !!(connected && publicKey && author === publicKey.toString())
  
  const netScore = upvotes - downvotes
  const isTopThree = rank && rank <= 3

  // Get background color class based on net score and ranking
  const getBackgroundClass = () => {
    if (isWinner) {
      return 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950 dark:to-orange-950'
    }
    
    // Keep normal card background for all posts
    return 'bg-[var(--card)]'
  }

  // Get border class based on conditions
  const getBorderClass = () => {
    if (isWinner) {
      return 'border-yellow-500 border-2'
    }
    if (isTopThree) {
      return 'border-green-400 dark:border-green-600 border-2'
    }
    if (isOwnPost) {
      return 'border-blue-300 dark:border-blue-700 border-2'
    }
    
    // Border colors based on net score for non-top-3, non-own posts
    if (netScore > 0) {
      return 'border-green-200 dark:border-green-800 border-2'
    } else if (netScore < 0) {
      return 'border-red-200 dark:border-red-800 border-2'
    } else {
      return 'border-gray-300 dark:border-gray-700 border-2'
    }
  }

  // Get rank display
  const getRankDisplay = () => {
    if (!rank || rank > 3) return null
    const rankText = rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'
    return (
      <div className="absolute -top-2 -left-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
        {rankText}
      </div>
    )
  }

  // Animation when vote counts change
  useEffect(() => {
    if (upvotes !== prevUpvotes) {
      setAnimatingVotes(prev => ({ ...prev, upvotes: true }))
      setTimeout(() => setAnimatingVotes(prev => ({ ...prev, upvotes: false })), 600)
      setPrevUpvotes(upvotes)
    }
  }, [upvotes, prevUpvotes])

  useEffect(() => {
    if (downvotes !== prevDownvotes) {
      setAnimatingVotes(prev => ({ ...prev, downvotes: true }))
      setTimeout(() => setAnimatingVotes(prev => ({ ...prev, downvotes: false })), 600)
      setPrevDownvotes(downvotes)
    }
  }, [downvotes, prevDownvotes])

  const handleVote = async (voteType: 'upvote' | 'downvote') => {
    if (!connected || isVoting || isOwnPost) return
    
    onVote(id, voteType)
  }

  const formatWalletAddress = (address: string) => {
    if (address.length < 6) return address
    return `${address.slice(0, 3)}...${address.slice(-3)}`
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(author)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy address:', error)
    }
  }

  return (
    <div className={`relative p-3 sm:p-4 rounded-lg transition-all hover:shadow-md ${getBorderClass()} ${getBackgroundClass()}`}>
      {getRankDisplay()}
      
      {isWinner && (
        <div className="absolute -top-2 -right-2 bg-yellow-500 text-white rounded-full p-1.5 sm:p-2">
          <Trophy size={14} className="sm:w-4 sm:h-4" />
        </div>
      )}
      
      {isOwnPost && !isWinner && (
        <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md shadow-sm">
          mine
        </div>
      )}
      
      <div className="space-y-2 sm:space-y-3">
        <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1 sm:gap-2">
            <span>{formatWalletAddress(author)}</span>
            <button
              onClick={copyAddress}
              className="p-0.5 sm:p-1 hover:bg-[var(--accent)] rounded transition-colors"
              title="Copy wallet address"
            >
              {copied ? (
                <Check size={10} className="sm:w-3 sm:h-3 text-green-500" />
              ) : (
                <Copy size={10} className="sm:w-3 sm:h-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" />
              )}
            </button>
          </div>
          <span className="text-xs">{formatTime(createdAt)}</span>
        </div>
        
        <p className="text-[var(--card-foreground)] leading-relaxed text-sm sm:text-base">
          {content}
        </p>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => handleVote('upvote')}
              disabled={!connected || isVoting || isOwnPost}
              className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-lg transition-all text-xs sm:text-sm ${
                userVote === 'upvote'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                  : 'bg-[var(--accent)] hover:bg-[var(--muted)] text-[var(--accent-foreground)]'
              } disabled:opacity-50 disabled:cursor-not-allowed ${
                animatingVotes.upvotes ? 'animate-bounce bg-green-200 dark:bg-green-800' : ''
              } ${isVoting ? 'opacity-75' : ''}`}
              {...(isOwnPost && { title: "You cannot vote on your own post" })}
            >
              {isVoting ? (
                <div className="animate-spin h-2.5 w-2.5 sm:h-3 sm:w-3 border border-current border-t-transparent rounded-full"></div>
              ) : (
                <ThumbsUp size={12} className="sm:w-3.5 sm:h-3.5" />
              )}
              <span className={`transition-all ${animatingVotes.upvotes ? 'scale-125 font-bold text-green-600' : ''}`}>
                {upvotes}
              </span>
            </button>
            
            <button
              onClick={() => handleVote('downvote')}
              disabled={!connected || isVoting || isOwnPost}
              className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-lg transition-all text-xs sm:text-sm ${
                userVote === 'downvote'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                  : 'bg-[var(--accent)] hover:bg-[var(--muted)] text-[var(--accent-foreground)]'
              } disabled:opacity-50 disabled:cursor-not-allowed ${
                animatingVotes.downvotes ? 'animate-bounce bg-red-200 dark:bg-red-800' : ''
              } ${isVoting ? 'opacity-75' : ''}`}
              {...(isOwnPost && { title: "You cannot vote on your own post" })}
            >
              {isVoting ? (
                <div className="animate-spin h-2.5 w-2.5 sm:h-3 sm:w-3 border border-current border-t-transparent rounded-full"></div>
              ) : (
                <ThumbsDown size={12} className="sm:w-3.5 sm:h-3.5" />
              )}
              <span className={`transition-all ${animatingVotes.downvotes ? 'scale-125 font-bold text-red-600' : ''}`}>
                {downvotes}
              </span>
            </button>
          </div>
          
          <div className={`text-xs sm:text-sm font-semibold transition-all ${
            netScore > 0 ? 'text-green-600 dark:text-green-400' : 
            netScore < 0 ? 'text-red-600 dark:text-red-400' : 
            'text-gray-600 dark:text-gray-400'
          }`}>
            {netScore > 0 ? '+' : ''}{netScore}
          </div>
        </div>
      </div>
    </div>
  )
} 