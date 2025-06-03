import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { rateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
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

    // Get or create user - simplified
    let userId: string
    
    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', walletAddress)
        .single()

      if (existingUser) {
        userId = existingUser.id
      } else {
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({ wallet_address: walletAddress })
          .select('id')
          .single()

        if (userError) {
          console.error('User creation error:', userError)
          return NextResponse.json(
            { error: 'Failed to create user: ' + userError.message },
            { status: 500 }
          )
        }
        
        userId = newUser.id
      }
    } catch (error) {
      console.error('User lookup/creation error:', error)
      return NextResponse.json(
        { error: 'Database error during user handling' },
        { status: 500 }
      )
    }

    // Check for existing vote first
    const { data: existingVote } = await supabase
      .from('votes')
      .select('id, vote_type')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .single()

    if (existingVote) {
      return NextResponse.json(
        { error: 'You have already voted on this post' },
        { status: 400 }
      )
    }

    // Create new vote
    const { data: newVote, error: voteError } = await supabase
      .from('votes')
      .insert({
        post_id: postId,
        user_id: userId,
        vote_type: voteType,
        round_id: roundId
      })
      .select()
      .single()

    if (voteError) {
      console.error('Vote creation error:', voteError)
      if (voteError.code === '23505') { // Unique constraint
        return NextResponse.json(
          { error: 'You have already voted on this post' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to record vote: ' + voteError.message },
        { status: 500 }
      )
    }

    // Update post vote counts - simple approach
    try {
      // Get current post data first
      const { data: currentPost } = await supabase
        .from('posts')
        .select('upvotes, downvotes')
        .eq('id', postId)
        .single()
        
      if (currentPost) {
        if (voteType === 'upvote') {
          const { error: updateError } = await supabase
            .from('posts')
            .update({ 
              upvotes: currentPost.upvotes + 1 
            })
            .eq('id', postId)
            
          if (updateError) {
            console.warn('Failed to update upvote count:', updateError.message)
          }
        } else {
          const { error: updateError } = await supabase
            .from('posts')
            .update({ 
              downvotes: currentPost.downvotes + 1 
            })
            .eq('id', postId)
            
          if (updateError) {
            console.warn('Failed to update downvote count:', updateError.message)
          }
        }
      }
    } catch (error) {
      console.warn('Vote count update failed:', error)
      // Don't fail the request
    }

    // Performance logging
    const duration = Date.now() - startTime
    if (duration > 1000) {
      console.warn(`🐌 SLOW VOTE API: ${duration}ms`, { userId, postId })
    }
    
    return NextResponse.json({ 
      success: true, 
      vote: newVote,
      rateLimit: {
        remaining: rateLimitResult.remaining,
        reset: rateLimitResult.reset
      },
      performance: {
        duration: duration + 'ms'
      }
    })
    
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`❌ VOTE API ERROR (${duration}ms):`, error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
} 