'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { PostSubmit } from '@/components/PostSubmit'
import { CountdownTimer } from '@/components/CountdownTimer'
import { PostCard } from '@/components/PostCard'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

interface Post {
  id: string
  content: string
  author: string
  upvotes: number
  downvotes: number
  userVote?: 'upvote' | 'downvote' | null
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

export default function Home() {
  const { publicKey, connected } = useWallet()
  const [activeTab, setActiveTab] = useState<'posts' | 'leaderboard'>('posts')
  const [posts, setPosts] = useState<Post[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [currentRoundEnd, setCurrentRoundEnd] = useState<Date>(new Date(Date.now() + 60 * 1000))
  const [winnerPost, setWinnerPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<number>(0)
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'connecting'>('connecting')
  const [preparationMode, setPreparationMode] = useState<boolean>(false)
  const [preparationEnd, setPreparationEnd] = useState<Date | null>(null)
  const [roundNumber, setRoundNumber] = useState<number>(1)
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    globalPosts: string,
    globalVotes: string,
    leaderboard: string,
    presence: string,
    rounds: string
  }>({
    globalPosts: 'disconnected',
    globalVotes: 'disconnected', 
    leaderboard: 'disconnected',
    presence: 'disconnected',
    rounds: 'disconnected'
  })

  // Loading states for user actions
  const [submittingPost, setSubmittingPost] = useState(false)
  const [votingPosts, setVotingPosts] = useState<Set<string>>(new Set())

  // Load posts from Supabase
  const loadPosts = async (forceRoundId?: string) => {
    try {
      const roundIdToUse = forceRoundId || currentRoundId
      
      if (!roundIdToUse) {
        return
      }

      logger.debug('loadPosts: Loading posts for round:', roundIdToUse)

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
        .eq('round_id', roundIdToUse)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('loadPosts error:', error)
        throw error
      }

      logger.debug('loadPosts: Raw data received:', postsData?.length || 0, 'posts')

      const formattedPosts: Post[] = postsData?.map((post: {
        id: string;
        content: string;
        upvotes: number;
        downvotes: number;
        created_at: string;
        users: { wallet_address: string };
      }) => ({
        id: post.id,
        content: post.content,
        author: post.users.wallet_address,
        upvotes: post.upvotes,
        downvotes: post.downvotes,
        createdAt: post.created_at,
        userVote: null // Will be loaded separately
      })) || []

      logger.debug('loadPosts: Formatted posts:', formattedPosts.length)

      // Load user votes if connected
      if (connected && publicKey) {
        logger.debug('loadPosts: Loading user votes for', publicKey.toString())
        
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('wallet_address', publicKey.toString())
          .single()

        if (userData) {
          const { data: votesData } = await supabase
            .from('votes')
            .select('post_id, vote_type')
            .eq('user_id', userData.id)
            .in('post_id', formattedPosts.map(p => p.id))

          const userVotes = new Map(votesData?.map(v => [v.post_id, v.vote_type]) || [])
          
          formattedPosts.forEach(post => {
            post.userVote = userVotes.get(post.id) || null
          })

          logger.debug('loadPosts: User votes loaded:', votesData?.length || 0)
        }
      }

      // Sort posts by net score (upvotes - downvotes) in descending order
      const sortedPosts = formattedPosts.sort((a, b) => {
        const aNetScore = a.upvotes - a.downvotes
        const bNetScore = b.upvotes - b.downvotes
        // If net scores are equal, sort by creation time (newest first)
        if (aNetScore === bNetScore) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        }
        return bNetScore - aNetScore
      })

      logger.debug('loadPosts: Setting', sortedPosts.length, 'sorted posts')
      setPosts(sortedPosts)
    } catch (error) {
      logger.error('Error loading posts:', error)
    }
  }

  // Load leaderboard from Supabase
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

