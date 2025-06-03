import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkPostLimit, recordPost, getClientIP } from '@/lib/ipRateLimit'

export async function POST(request: NextRequest) {
  try {
    const { content, walletAddress, roundId } = await request.json()
    
    // Get client IP
    const clientIP = getClientIP(request)
    
    // Check IP rate limit
    if (!checkPostLimit(clientIP, roundId)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded: Maximum 1 post per round per IP address' },
        { status: 429 }
      )
    }
    
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
    
    // Get or create user
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
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 500 }
        )
      }
      userId = newUser.id
    }
    
    // Check if user already posted in this round
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
      if (postError.code === '23505') {
        return NextResponse.json(
          { error: 'You can only submit one post per round' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to create post' },
        { status: 500 }
      )
    }
    
    // Record IP activity
    recordPost(clientIP, roundId)
    
    return NextResponse.json({ success: true, post: newPost })
    
  } catch (error) {
    console.error('Post creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 