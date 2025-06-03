'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Wallet, ChevronDown, Copy, LogOut, Check } from 'lucide-react'

export function WalletButton() {
  const { 
    wallet, 
    connect, 
    disconnect, 
    connecting, 
    connected, 
    publicKey,
    select,
    wallets 
  } = useWallet()
  
  const [isOpen, setIsOpen] = useState(false)
  const [showWalletList, setShowWalletList] = useState(false)
  const [copied, setCopied] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleConnect = async () => {
    if (!wallet) {
      setShowWalletList(true)
      return
    }
    try {
      await connect()
    } catch (error) {
      console.error('Wallet connection failed:', error)
    }
  }

  const handleDisconnect = async () => {
    await disconnect()
    setIsOpen(false)
  }

  const handleWalletSelect = async (walletName: string) => {
    const selectedWallet = wallets.find(w => w.adapter.name === walletName)
    if (selectedWallet) {
      try {
        select(selectedWallet.adapter.name)
        setShowWalletList(false)
        // Connect directly with the selected wallet
        await selectedWallet.adapter.connect()
      } catch (error) {
        console.error('Wallet connection failed:', error)
        setShowWalletList(false)
      }
    }
  }

  const copyAddress = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey.toString())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  if (!mounted) {
    return (
      <div className="w-24 sm:w-32 h-8 sm:h-10 bg-[var(--accent)] rounded-lg animate-pulse"></div>
    )
  }

  // Wallet selection modal
  if (showWalletList && !connected) {
    return (
      <div className="relative">
        <button
          onClick={handleConnect}
          className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-sm font-medium"
        >
          <Wallet size={12} className="sm:w-4 sm:h-4" />
          <span className="text-xs sm:text-sm">Connect Wallet</span>
        </button>

        {/* Dropdown wallet list */}
        <div className="absolute top-full right-0 mt-2 w-64 sm:w-72 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg z-[9999] max-h-80 overflow-y-auto">
          <div className="p-4 border-b border-[var(--border)]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--card-foreground)]">
                Choose Wallet
              </h3>
              <button
                onClick={() => setShowWalletList(false)}
                className="p-1 rounded-lg hover:bg-[var(--accent)] text-[var(--foreground)] transition-colors"
              >
                <span className="text-lg">✕</span>
              </button>
            </div>
          </div>
          <div className="p-2">
            {wallets.map((wallet) => (
              <button
                key={wallet.adapter.name}
                onClick={() => handleWalletSelect(wallet.adapter.name)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--accent)] transition-colors text-left"
              >
                <img 
                  src={wallet.adapter.icon} 
                  alt={wallet.adapter.name}
                  className="w-6 h-6 flex-shrink-0"
                />
                <span className="font-medium text-sm text-[var(--card-foreground)]">
                  {wallet.adapter.name}
                </span>
              </button>
            ))}
          </div>
          <div className="p-3 border-t border-[var(--border)] text-center">
            <p className="text-xs text-[var(--muted-foreground)]">
              Select a wallet to connect
            </p>
          </div>
        </div>

        {/* Click outside to close */}
        <div 
          className="fixed inset-0 z-[9998]" 
          onClick={() => setShowWalletList(false)}
        />
      </div>
    )
  }

  // Connected state
  if (connected && publicKey) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all shadow-sm"
        >
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-200 rounded-full animate-pulse"></div>
          <span className="font-medium text-xs sm:text-sm">
            {formatAddress(publicKey.toString())}
          </span>
          <ChevronDown size={12} className={`sm:w-4 sm:h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full right-0 mt-2 w-56 sm:w-64 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg z-50">
            <div className="p-3 sm:p-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                {wallet?.adapter.icon && (
                  <img 
                    src={wallet.adapter.icon} 
                    alt={wallet.adapter.name}
                    className="w-4 h-4 sm:w-5 sm:h-5"
                  />
                )}
                <span className="font-medium text-sm sm:text-base text-[var(--card-foreground)]">
                  {wallet?.adapter.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-[var(--accent)] px-2 py-1 rounded text-[var(--card-foreground)] flex-1">
                  {formatAddress(publicKey.toString())}
                </code>
                <button
                  onClick={copyAddress}
                  className="p-1 hover:bg-[var(--accent)] rounded transition-colors"
                  title="Copy address"
                >
                  {copied ? (
                    <Check size={12} className="sm:w-3.5 sm:h-3.5 text-green-500" />
                  ) : (
                    <Copy size={12} className="sm:w-3.5 sm:h-3.5 text-[var(--muted-foreground)]" />
                  )}
                </button>
              </div>
            </div>
            <div className="p-2">
              <button
                onClick={handleDisconnect}
                className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors text-sm"
              >
                <LogOut size={12} className="sm:w-3.5 sm:h-3.5" />
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Click outside to close */}
        {isOpen && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
        )}
      </div>
    )
  }

  // Connecting state
  if (connecting) {
    return (
      <button 
        disabled
        className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-[var(--accent)] text-[var(--accent-foreground)] rounded-lg opacity-75"
      >
        <div className="animate-spin h-3 w-3 sm:h-4 sm:w-4 border-2 border-current border-t-transparent rounded-full"></div>
        <span className="text-xs sm:text-sm">Connecting...</span>
      </button>
    )
  }

  // Not connected state
  return (
    <button
      onClick={handleConnect}
      className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-sm font-medium"
    >
      <Wallet size={12} className="sm:w-4 sm:h-4" />
      <span className="text-xs sm:text-sm">Connect Wallet</span>
    </button>
  )
} 