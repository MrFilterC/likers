// Production monitoring utilities
export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: Map<string, number[]> = new Map()

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  // Track API response times
  trackResponseTime(endpoint: string, duration: number) {
    if (!this.metrics.has(endpoint)) {
      this.metrics.set(endpoint, [])
    }
    
    const times = this.metrics.get(endpoint)!
    times.push(duration)
    
    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift()
    }
  }

  // Get average response time
  getAverageResponseTime(endpoint: string): number {
    const times = this.metrics.get(endpoint) || []
    if (times.length === 0) return 0
    
    return times.reduce((sum, time) => sum + time, 0) / times.length
  }

  // Log slow queries (>1000ms)
  logSlowQuery(query: string, duration: number, params?: any) {
    if (duration > 1000) {
      console.warn(`🐌 SLOW QUERY (${duration}ms):`, {
        query,
        duration,
        params,
        timestamp: new Date().toISOString()
      })
    }
  }

  // Log high memory usage
  checkMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      const usedMB = Math.round(usage.heapUsed / 1024 / 1024)
      
      if (usedMB > 500) { // Alert if >500MB
        console.warn(`🔥 HIGH MEMORY USAGE: ${usedMB}MB`, usage)
      }
    }
  }

  // Get metrics summary
  getMetricsSummary() {
    const summary: Record<string, any> = {}
    
    for (const [endpoint, times] of this.metrics.entries()) {
      if (times.length > 0) {
        const avg = this.getAverageResponseTime(endpoint)
        const max = Math.max(...times)
        const min = Math.min(...times)
        
        summary[endpoint] = {
          averageMs: Math.round(avg),
          maxMs: max,
          minMs: min,
          totalRequests: times.length
        }
      }
    }
    
    return summary
  }
}

// Async wrapper with monitoring
export async function monitorAsyncOperation<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  const start = Date.now()
  const monitor = PerformanceMonitor.getInstance()
  
  try {
    const result = await operation()
    const duration = Date.now() - start
    
    monitor.trackResponseTime(operationName, duration)
    monitor.logSlowQuery(operationName, duration)
    
    return result
  } catch (error) {
    const duration = Date.now() - start
    console.error(`❌ OPERATION FAILED (${duration}ms):`, {
      operation: operationName,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration
    })
    throw error
  } finally {
    // Check memory after each operation
    monitor.checkMemoryUsage()
  }
} 