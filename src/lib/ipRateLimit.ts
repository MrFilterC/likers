interface IPActivity {
  posts: number;
  votes: number;
  timestamp: number; // Add timestamp for cleanup
}

// In-memory store for IP rate limiting (resets on server restart)
// In production, this should be moved to Redis or database
const ipStore = new Map<string, Map<string, IPActivity>>();

// Cleanup old entries to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_AGE = 60 * 60 * 1000; // 1 hour

setInterval(() => {
  const now = Date.now();
  for (const [roundId, roundStore] of ipStore) {
    for (const [ip, activity] of roundStore) {
      if (now - activity.timestamp > MAX_AGE) {
        roundStore.delete(ip);
      }
    }
    if (roundStore.size === 0) {
      ipStore.delete(roundId);
    }
  }
}, CLEANUP_INTERVAL);

export function getClientIP(request: Request): string {
  // Try to get real IP from headers (for production with proxies)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare
  
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  // Fallback (won't work in production behind proxy)
  return 'unknown';
}

export function checkPostLimit(ip: string, roundId: string): boolean {
  if (!ipStore.has(roundId)) {
    ipStore.set(roundId, new Map());
  }
  
  const roundStore = ipStore.get(roundId)!;
  const activity = roundStore.get(ip) || { posts: 0, votes: 0, timestamp: Date.now() };
  
  return activity.posts < 1; // Max 1 post per round per IP
}

export function checkVoteLimit(ip: string, roundId: string): boolean {
  if (!ipStore.has(roundId)) {
    ipStore.set(roundId, new Map());
  }
  
  const roundStore = ipStore.get(roundId)!;
  const activity = roundStore.get(ip) || { posts: 0, votes: 0, timestamp: Date.now() };
  
  return activity.votes < 10; // Increased from 5 to 10 for high activity
}

export function recordPost(ip: string, roundId: string): void {
  if (!ipStore.has(roundId)) {
    ipStore.set(roundId, new Map());
  }
  
  const roundStore = ipStore.get(roundId)!;
  const activity = roundStore.get(ip) || { posts: 0, votes: 0, timestamp: Date.now() };
  activity.posts += 1;
  activity.timestamp = Date.now();
  roundStore.set(ip, activity);
}

export function recordVote(ip: string, roundId: string): void {
  if (!ipStore.has(roundId)) {
    ipStore.set(roundId, new Map());
  }
  
  const roundStore = ipStore.get(roundId)!;
  const activity = roundStore.get(ip) || { posts: 0, votes: 0, timestamp: Date.now() };
  activity.votes += 1;
  activity.timestamp = Date.now();
  roundStore.set(ip, activity);
}

// Clean up old rounds (call this periodically)
export function cleanupOldRounds(activeRoundIds: string[]): void {
  for (const [roundId] of ipStore) {
    if (!activeRoundIds.includes(roundId)) {
      ipStore.delete(roundId);
    }
  }
} 