import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { gameMode } = await request.json()
    
    if (!gameMode) {
      return NextResponse.json({ error: 'Game mode is required' }, { status: 400 })
    }

    // Get last round number for this game mode
    const { data: lastRound } = await supabase
      .from('rounds')
      .select('round_number')
      .eq('game_mode', gameMode)
      .order('round_number', { ascending: false })
      .limit(1)
      .single()
    
    const nextRoundNumber = lastRound ? lastRound.round_number + 1 : 1
    
    // Set round duration based on game mode
    const startTime = new Date()
    let endTime: Date
    let durationMinutes: number
    let roundIdPrefix: string

    switch (gameMode) {
      case 'creator_fee':
        endTime = new Date(startTime.getTime() + 60 * 1000) // 60 seconds
        durationMinutes = 1
        roundIdPrefix = 'creator_fee_round'
        break
      case 'likers_rewards':
        endTime = new Date(startTime.getTime() + 30 * 60 * 1000) // 30 minutes
        durationMinutes = 30
        roundIdPrefix = 'likers_round'
        break
      case 'promotion_rewards':
        endTime = new Date(startTime.getTime() + 3 * 60 * 60 * 1000) // 3 hours
        durationMinutes = 180
        roundIdPrefix = 'promotion_round'
        break
      default:
        return NextResponse.json({ error: 'Invalid game mode' }, { status: 400 })
    }

    // Mark any existing active rounds as ended for this game mode
    await supabase
      .from('rounds')
      .update({ 
        is_active: false, 
        server_ended: true 
      })
      .eq('game_mode', gameMode)
      .eq('is_active', true)

    // Create new round
    const { data: newRound, error: createError } = await supabase
      .from('rounds')
      .insert({
        id: `${roundIdPrefix}-${nextRoundNumber}`,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        is_active: true,
        round_number: nextRoundNumber,
        game_mode: gameMode,
        duration_minutes: durationMinutes,
        server_ended: false
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating round:', createError)
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Round created successfully',
      round: newRound
    })

  } catch (error) {
    console.error('Error in manual round creation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 