      const formattedLeaderboard: LeaderboardEntry[] = data?.map((entry: {
        id: string;
        amount: number;
        transaction_hash: string;
        created_at: string;
        users: { wallet_address: string };
        posts: { content: string; upvotes: number; downvotes: number };
      }) => ({
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

  // Get or create current round
  const getCurrentRound = async () => {
    try {
      logger.debug('Getting current round...')
      
      // First, clean up any old active rounds that should be ended
      await supabase
        .from('rounds')
        .update({ 
          is_active: false, 
          server_ended: true 
        })
        .eq('is_active', true)
        .lt('end_time', new Date(Date.now() - 35000).toISOString()) // Older than 35 seconds ago
      
      // Now try to get active round
      const { data: activeRounds, error: activeError } = await supabase
        .from('rounds')
        .select('*')
        .eq('is_active', true)
        .eq('server_ended', false) // Only get rounds that haven't been server-ended
        .order('created_at', { ascending: false })

      if (activeError) {
        logger.error('Error fetching active rounds:', activeError)
        // Fallback to mock data if database fails
        setCurrentRoundEnd(new Date(Date.now() + 60 * 1000))
        return
      }

      logger.debug('Active rounds found:', activeRounds?.length || 0)
      
      // Check if we have a valid active round
      if (activeRounds && activeRounds.length > 0) {
        const activeRound = activeRounds[0]
        const roundEndTime = new Date(activeRound.end_time)
        const now = new Date()
        const timeUntilEnd = roundEndTime.getTime() - now.getTime()
        
        logger.debug('Active round end time:', activeRound.end_time, 'vs now:', now.toISOString())
        logger.debug('Time until end:', timeUntilEnd, 'ms')
        
        // If round ended less than 30 seconds ago, we're in preparation mode
        const isInPreparationFromDB = timeUntilEnd <= 0 && timeUntilEnd > -30000 // -30 seconds
        
        if (timeUntilEnd > 0) {
          // Round is still active and running
          logger.debug('Found valid active round:', activeRound.id)
          setCurrentRoundId(activeRound.id)
          setCurrentRoundEnd(roundEndTime)
          setPreparationMode(false)
          setPreparationEnd(null)
          // Set round number from existing round
          if (activeRound.round_number) {
            setRoundNumber(activeRound.round_number)
          }
          
          // Clear winner for active round
          setWinnerPost(null)
          return
        } else if (isInPreparationFromDB) {
          // Round ended recently, we're in preparation mode
          logger.debug('Round in preparation mode:', activeRound.id)
          setCurrentRoundId(activeRound.id) // Keep same round ID during preparation
          setCurrentRoundEnd(roundEndTime)
          setPreparationMode(true)
          // Calculate preparation end time (30 seconds after round end)
          const prepEnd = new Date(roundEndTime.getTime() + 30 * 1000)
          setPreparationEnd(prepEnd)
          if (activeRound.round_number) {
            setRoundNumber(activeRound.round_number)
          }
          
          // Load winner if it exists for this round
          const winner = await loadWinnerFromDatabase(activeRound.id)
          if (winner) {
            setWinnerPost(winner)
          }
          
          // Auto-create next round after preparation
          const remainingPrepTime = prepEnd.getTime() - now.getTime()
          if (remainingPrepTime > 0) {
            setTimeout(async () => {
              logger.debug('Preparation ended, creating next round...')
              // Mark current round as server ended
              await supabase
                .from('rounds')
                .update({ server_ended: true, is_active: false })
                .eq('id', activeRound.id)
              
              await createNextRound(activeRound.round_number + 1)
            }, remainingPrepTime)
          } else {
            // Preparation already ended, create next round immediately
            await supabase
              .from('rounds')
              .update({ server_ended: true, is_active: false })
              .eq('id', activeRound.id)
            
            await createNextRound(activeRound.round_number + 1)
          }
          return
        } else {
          // Round ended more than 30 seconds ago, mark as server ended and create new
          logger.debug('Active round preparation expired, ending:', activeRound.id)
          await supabase
            .from('rounds')
            .update({ server_ended: true, is_active: false })
            .eq('id', activeRound.id)
          
          // Create next round immediately
          await createNextRound(activeRound.round_number + 1)
          return
        }
      }

      // No active round found, create first round
      await createNextRound(1)
    } catch (error) {
      logger.error('Error managing round:', error)
      // Fallback to mock data if database fails
      setCurrentRoundEnd(new Date(Date.now() + 60 * 1000))
    }
  }

  // Helper function to create next round
  const createNextRound = async (roundNumber: number) => {
    try {
      logger.debug('Creating new round #', roundNumber)
      const startTime = new Date()
      const endTime = new Date(startTime.getTime() + 60 * 1000) // 60 seconds

      const { data: newRound, error: createError } = await supabase
        .from('rounds')
        .insert({
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          is_active: true,
          round_number: roundNumber
        })
        .select()
        .single()

      if (createError) {
        logger.error('Error creating round:', createError)
        // Fallback to mock data if database fails
        setCurrentRoundEnd(new Date(Date.now() + 60 * 1000))
        setRoundNumber(roundNumber)
        return
      }

      logger.info('Created new round #', roundNumber, ':', newRound.id)
      setCurrentRoundId(newRound.id)
      setCurrentRoundEnd(endTime)
      setRoundNumber(roundNumber)
      setPreparationMode(false)
      setPreparationEnd(null)
    } catch (error) {
      logger.error('Error creating next round:', error)
      setCurrentRoundEnd(new Date(Date.now() + 60 * 1000))
    }
  }

  // Initialize data
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await getCurrentRound()
      await loadLeaderboard()
      setLoading(false)
    }
    init()

    // Connection status monitoring
    const updateOnlineStatus = () => {
      setConnectionStatus(navigator.onLine ? 'online' : 'offline')
    }
    
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
    updateOnlineStatus()

    // Global posts subscription (independent of rounds)
    const globalPostsSubscription = supabase
      .channel('global_posts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts'
        },
        (payload) => {
          logger.debug('Global Posts change received:', payload.eventType)
          
          // Reload posts after a short delay - pass the round_id from payload if available
          setTimeout(() => {
            logger.debug('Global post change: Reloading posts...')
            
            // If we have a round_id in the payload, check if it matches current round
            if (payload.new && typeof payload.new === 'object' && 'round_id' in payload.new && payload.eventType === 'INSERT') {
              const payloadRoundId = (payload.new as { round_id: string }).round_id
              
              // Don't process any posts during preparation mode
              if (preparationMode) {
                logger.debug('Ignoring post during preparation mode')
                return
              }
              
              // Only process if it's for the current round and we have an active round
              if (currentRoundId && payloadRoundId === currentRoundId) {
                logger.debug('Processing post for current/matching round')
                loadPosts(payloadRoundId)
              } else if (!currentRoundId) {
                logger.debug('No current round, setting from payload and loading')
                setCurrentRoundId(payloadRoundId)
                // Load posts directly with payload round ID since state update is async
                loadPosts(payloadRoundId)
              } else {
                logger.debug('Ignoring post from different round')
                return
              }
            } else if (currentRoundId && !preparationMode) {
              loadPosts()
            } else {
              logger.debug('No currentRoundId or in preparation mode - skipping post update')
            }
          }, 300)
        }
      )
      .subscribe((status) => {
        logger.debug('Global Posts subscription status:', status)
        setSubscriptionStatus(prev => ({ ...prev, globalPosts: status }))
      })

    // Global votes subscription
    const globalVotesSubscription = supabase
      .channel('global_votes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes'
        },
        async (payload) => {
          logger.debug('Global Votes change received:', payload)
          setTimeout(async () => {
            logger.debug('Global vote change: Reloading posts...')
            
            // Don't process votes during preparation mode
            if (preparationMode) {
              logger.debug('Ignoring vote during preparation mode')
              return
            }
            
            // Get round_id from the post that was voted on
            if (payload.new && typeof payload.new === 'object' && 'post_id' in payload.new) {
              try {
                const { data: postData } = await supabase
                  .from('posts')
                  .select('round_id')
                  .eq('id', (payload.new as any).post_id)
                  .single()
                
                if (postData?.round_id) {
                  logger.debug('Found round_id from voted post:', postData.round_id)
                  
                  // Set current round if not set, then load posts
                  if (!currentRoundId) {
                    logger.debug('No current round, setting from voted post and loading')
                    setCurrentRoundId(postData.round_id)
                  }
                  
                  // Always load posts for the voted post's round
                  logger.debug('Loading posts for voted post round')
                  loadPosts(postData.round_id)
                  return
                }
              } catch (error) {
                logger.debug('Could not get round_id from post:', error)
              }
            }
            
            if (currentRoundId && !preparationMode) {
              loadPosts()
            } else {
              logger.debug('No currentRoundId for vote change or in preparation mode - skipping vote update')
            }
          }, 300)
        }
      )
      .subscribe((status) => {
        logger.debug('Global Votes subscription status:', status)
        setSubscriptionStatus(prev => ({ ...prev, globalVotes: status }))
      })

