import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('=== ROUNDS RESET STARTED ===')
    
    const gameModes = ['creator_fee', 'likers_rewards', 'promotion_rewards']
    const results = []
    
    for (const gameMode of gameModes) {
      try {
        // Mark all existing rounds as ended for this game mode
        const { error: endError } = await supabase
          .from('rounds')
          .update({ 
            is_active: false, 
            server_ended: true 
          })
          .eq('game_mode', gameMode)
          .eq('is_active', true)

        if (endError) {
          console.error(`Error ending ${gameMode} rounds:`, endError)
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
        
        // Create new round
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
            throw new Error(`Unknown game mode: ${gameMode}`)
        }

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
          console.error(`Error creating ${gameMode} round:`, createError)
          results.push({
            gameMode,
            success: false,
            error: createError.message
          })
        } else {
          console.log(`Created new ${gameMode} round #${nextRoundNumber}: ${newRound.id}`)
          results.push({
            gameMode,
            success: true,
            roundId: newRound.id,
            roundNumber: nextRoundNumber
          })
        }

      } catch (error) {
        console.error(`Error processing ${gameMode}:`, error)
        results.push({
          gameMode,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log('=== ROUNDS RESET COMPLETED ===')
    return NextResponse.json({ 
      message: 'Rounds reset completed',
      results
    })

  } catch (error) {
    console.error('Error in rounds reset:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 