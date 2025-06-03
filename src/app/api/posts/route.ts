import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { rateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
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

    // Get or create user - with error handling
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

    // Parallel check for existing post and create new post for better performance
    let existingPost, newPost
    
    try {
      const [existingCheck, postCreation] = await Promise.all([
        supabase
          .from('posts')
          .select('id')
          .eq('user_id', userId)
          .eq('round_id', roundId)
          .single(),
        
        supabase
          .from('posts')
          .insert({
            content,
            user_id: userId,
            round_id: roundId
          })
          .select()
          .single()
      ])
      
      existingPost = existingCheck.data
      newPost = postCreation
      
    } catch (error) {
      console.error('Post operation error:', error)
      return NextResponse.json(
        { error: 'Database error during post operation' },
        { status: 500 }
      )
    }

    // Handle existing post conflict
    if (existingPost) {
      return NextResponse.json(
        { error: 'You can only submit one post per round' },
        { status: 400 }
      )
    }

    // Handle post creation error
    if (newPost.error) {
      console.error('Post creation error:', newPost.error)
      if (newPost.error.code === '23505') {
        return NextResponse.json(
          { error: 'You can only submit one post per round' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to create post: ' + newPost.error.message },
        { status: 500 }
      )
    }

    // Performance logging
    const duration = Date.now() - startTime
    if (duration > 1000) {
      console.warn(`🐌 SLOW POST API: ${duration}ms`, { userId, roundId })
    }
    
    return NextResponse.json({ 
      success: true, 
      post: newPost.data,
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
    console.error(`❌ POST API ERROR (${duration}ms):`, error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
} 