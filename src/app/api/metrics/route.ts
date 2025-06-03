import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { PerformanceMonitor } from '@/lib/monitoring'

export async function GET() {
  try {
    const monitor = PerformanceMonitor.getInstance()
    
    // Get database stats
    const [
      { count: totalUsers },
      { count: totalPosts },
      { count: totalVotes },
      { data: activeRound }
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('posts').select('*', { count: 'exact', head: true }),
      supabase.from('votes').select('*', { count: 'exact', head: true }),
      supabase.from('rounds').select('*').eq('is_active', true).single()
    ])

    // Get current round stats if active
    let roundStats = null
    if (activeRound) {
      const [
        { count: roundPosts },
        { count: roundVotes }
      ] = await Promise.all([
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('round_id', activeRound.id),
        supabase.from('votes').select('*', { count: 'exact', head: true }).eq('round_id', activeRound.id)
      ])

      roundStats = {
        round_id: activeRound.id,
        posts: roundPosts || 0,
        votes: roundVotes || 0,
        created_at: activeRound.created_at,
        ends_at: activeRound.ends_at
      }
    }

    // System metrics
    const systemMetrics = {
      memory: process.memoryUsage ? {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
      } : null,
      uptime: process.uptime ? Math.round(process.uptime()) + 's' : null,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json({
      database: {
        total_users: totalUsers || 0,
        total_posts: totalPosts || 0,
        total_votes: totalVotes || 0
      },
      current_round: roundStats,
      performance: monitor.getMetricsSummary(),
      system: systemMetrics,
      status: 'healthy'
    })

  } catch (error) {
    console.error('Metrics error:', error)
    
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Failed to fetch metrics',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 