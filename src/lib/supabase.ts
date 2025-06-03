import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
}

if (supabaseUrl.includes('your-supabase-url') || supabaseAnonKey.includes('your-supabase-anon-key')) {
  throw new Error('Please replace placeholder values in .env.local with actual Supabase credentials.')
}

// Optimized but stable client configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  realtime: {
    params: {
      eventsPerSecond: 50 // High activity support
    }
  },
  global: {
    headers: {
      'Cache-Control': 'no-cache' // Ensure fresh data
    }
  }
})

// Performance monitoring helper
export const trackQuery = (operationName: string, startTime: number) => {
  const duration = Date.now() - startTime
  if (duration > 500) { // Log queries >500ms
    console.warn(`🐌 SLOW QUERY: ${operationName} took ${duration}ms`)
  }
  return duration
}

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          wallet_address: string
          created_at: string
        }
        Insert: {
          id?: string
          wallet_address: string
          created_at?: string
        }
        Update: {
          id?: string
          wallet_address?: string
          created_at?: string
        }
      }
      posts: {
        Row: {
          id: string
          content: string
          user_id: string
          round_id: string
          created_at: string
          upvotes: number
          downvotes: number
        }
        Insert: {
          id?: string
          content: string
          user_id: string
          round_id: string
          created_at?: string
          upvotes?: number
          downvotes?: number
        }
        Update: {
          id?: string
          content?: string
          user_id?: string
          round_id?: string
          created_at?: string
          upvotes?: number
          downvotes?: number
        }
      }
      votes: {
        Row: {
          id: string
          post_id: string
          user_id: string
          vote_type: 'upvote' | 'downvote'
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          vote_type: 'upvote' | 'downvote'
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string
          vote_type?: 'upvote' | 'downvote'
          created_at?: string
        }
      }
      rounds: {
        Row: {
          id: string
          start_time: string
          end_time: string
          winner_id: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          start_time: string
          end_time: string
          winner_id?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          start_time?: string
          end_time?: string
          winner_id?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      leaderboard: {
        Row: {
          id: string
          winner_id: string
          post_id: string
          amount: number
          transaction_hash: string
          created_at: string
        }
        Insert: {
          id?: string
          winner_id: string
          post_id: string
          amount: number
          transaction_hash: string
          created_at?: string
        }
        Update: {
          id?: string
          winner_id?: string
          post_id?: string
          amount?: number
          transaction_hash?: string
          created_at?: string
        }
      }
    }
  }
} 