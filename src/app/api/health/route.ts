import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Log environment variables (safely)
    console.log('🔍 Environment Check:', {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
      nodeEnv: process.env.NODE_ENV
    })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Environment variables missing',
          supabaseUrl: supabaseUrl ? 'SET' : 'MISSING',
          supabaseKey: supabaseKey ? 'SET' : 'MISSING'
        },
        { status: 500 }
      )
    }

    // Test direct HTTP connection to Supabase
    const response = await fetch(`${supabaseUrl}/rest/v1/rounds?select=id&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    })

    console.log('🌐 Direct fetch response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Supabase HTTP Error:', errorText)
      
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Direct HTTP connection failed',
          httpStatus: response.status,
          httpStatusText: response.statusText,
          error: errorText
        },
        { status: 500 }
      )
    }

    const data = await response.json()
    console.log('✅ Direct HTTP connection successful:', data)

    // Test successful
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      uptime: process.uptime(),
      connectionType: 'direct-http',
      data: data
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