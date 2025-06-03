import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkVoteLimit, recordVote, getClientIP } from '@/lib/ipRateLimit'

export async function POST(request: NextRequest) {
  try {
    const { postId, walletAddress, voteType, roundId } = await request.json()
    
    // Get client IP
    const clientIP = getClientIP(request)
    
    // Check IP rate limit
    if (!checkVoteLimit(clientIP, roundId)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded: Maximum 5 votes per round per IP address' },
        { status: 429 }
      )
    }
    
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
    
    // Get user ID and post data in parallel for better performance
    const [userResult, postResult] = await Promise.all([
      supabase
        .from('users')
        .select('id')
        .eq('wallet_address', walletAddress)
        .single(),
      supabase
        .from('posts')
        .select('round_id, user_id')
        .eq('id', postId)
        .single()
    ])

    if (!userResult.data) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (!postResult.data) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }
    
    const userData = userResult.data
    const postData = postResult.data
    
    if (postData.round_id !== roundId) {
      return NextResponse.json(
        { error: 'You can only vote on posts from the current round' },
        { status: 400 }
      )
    }
    
    // Check if user is trying to vote on their own post
    if (postData.user_id === userData.id) {
      return NextResponse.json(
        { error: 'You cannot vote on your own post' },
        { status: 400 }
      )
    }
    
    // Check existing vote
    const { data: existingVote } = await supabase
      .from('votes')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', userData.id)
      .maybeSingle() // Use maybeSingle instead of single to handle no results gracefully

    let isNewVote = false
    
    if (existingVote) {
      if (existingVote.vote_type === voteType) {
        // Remove vote
        const { error: deleteError } = await supabase
          .from('votes')
          .delete()
          .eq('id', existingVote.id)
          
        if (deleteError) {
          return NextResponse.json(
            { error: 'Failed to remove vote' },
            { status: 500 }
          )
        }
      } else {
        // Update vote
        const { error: updateError } = await supabase
          .from('votes')
          .update({ vote_type: voteType })
          .eq('id', existingVote.id)
          
        if (updateError) {
          return NextResponse.json(
            { error: 'Failed to update vote' },
            { status: 500 }
          )
        }
      }
    } else {
      // Create new vote
      const { error: insertError } = await supabase
        .from('votes')
        .insert({
          post_id: postId,
          user_id: userData.id,
          vote_type: voteType
        })
        
      if (insertError) {
        return NextResponse.json(
          { error: 'Failed to create vote' },
          { status: 500 }
        )
      }
      
      isNewVote = true
    }
    
    // Record IP activity only for new votes (not updates/removals)
    if (isNewVote) {
      recordVote(clientIP, roundId)
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Vote error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 