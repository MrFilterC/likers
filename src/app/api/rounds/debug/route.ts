import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Get all rounds
    const { data: rounds, error } = await supabase
      .from('rounds')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get current time
    const now = new Date()

    // Check which rounds are actually expired
    const roundsWithStatus = rounds?.map(round => ({
      ...round,
      timeUntilEnd: new Date(round.end_time).getTime() - now.getTime(),
      isExpired: new Date(round.end_time) < now,
      timeSinceEnd: now.getTime() - new Date(round.end_time).getTime()
    })) || []

    return NextResponse.json({
      currentTime: now.toISOString(),
      totalRounds: rounds?.length || 0,
      rounds: roundsWithStatus
    })

  } catch (error) {
    console.error('Error in debug:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 