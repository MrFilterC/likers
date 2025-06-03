import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { rateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { monitorAsyncOperation } from '@/lib/monitoring'

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
    }, 'create-user')

    // Check existing post and create new post in parallel
    const [existingPostCheck, newPost] = await Promise.all([
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

    // Handle existing post conflict
    if (existingPostCheck.data) {
      return NextResponse.json(
        { error: 'You can only submit one post per round' },
        { status: 400 }
      )
    }

    // Handle post creation error
    if (newPost.error) {
      if (newPost.error.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { error: 'You can only submit one post per round' },
          { status: 400 }
        )
      }
      console.error('Post creation error:', newPost.error)
      return NextResponse.json(
        { error: 'Failed to create post' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ 
      success: true, 
      post: newPost.data,
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