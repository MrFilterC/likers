'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useTheme } from 'next-themes'
import { Moon, Sun, HelpCircle, X } from 'lucide-react'
import Link from 'next/link'
import { WalletButton } from './WalletButton'

interface HeaderProps {
  onlineUsers?: number
  connectionStatus?: 'online' | 'offline' | 'connecting'
}

export function Header({ onlineUsers = 0, connectionStatus = 'connecting' }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const [showModal, setShowModal] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Fix hydration error
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-[var(--border)] bg-[var(--background)] backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/60">
        <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-3 sm:px-6 lg:px-8">
          {/* Logo + Text - Clickable */}
          <Link href="/" className="flex items-center gap-1.5 sm:gap-3 hover:opacity-80 transition-opacity flex-shrink-0">
            <img 
              src="/likers.png" 
              alt="Likers" 
              className="h-8 sm:h-12 w-auto"
            />
            <span className="text-sm sm:text-xl font-bold text-[var(--foreground)] whitespace-nowrap">
              $LIKERS
            </span>
          </Link>

          {/* Center - How it works - Smaller on mobile */}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--muted)] text-[var(--accent-foreground)] transition-colors flex-shrink-0"
          >
            <HelpCircle size={12} className="sm:w-4 sm:h-4" />
            <span className="text-xs sm:text-sm">How it works</span>
          </button>

          {/* Right side - Theme toggle + Status + Wallet */}
          <div className="flex items-center gap-1 sm:gap-4 flex-shrink-0">
            {/* Connection Status & Online Users */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'online' ? 'bg-green-500' : 
                  connectionStatus === 'offline' ? 'bg-red-500' : 
                  'bg-yellow-500 animate-pulse'
                }`}></div>
                <span className="text-[var(--foreground)] font-medium">
                  {connectionStatus === 'online' ? 'Online' : 
                   connectionStatus === 'offline' ? 'Offline' : 
                   'Connecting...'}
                </span>
              </div>
              
              {connectionStatus === 'online' && onlineUsers > 0 && (
                <div className="flex items-center gap-1 px-3 py-1 bg-[var(--accent)] rounded-full text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-[var(--accent-foreground)] font-medium">
                    {onlineUsers} user{onlineUsers !== 1 ? 's' : ''} online
                  </span>
                </div>
              )}
            </div>

            {/* Mobile status - simplified */}
            <div className="sm:hidden flex items-center mr-1">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'online' ? 'bg-green-500' : 
                connectionStatus === 'offline' ? 'bg-red-500' : 
                'bg-yellow-500 animate-pulse'
              }`}></div>
            </div>

            <button
              onClick={toggleTheme}
              className="p-1 sm:p-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--muted)] text-[var(--accent-foreground)] transition-colors"
              aria-label="Toggle theme"
            >
              {mounted ? (
                theme === 'dark' ? <Sun size={14} className="sm:w-5 sm:h-5" /> : <Moon size={14} className="sm:w-5 sm:h-5" />
              ) : (
                <div className="w-3.5 h-3.5 sm:w-5 sm:h-5" /> // Placeholder to prevent layout shift
              )}
            </button>
            
            {mounted && <WalletButton />}
          </div>
        </div>
      </header>

      {/* How it works Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-[var(--card)] rounded-lg p-6 max-w-md w-full border border-[var(--border)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[var(--card-foreground)]">How it works</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-[var(--accent)] text-[var(--foreground)]"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3 text-[var(--card-foreground)]">
              <p><strong>• One post per round.</strong> Got something to say? Drop a single post (max 140 characters) each round.</p>
              <p><strong>• Vote it out.</strong> During the 10-minute round, posts go head-to-head. Like or dislike others in real-time.</p>
              <p><strong>• Most liked = Winner.</strong> At the end of each round, the most liked post wins – automatically.</p>
              <p><strong>• Earn what the round generates.</strong> All creator fee rewards generated during the round (from trading $Likers on believe.app) are claimed by the creator wallet and sent directly to the winner's wallet.</p>
              <p><strong>• Join with your wallet.</strong> Connect your Solana wallet to participate. No worries – it's just a signature to verify ownership. No approvals. No risks. Burner wallets are totally fine!</p>
              <p><strong>• New round, new chance.</strong> When a round ends, a new one begins – and rewards keep flowing. Forever.</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
} 