import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Log environment variables (safely)
    console.log('🔍 Environment Check:', {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
      nodeEnv: process.env.NODE_ENV
    })

    // Test database connection with more specific query
    const { data, error, count } = await supabase
      .from('rounds')
      .select('id', { count: 'exact' })
      .limit(1)

    if (error) {
      console.error('❌ Supabase Error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Database connection failed',
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        },
        { status: 500 }
      )
    }

    console.log('✅ Database connected successfully:', { data, count })

    // Test successful
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      uptime: process.uptime(),
      roundsCount: count || 0
    })

  } catch (error) {
    console.error('❌ Health check error:', error)
    
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
} 