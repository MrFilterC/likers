import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Simple database test
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1)

    if (error) {
      console.error('Health check database error:', error)
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Database connection failed',
          error: error.message 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      uptime: process.uptime ? Math.round(process.uptime()) : 'unknown'
    })

  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 