'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Trophy, ExternalLink, Edit2, Save, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Post {
  id: string
  content: string
  author: string
  upvotes: number
  downvotes: number
  createdAt: string
}

interface LeaderboardEntry {
  id: string
  winner: string
  post: string
  amount: number
  transactionHash: string
  createdAt: string
  upvotes: number
  downvotes: number
}

export default function AdminPage() {
  const { publicKey, connected } = useWallet()
  const [isAdmin, setIsAdmin] = useState(false)
  const [posts, setPosts] = useState<Post[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [editingEntry, setEditingEntry] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ amount: 0, transactionHash: '' })
  const [loading, setLoading] = useState(true)

  // Check admin access
  useEffect(() => {
    if (connected && publicKey) {
      const adminWallet = process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS || 'your-admin-wallet-address'
      setIsAdmin(publicKey.toString() === adminWallet)
    } else {
      setIsAdmin(false)
    }
  }, [connected, publicKey])

  // Load current round posts
  const loadCurrentRoundPosts = async () => {
    try {
      // Get current active round
      const { data: activeRound } = await supabase
        .from('rounds')
        .select('id')
        .eq('is_active', true)
        .single()

      if (!activeRound) return

      const { data: postsData, error } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          upvotes,
          downvotes,
          created_at,
          users!inner(wallet_address)
        `)
        .eq('round_id', activeRound.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formattedPosts: Post[] = postsData?.map((post: any) => ({
        id: post.id,
        content: post.content,
        author: post.users.wallet_address,
        upvotes: post.upvotes,
        downvotes: post.downvotes,
        createdAt: post.created_at,
      })) || []

      setPosts(formattedPosts)
    } catch (error) {
      console.error('Error loading posts:', error)
    }
  }

  // Load leaderboard
  const loadLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select(`
          id,
          amount,
          transaction_hash,
          created_at,
          users!inner(wallet_address),
          posts!inner(content, upvotes, downvotes)
        `)
        .order('amount', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error

      const formattedLeaderboard: LeaderboardEntry[] = data?.map((entry: any) => ({
        id: entry.id,
        winner: entry.users.wallet_address,
        post: entry.posts.content,
        amount: entry.amount,
        transactionHash: entry.transaction_hash,
        createdAt: entry.created_at,
        upvotes: entry.posts.upvotes,
        downvotes: entry.posts.downvotes
      })) || []

      setLeaderboard(formattedLeaderboard)
    } catch (error) {
      console.error('Error loading leaderboard:', error)
    }
  }

  // Initialize data
  useEffect(() => {
    if (isAdmin) {
      const init = async () => {
        setLoading(true)
        await loadCurrentRoundPosts()
        await loadLeaderboard()
        setLoading(false)
      }
      init()

      // Set up real-time subscriptions for admin
      const postsSubscription = supabase
        .channel('admin_posts_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'posts'
          },
          (payload) => {
            console.log('Admin - Posts change received:', payload)
            loadCurrentRoundPosts() // Reload current round posts
          }
        )
        .subscribe()

      const votesSubscription = supabase
        .channel('admin_votes_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'votes'
          },
          (payload) => {
            console.log('Admin - Votes change received:', payload)
            loadCurrentRoundPosts() // Reload posts when votes change
          }
        )
        .subscribe()

      const leaderboardSubscription = supabase
        .channel('admin_leaderboard_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'leaderboard'
          },
          (payload) => {
            console.log('Admin - Leaderboard change received:', payload)
            loadLeaderboard() // Reload leaderboard when it changes
          }
        )
        .subscribe()

      // Cleanup subscriptions on unmount or admin change
      return () => {
        supabase.removeChannel(postsSubscription)
        supabase.removeChannel(votesSubscription)
        supabase.removeChannel(leaderboardSubscription)
      }
    }
  }, [isAdmin])

  const handleSelectWinner = async (post: Post) => {
    try {
      // Get user ID for the winner
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', post.author)
        .single()

      if (!userData) {
        alert('User not found')
        return
      }

      // Add to leaderboard
      const { data: newEntry, error } = await supabase
        .from('leaderboard')
        .insert({
          winner_id: userData.id,
          post_id: post.id,
          amount: 0,
          transaction_hash: ''
        })
        .select(`
          id,
          amount,
          transaction_hash,
          created_at,
          users!inner(wallet_address),
          posts!inner(content, upvotes, downvotes)
        `)
        .single()

      if (error) throw error

      const formattedEntry: LeaderboardEntry = {
        id: newEntry.id,
        winner: (newEntry.users as any).wallet_address,
        post: (newEntry.posts as any).content,
        amount: newEntry.amount,
        transactionHash: newEntry.transaction_hash,
        createdAt: newEntry.created_at,
        upvotes: (newEntry.posts as any).upvotes,
        downvotes: (newEntry.posts as any).downvotes
      }

      setLeaderboard(prev => [formattedEntry, ...prev])
      alert('Winner added to leaderboard!')
    } catch (error) {
      console.error('Error selecting winner:', error)
      alert('Failed to add winner')
    }
  }

  const handleEditEntry = (entry: LeaderboardEntry) => {
    setEditingEntry(entry.id)
    setEditForm({ amount: entry.amount, transactionHash: entry.transactionHash })
  }

  const handleSaveEdit = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('leaderboard')
        .update({
          amount: editForm.amount,
          transaction_hash: editForm.transactionHash
        })
        .eq('id', entryId)

      if (error) throw error

      setLeaderboard(prev => prev.map(entry => 
        entry.id === entryId 
          ? { ...entry, amount: editForm.amount, transactionHash: editForm.transactionHash }
          : entry
      ))
      setEditingEntry(null)
      alert('Entry updated successfully!')
    } catch (error) {
      console.error('Error updating entry:', error)
      alert('Failed to update entry')
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return

    try {
      const { error } = await supabase
        .from('leaderboard')
        .delete()
        .eq('id', entryId)

      if (error) throw error

      setLeaderboard(prev => prev.filter(entry => entry.id !== entryId))
      alert('Entry deleted successfully!')
    } catch (error) {
      console.error('Error deleting entry:', error)
      alert('Failed to delete entry')
    }
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-2xl font-bold mb-4 text-[var(--foreground)]">Admin Panel</h1>
            <p className="text-[var(--foreground)]">Please connect your wallet to access the admin panel.</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-2xl font-bold mb-4 text-[var(--foreground)]">Access Denied</h1>
            <p className="text-red-600">You don't have admin access to this panel.</p>
            <p className="text-sm text-gray-500 mt-2">
              Connected wallet: {publicKey?.toString().slice(0, 8)}...
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-[var(--foreground)]">Loading admin panel...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <Header onlineUsers={0} connectionStatus="online" />
      <div className="container mx-auto px-4 py-8 flex-1">
        <h1 className="text-3xl font-bold mb-8 text-center text-[var(--foreground)]">
          Admin Panel
        </h1>

        {/* Current Posts - Select Winner */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold mb-6 text-[var(--foreground)]">
            Current Round Posts - Select Winner
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {posts.map(post => (
              <div
                key={post.id}
                className="p-4 border border-[var(--border)] rounded-lg bg-[var(--card)]"
              >
                <div className="space-y-3">
                  <div className="text-sm text-gray-500">
                    {post.author.slice(0, 3)}...{post.author.slice(-3)}
                  </div>
                  <p className="text-[var(--card-foreground)]">{post.content}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      Score: {post.upvotes - post.downvotes} (+{post.upvotes}/-{post.downvotes})
                    </div>
                    <button
                      onClick={() => handleSelectWinner(post)}
                      className="flex items-center gap-2 px-3 py-1 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                    >
                      <Trophy size={14} />
                      Select Winner
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {posts.length === 0 && (
              <div className="col-span-full text-center py-8 text-[var(--foreground)]">
                <p>No posts in current round yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Leaderboard Management */}
        <div>
          <h2 className="text-2xl font-semibold mb-6 text-[var(--foreground)]">
            Pending Winners (Under Review)
          </h2>
          <div className="space-y-4 mb-12">
            {leaderboard.filter(entry => !entry.amount && !entry.transactionHash).map(entry => (
              <div
                key={entry.id}
                className="p-4 border border-yellow-500 rounded-lg bg-yellow-50 dark:bg-yellow-950"
              >
                {editingEntry === entry.id ? (
                  <div className="space-y-4">
                    <div>
                      <p className="font-medium text-[var(--card-foreground)] mb-2">"{entry.post}"</p>
                      <p className="text-sm text-gray-500">by {entry.winner.slice(0, 3)}...{entry.winner.slice(-3)}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--card-foreground)] mb-1">
                          Amount (SOL)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.amount}
                          onChange={(e) => setEditForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                          className="w-full p-2 border border-[var(--border)] rounded bg-[var(--background)] text-[var(--foreground)]"
                          placeholder="0.1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--card-foreground)] mb-1">
                          Transaction Hash
                        </label>
                        <input
                          type="text"
                          value={editForm.transactionHash}
                          onChange={(e) => setEditForm(prev => ({ ...prev, transactionHash: e.target.value }))}
                          className="w-full p-2 border border-[var(--border)] rounded bg-[var(--background)] text-[var(--foreground)]"
                          placeholder="Enter Solana transaction hash..."
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(entry.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      >
                        <Save size={14} />
                        Send Reward & Update Status
                      </button>
                      <button
                        onClick={() => setEditingEntry(null)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        <X size={14} />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-[var(--card-foreground)] mb-2">"{entry.post}"</p>
                      <p className="text-sm text-gray-500 mb-2">by {entry.winner.slice(0, 3)}...{entry.winner.slice(-3)}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <span className="text-green-600">↑{entry.upvotes}</span>
                          <span className="text-red-600">↓{entry.downvotes}</span>
                          <span className="font-semibold">Net: +{entry.upvotes - entry.downvotes}</span>
                        </div>
                        <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                        <span className="text-yellow-600 dark:text-yellow-400">Under review for reward...</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleEditEntry(entry)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    >
                      <Trophy size={14} />
                      Process Reward
                    </button>
                  </div>
                )}
              </div>
            ))}
            {leaderboard.filter(entry => !entry.amount && !entry.transactionHash).length === 0 && (
              <div className="text-center py-8 text-[var(--foreground)]">
                <p>No pending winners to review.</p>
              </div>
            )}
          </div>

          <h2 className="text-2xl font-semibold mb-6 text-[var(--foreground)]">
            Completed Rewards
          </h2>
          <div className="space-y-4">
            {leaderboard.filter(entry => entry.amount > 0 || entry.transactionHash).map(entry => (
              <div
                key={entry.id}
                className="p-4 border border-green-500 rounded-lg bg-green-50 dark:bg-green-950"
              >
                {editingEntry === entry.id ? (
                  <div className="space-y-4">
                    <div>
                      <p className="font-medium text-[var(--card-foreground)] mb-2">"{entry.post}"</p>
                      <p className="text-sm text-gray-500">by {entry.winner.slice(0, 3)}...{entry.winner.slice(-3)}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--card-foreground)] mb-1">
                          Amount (SOL)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.amount}
                          onChange={(e) => setEditForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                          className="w-full p-2 border border-[var(--border)] rounded bg-[var(--background)] text-[var(--foreground)]"
                          placeholder="0.1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--card-foreground)] mb-1">
                          Transaction Hash
                        </label>
                        <input
                          type="text"
                          value={editForm.transactionHash}
                          onChange={(e) => setEditForm(prev => ({ ...prev, transactionHash: e.target.value }))}
                          className="w-full p-2 border border-[var(--border)] rounded bg-[var(--background)] text-[var(--foreground)]"
                          placeholder="Enter Solana transaction hash..."
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(entry.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      >
                        <Save size={14} />
                        Save Reward Details
                      </button>
                      <button
                        onClick={() => setEditingEntry(null)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        <X size={14} />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-[var(--card-foreground)] mb-1">"{entry.post}"</p>
                      <p className="text-sm text-gray-500 mb-2">by {entry.winner.slice(0, 3)}...{entry.winner.slice(-3)}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <span className="text-green-600">↑{entry.upvotes}</span>
                          <span className="text-red-600">↓{entry.downvotes}</span>
                          <span className="font-semibold">Net: +{entry.upvotes - entry.downvotes}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="text-green-600 dark:text-green-400">Reward Sent</span>
                        </div>
                        <span className="font-semibold text-[var(--primary)]">
                          {entry.amount} SOL
                        </span>
                        {entry.transactionHash && (
                          <a
                            href={`https://explorer.solana.com/tx/${entry.transactionHash}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <ExternalLink size={12} />
                            View TX
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditEntry(entry)}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        <Edit2 size={14} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="flex items-center gap-2 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        <X size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {leaderboard.filter(entry => entry.amount > 0 || entry.transactionHash).length === 0 && (
              <div className="text-center py-8 text-[var(--foreground)]">
                <p>No completed rewards yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
} 