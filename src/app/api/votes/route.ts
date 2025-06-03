import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { rateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { monitorAsyncOperation } from '@/lib/monitoring'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const rateLimitResult = rateLimit(request, RATE_LIMITS.VOTE)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          resetTime: rateLimitResult.reset,
          remaining: rateLimitResult.remaining
        },
        { status: 429 }
      )
    }

    const { postId, walletAddress, voteType, roundId } = await request.json()
    
    // Validate input
    if (!postId || !walletAddress || !voteType || !roundId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    if (!['upvote', 'downvote'].includes(voteType)) {
      return NextResponse.json(
        { error: 'Invalid vote type' },
        { status: 400 }
      )
    }

    // Get or create user with monitoring
    const userId = await monitorAsyncOperation(async () => {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', walletAddress)
        .single()

      if (existingUser) {
        return existingUser.id
      }

      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({ wallet_address: walletAddress })
        .select('id')
        .single()

      if (userError) {
        console.error('User creation error:', userError)
        throw new Error('Failed to create user')
      }
      
      return newUser.id
    }, 'create-user-vote')

    // Check for existing vote and create new vote in parallel
    const [existingVoteCheck, newVote] = await Promise.all([
      supabase
        .from('votes')
        .select('id, vote_type')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .single(),
      
      supabase
        .from('votes')
        .insert({
          post_id: postId,
          user_id: userId,
          vote_type: voteType,
          round_id: roundId
        })
        .select()
        .single()
    ])

    // Handle existing vote
    if (existingVoteCheck.data) {
      return NextResponse.json(
        { error: 'You have already voted on this post' },
        { status: 400 }
      )
    }

    // Handle vote creation error
    if (newVote.error) {
      if (newVote.error.code === '23505') { // Unique constraint
        return NextResponse.json(
          { error: 'You have already voted on this post' },
          { status: 400 }
        )
      }
      console.error('Vote creation error:', newVote.error)
      return NextResponse.json(
        { error: 'Failed to record vote' },
        { status: 500 }
      )
    }

    // Update post vote counts
    const updateResult = await monitorAsyncOperation(async () => {
      if (voteType === 'upvote') {
        return await supabase.rpc('increment_upvotes', { post_id: postId })
      } else {
        return await supabase.rpc('increment_downvotes', { post_id: postId })
      }
    }, 'update-vote-count')

    if (updateResult.error) {
      console.error('Vote count update error:', updateResult.error)
      // Don't fail the request, just log the error
    }
    
    return NextResponse.json({ 
      success: true, 
      vote: newVote.data,
      rateLimit: {
        remaining: rateLimitResult.remaining,
        reset: rateLimitResult.reset
      }
    })
    
  } catch (error) {
    console.error('Vote creation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
} 