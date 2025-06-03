import { NextRequest } from 'next/server'

interface RateLimitStore {
  count: number
  resetTime: number
}

// In-memory store with TTL cleanup
const rateLimitStore = new Map<string, RateLimitStore>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

function getClientIP(request: NextRequest): string {
  // Check Cloudflare headers first
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  if (cfConnectingIP) return cfConnectingIP

  // Check other proxy headers
  const xForwardedFor = request.headers.get('x-forwarded-for')
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim()
  }

  const xRealIP = request.headers.get('x-real-ip')
  if (xRealIP) return xRealIP

  // Fallback
  return 'unknown'
}

export function rateLimit(
  request: NextRequest,
  limit: number = 20, // Increased for production
  windowMs: number = 60000 // 1 minute window
): { success: boolean; reset: number; remaining: number } {
  const ip = getClientIP(request)
  const now = Date.now()
  const resetTime = now + windowMs

  // Get or create rate limit entry
  let entry = rateLimitStore.get(ip)
  
  if (!entry || now > entry.resetTime) {
    // Reset or create new entry
    entry = { count: 0, resetTime }
    rateLimitStore.set(ip, entry)
  }

  entry.count++

  const success = entry.count <= limit
  const remaining = Math.max(0, limit - entry.count)

  return {
    success,
    reset: entry.resetTime,
    remaining
  }
}

// Specialized rate limits for different endpoints
export const RATE_LIMITS = {
  VOTE: 15,        // 15 votes per minute (production users)
  POST: 10,        // 10 posts per minute
  AUTH: 5,         // 5 auth attempts per minute
  GENERAL: 50      // 50 general requests per minute
} as const 