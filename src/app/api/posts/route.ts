import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { rateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const rateLimitResult = rateLimit(request, RATE_LIMITS.POST)
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

    const { content, walletAddress, roundId } = await request.json()
    
    // Validate input
    if (!content || !walletAddress || !roundId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    if (content.length > 140) {
      return NextResponse.json(
        { error: 'Content too long (max 140 characters)' },
        { status: 400 }
      )
    }

    // Get or create user - simple approach
    let userId: string
    
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

    // Check existing post
    const { data: existingPost } = await supabase
      .from('posts')
      .select('id')
      .eq('user_id', userId)
      .eq('round_id', roundId)
      .single()

    if (existingPost) {
      return NextResponse.json(
        { error: 'You can only submit one post per round' },
        { status: 400 }
      )
    }

    // Create post
    const { data: newPost, error: postError } = await supabase
      .from('posts')
      .insert({
        content,
        user_id: userId,
        round_id: roundId
      })
      .select()
      .single()

    if (postError) {
      console.error('Post creation error:', postError)
      if (postError.code === '23505') {
        return NextResponse.json(
          { error: 'You can only submit one post per round' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to create post: ' + postError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ 
      success: true, 
      post: newPost,
      rateLimit: {
        remaining: rateLimitResult.remaining,
        reset: rateLimitResult.reset
      }
    })
    
  } catch (error) {
    console.error('Post creation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
} 