    // Global leaderboard subscription
    const globalLeaderboardSubscription = supabase
      .channel('global_leaderboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leaderboard'
        },
        async (payload) => {
          logger.debug('Global Leaderboard change received:', payload)
          setTimeout(async () => {
            logger.debug('Global leaderboard change: Reloading leaderboard...')
            
            // Don't process leaderboard during preparation mode
            if (preparationMode) {
              logger.debug('Ignoring leaderboard during preparation mode')
              return
            }
            
            // Reload leaderboard
            await loadLeaderboard()
          }, 300)
        }
      )
      .subscribe((status) => {
        logger.debug('Global Leaderboard subscription status:', status)
        setSubscriptionStatus(prev => ({ ...prev, leaderboard: status }))
      })

    // Global rounds subscription - to sync winner updates
    const globalRoundsSubscription = supabase
      .channel('global_rounds')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rounds'
        },
        async (payload) => {
          logger.debug('Global Rounds change received:', payload)
          
          // Check if winner_id was updated
          if (payload.new && typeof payload.new === 'object' && 'winner_id' in payload.new) {
            const newRound = payload.new as any
            
            // If this is the current round and winner was set
            if (currentRoundId === newRound.id && newRound.winner_id) {
              logger.debug('Winner update received for current round')
              
              // Load winner from database
              const winner = await loadWinnerFromDatabase(newRound.id)
              if (winner) {
                setWinnerPost(winner)
                logger.debug('Winner synchronized:', winner.author)
              }
            }
          }
        }
      )
      .subscribe((status) => {
        logger.debug('Global Rounds subscription status:', status)
        setSubscriptionStatus(prev => ({ ...prev, rounds: status }))
      })

    // Cleanup
    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
      supabase.removeChannel(globalPostsSubscription)
      supabase.removeChannel(globalVotesSubscription)
      supabase.removeChannel(globalLeaderboardSubscription)
      supabase.removeChannel(globalRoundsSubscription)
    }
  }, [])

  // User presence tracking
  useEffect(() => {
    if (!connected || !publicKey) return

    const userKey = publicKey.toString()
    logger.debug('Setting up presence for user:', userKey)

    // Join presence channel with throttling
    const presenceChannel = supabase.channel('online_users', {
      config: {
        presence: {
          key: userKey,
        },
        broadcast: { self: false }, // Don't receive our own broadcasts
        postgres_changes: { enabled: false }, // Disable if not needed for presence
      },
    })

    // Throttle presence updates
    let presenceTimeout: NodeJS.Timeout | null = null
    const throttledPresenceUpdate = () => {
      if (presenceTimeout) clearTimeout(presenceTimeout)
      presenceTimeout = setTimeout(() => {
        const newState = presenceChannel.presenceState()
        const users = Object.keys(newState).length
        logger.debug('Online users:', users)
        setOnlineUsers(users)
        setConnectionStatus('online')
      }, 500) // 500ms throttle
    }

    presenceChannel
      .on('presence', { event: 'sync' }, throttledPresenceUpdate)
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        logger.debug(' User joined:', key)
        throttledPresenceUpdate()
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        logger.debug('User left:', key)
        throttledPresenceUpdate()
      })
      .subscribe(async (status) => {
        logger.debug('Presence subscription status:', status)
        setSubscriptionStatus(prev => ({ ...prev, presence: status }))
        
        if (status !== 'SUBSCRIBED') return
        
        const presenceTrackStatus = await presenceChannel.track({
          user: userKey,
          online_at: new Date().toISOString(),
        })
        logger.debug('Presence track status:', presenceTrackStatus)
      })

    return () => {
      if (presenceTimeout) clearTimeout(presenceTimeout)
      presenceChannel.unsubscribe()
    }
  }, [connected, publicKey])

  // Load posts when round changes
  useEffect(() => {
    if (currentRoundId) {
      loadPosts()
    }
  }, [currentRoundId, connected, publicKey])

  const handleSubmitPost = async (content: string) => {
    if (!connected || !publicKey || submittingPost) {
      return
    }

    setSubmittingPost(true)

    try {
      // If no current round, try to get one first
      if (!currentRoundId) {
        logger.debug('No current round for post submission, getting round first...')
        await getCurrentRound()
        
        // Check again after getting round
        if (!currentRoundId) {
          alert('Could not determine current round. Please try again.')
          return
        }
      }

      // Check client-side preparation mode
      if (preparationMode) {
        alert('Cannot submit posts during preparation phase!')
        return
      }

      // Call API route
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          walletAddress: publicKey.toString(),
          roundId: currentRoundId
        })
      })

      const result = await response.json()

      if (!response.ok) {
        if (response.status === 429) {
          alert('Rate limit exceeded: Maximum 1 post per round per IP address')
        } else {
          alert(result.error || 'Failed to submit post. Please try again.')
        }
        return
      }

      // Reload posts on success
      await loadPosts()
    } catch (error) {
      logger.error('Error submitting post:', error)
      alert('Failed to submit post. Please try again.')
    } finally {
      setSubmittingPost(false)
    }
  }

  const handleVote = async (postId: string, voteType: 'upvote' | 'downvote') => {
    if (!connected || !publicKey || votingPosts.has(postId)) return

    // Check if user is trying to vote on their own post
    const post = posts.find(p => p.id === postId)
    if (post && post.author === publicKey.toString()) {
      alert('You cannot vote on your own post!')
      return
    }

    // Add to voting posts set
    setVotingPosts(prev => new Set([...prev, postId]))

    try {
      // Check if we're in preparation mode first
      if (preparationMode) {
        alert('Cannot vote during preparation phase!')
        return
      }

      if (!currentRoundId) {
        alert('No active round found. Please refresh the page.')
        return
      }

      // Call API route
      const response = await fetch('/api/votes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId,
          walletAddress: publicKey.toString(),
          voteType,
          roundId: currentRoundId
        })
      })

      const result = await response.json()

      if (!response.ok) {
        if (response.status === 429) {
          alert('Rate limit exceeded: Maximum 5 votes per round per IP address')
        } else {
          alert(result.error || 'Failed to vote. Please try again.')
        }
        return
      }

      // Reload posts on success
      await loadPosts()
    } catch (error) {
      logger.error('Error voting:', error)
      alert('Failed to vote. Please try again.')
    } finally {
      // Remove from voting posts set
      setVotingPosts(prev => {
        const newSet = new Set(prev)
        newSet.delete(postId)
        return newSet
      })
    }
  }

  const handleTimeUp = async () => {
    if (!currentRoundId) return

    try {
      logger.debug('Round', roundNumber, 'ending, starting preparation...')
      
      // Start preparation mode immediately
      setPreparationMode(true)
      const prepEnd = new Date(Date.now() + 30 * 1000) // 30 seconds preparation
      setPreparationEnd(prepEnd)
      
      // Clear posts immediately to prevent confusion
      setPosts([])
      
      // DON'T mark current round as inactive yet - keep it active during preparation
      // This ensures that if user refreshes during preparation, they still can't post
      
      // SERVER-SIDE winner determination - this ensures all clients see the same winner
      const winner = await determineRoundWinner(currentRoundId)
      
      if (winner) {
        setWinnerPost(winner)
        
        // Add winner to leaderboard automatically
        try {
          logger.debug('Adding winner to leaderboard:', winner.author, winner.id)
          
          // Get winner's user ID
          const { data: winnerUser, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('wallet_address', winner.author)
            .single()

          if (userError) {
            logger.error('Error finding winner user:', userError)
            logger.error('Searched for wallet:', winner.author)
            logger.error('Winner post details:', JSON.stringify(winner))
            
            // Check if any users exist in database
            const { data: allUsers, error: allUsersError } = await supabase
              .from('users')
              .select('wallet_address')
              .limit(10)
            
            if (!allUsersError) {
              logger.debug('Sample users in database:', allUsers?.map(u => u.wallet_address).slice(0, 3))
            }
            
            // Continue without adding to leaderboard rather than crashing
            logger.warn('Skipping leaderboard entry due to missing user')
          } else if (!winnerUser?.id) {
            logger.error('Winner user not found for wallet:', winner.author)
            logger.error('Winner post details:', JSON.stringify(winner))
          } else {
            logger.debug('Found winner user ID:', winnerUser.id)

            // Check if this post is already in leaderboard (prevent duplicates)
            const { data: existingEntry, error: checkError } = await supabase
              .from('leaderboard')
              .select('id')
              .eq('post_id', winner.id)
              .maybeSingle()

            if (checkError) {
              logger.error('Error checking existing leaderboard entry:', checkError)
            } else if (existingEntry) {
              logger.debug('Winner already exists in leaderboard:', existingEntry.id)
            } else {
              // Add to leaderboard with correct column name: winner_id
              logger.debug('Inserting to leaderboard...')
              const insertData = {
                winner_id: winnerUser.id, // Changed from user_id to winner_id
                post_id: winner.id,
                amount: 0,
                transaction_hash: ''
              }
              
              logger.debug('Insert data:', JSON.stringify(insertData))

              const { data: newEntry, error: leaderboardError } = await supabase
                .from('leaderboard')
                .insert(insertData)
                .select()
                .single()

              if (leaderboardError) {
                // Check if this is a duplicate key error (race condition with other clients)
                if (leaderboardError.code === '23505') {
                  logger.debug('Winner already added to leaderboard by another client (race condition resolved)')
                } else {
                  logger.error('Error adding winner to leaderboard:', JSON.stringify(leaderboardError))
                  logger.error('Insert data was:', JSON.stringify(insertData))
                }
              } else {
                logger.info('Winner added to leaderboard successfully:', newEntry?.id)
              }
            }
          }
        } catch (error) {
          logger.error('Exception in winner processing:', error)
        }
      }
      
      // Wait for preparation period to end
      setTimeout(async () => {
        logger.debug('Preparation complete, starting round', roundNumber + 1)
        setPreparationMode(false)
        setPreparationEnd(null)
        
        // NOW mark the round as server ended and create next round
        await supabase
          .from('rounds')
          .update({ server_ended: true, is_active: false })
          .eq('id', currentRoundId)
        
        // Start new round
        await getCurrentRound()
        
        // Reload leaderboard to show new winner
        await loadLeaderboard()
      }, 30 * 1000) // 30 seconds preparation time
      
    } catch (error) {
      logger.error('Error handling round end:', error)
    }
  }

  const handlePreparationTimeUp = () => {
    // This is handled by the setTimeout in handleTimeUp
    logger.debug('Preparation phase ended')
  }

  // Server-side winner determination
  const determineRoundWinner = async (roundId: string) => {
    try {
      logger.debug('Determining winner for round:', roundId)
      
      // Get all posts for this round with their current vote counts
      const { data: postsData, error } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          upvotes,
          downvotes,
          created_at,
          user_id,
          users!inner(wallet_address)
        `)
        .eq('round_id', roundId)
        .order('created_at', { ascending: false })

      if (error || !postsData || postsData.length === 0) {
        logger.debug('No posts found for round:', roundId)
        return null
      }

      // Calculate net scores and find winner
      const postsWithScores = postsData.map(post => ({
        ...post,
        netScore: post.upvotes - post.downvotes
      }))

      // Sort by net score (highest first), then by creation time (oldest first for tiebreaker)
      const sortedPosts = postsWithScores.sort((a, b) => {
        if (a.netScore !== b.netScore) {
          return b.netScore - a.netScore // Higher score wins
        }
        // If scores are equal, older post wins (first to achieve the score)
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })

      const winnerPost = sortedPosts[0]
      logger.debug('Winner determined:', winnerPost.id, 'with score:', winnerPost.netScore)

      // Update round with winner_id (user_id, not post_id)
      const { error: updateError } = await supabase
        .from('rounds')
        .update({ winner_id: winnerPost.user_id })
        .eq('id', roundId)

      if (updateError) {
        logger.error('Error updating round with winner:', updateError)
        return null
      }

      // Return winner post in the format expected by UI
      return {
        id: winnerPost.id,
        content: winnerPost.content,
        author: (winnerPost.users as any).wallet_address,
        upvotes: winnerPost.upvotes,
        downvotes: winnerPost.downvotes,
        createdAt: winnerPost.created_at,
        userVote: null
      }
    } catch (error) {
      logger.error('Error determining round winner:', error)
      return null
    }
  }

  // Load winner from database
  const loadWinnerFromDatabase = async (roundId: string) => {
    try {
      const { data: roundData, error: roundError } = await supabase
        .from('rounds')
        .select('winner_id')
        .eq('id', roundId)
        .single()

      if (roundError || !roundData?.winner_id) {
        return null
      }

      // Get winner post details using user_id from winner_id
      const { data: winnerData, error: winnerError } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          upvotes,
          downvotes,
          created_at,
          users!inner(wallet_address)
        `)
        .eq('user_id', roundData.winner_id)
        .eq('round_id', roundId)
        .single()

      if (winnerError || !winnerData) {
        return null
      }

      return {
        id: winnerData.id,
        content: winnerData.content,
        author: (winnerData.users as any).wallet_address,
        upvotes: winnerData.upvotes,
        downvotes: winnerData.downvotes,
        createdAt: winnerData.created_at,
        userVote: null
      }
    } catch (error) {
      logger.error('Error loading winner from database:', error)
      return null
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <Header onlineUsers={onlineUsers} connectionStatus={connectionStatus} />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-[var(--foreground)]">Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <Header onlineUsers={onlineUsers} connectionStatus={connectionStatus} />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex-1">
        {/* Winner Display */}
        {winnerPost && (
          <div className="mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-3 sm:mb-4 text-[var(--foreground)]">
              🏆 Last Round Winner
            </h2>
            <div className="max-w-2xl mx-auto">
              <PostCard
                {...winnerPost}
                isWinner
                onVote={() => {}}
                rank={1}
              />
            </div>
          </div>
        )}

        {/* Post Submit */}
        <PostSubmit 
          onSubmit={handleSubmitPost} 
          preparationMode={preparationMode}
          loading={submittingPost}
        />

        {/* Preparation Message */}
        {preparationMode && (
          <div className="max-w-2xl mx-auto mb-6 sm:mb-8 p-4 sm:p-6 bg-orange-100 dark:bg-orange-900 border border-orange-300 dark:border-orange-700 rounded-lg text-center">
            <h3 className="text-base sm:text-lg font-semibold text-orange-800 dark:text-orange-200 mb-2">
              🔄 Preparing Next Round...
            </h3>
            <p className="text-sm sm:text-base text-orange-700 dark:text-orange-300">
              Results are being processed. New round starts soon!
            </p>
            {preparationEnd && (
              <div className="mt-3">
                <CountdownTimer 
                  endTime={preparationEnd} 
                  onTimeUp={handlePreparationTimeUp}
                  label="Next round in"
                />
              </div>
            )}
          </div>
        )}

        {/* Countdown Timer */}
        {!preparationMode && (
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center gap-2 sm:gap-3 bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 sm:px-6 py-2 sm:py-3">
              <div className="text-xs sm:text-sm text-[var(--muted-foreground)]">
                Round #{roundNumber}
              </div>
              <div className="w-px h-4 sm:h-6 bg-[var(--border)]"></div>
              <CountdownTimer 
                endTime={currentRoundEnd} 
                onTimeUp={handleTimeUp}
                label="Time remaining"
              />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-4 sm:mb-6">
          <div className="flex space-x-1 bg-[var(--muted)] p-1 rounded-lg max-w-md mx-auto">
            <button
              onClick={() => setActiveTab('posts')}
              className={`flex-1 py-2 px-2 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'posts'
                  ? 'bg-[var(--card)] text-[var(--card-foreground)] shadow-sm'
                  : 'text-[var(--foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              <span className="hidden xs:inline">Posts</span>
              <span className="xs:hidden">Posts</span>
              <span className="ml-1">({posts.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex-1 py-2 px-2 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'leaderboard'
                  ? 'bg-[var(--card)] text-[var(--card-foreground)] shadow-sm'
                  : 'text-[var(--foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              <span className="hidden xs:inline">Past Winners</span>
              <span className="xs:hidden">Winners</span>
              <span className="ml-1">({leaderboard.length})</span>
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'posts' ? (
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, index) => (
              <PostCard
                key={post.id}
                {...post}
                onVote={handleVote}
                isVoting={votingPosts.has(post.id)}
                rank={index + 1}
              />
            ))}
            {posts.length === 0 && (
              <div className="col-span-full text-center py-8 sm:py-12 text-[var(--foreground)]">
                <p className="text-lg sm:text-xl mb-2">No posts yet!</p>
                <p className="text-sm sm:text-base text-gray-500">Be the first to submit a convincing post.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4 max-w-4xl mx-auto">
            {leaderboard.map((entry, index) => {
              const isCompleted = entry.amount > 0 && entry.transactionHash
               
              return (
                <div
                  key={entry.id}
                  className="p-4 sm:p-6 bg-[var(--card)] border border-[var(--border)] rounded-lg"
                >
                  {/* Rank Badge */}
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full flex items-center justify-center font-bold text-sm sm:text-lg">
                      #{index + 1}
                    </div>
                    
                    <div className="flex-1 space-y-3 sm:space-y-4 min-w-0">
                      {/* Post Content */}
                      <div className="bg-[var(--accent)] p-3 sm:p-4 rounded-lg">
                        <p className="text-[var(--card-foreground)] text-sm sm:text-lg leading-relaxed mb-2 sm:mb-3">
                          "{entry.post}"
                        </p>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          <span>by {entry.winner.slice(0, 3)}...{entry.winner.slice(-3)}</span>
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-green-600">↑{entry.upvotes}</span>
                              <span className="text-red-600">↓{entry.downvotes}</span>
                              <span className="font-semibold text-[var(--foreground)]">
                                Net: +{entry.upvotes - entry.downvotes}
                              </span>
                            </div>
                            <span className="hidden sm:inline">{new Date(entry.createdAt).toLocaleDateString()}</span>
                            <span className="sm:hidden">{new Date(entry.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Status and Reward Info */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          {isCompleted ? (
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <span className="text-green-600 dark:text-green-400 font-medium text-sm">
                                  Reward Sent
                                </span>
                              </div>
                              <span className="font-bold text-[var(--primary)] text-base sm:text-lg">
                                {entry.amount} SOL
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                              <span className="text-yellow-600 dark:text-yellow-400 font-medium text-sm">
                                Under review for reward...
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {isCompleted && entry.transactionHash && (
                          <a
                            href={`https://explorer.solana.com/tx/${entry.transactionHash}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs sm:text-sm"
                          >
                            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            <span className="hidden sm:inline">View Transaction</span>
                            <span className="sm:hidden">View TX</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            {leaderboard.length === 0 && (
              <div className="text-center py-8 sm:py-12 text-[var(--foreground)]">
                <p className="text-lg sm:text-xl mb-2">No past winners yet!</p>
                <p className="text-sm sm:text-base text-gray-500">Be the first to win a round.</p>
              </div>
            )}
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  )
}