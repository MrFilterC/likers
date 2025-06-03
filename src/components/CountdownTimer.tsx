'use client'

import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

interface CountdownTimerProps {
  endTime: Date
  onTimeUp: () => void
  label?: string
}

export function CountdownTimer({ endTime, onTimeUp, label = "left in round" }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    minutes: number
    seconds: number
  }>({ minutes: 0, seconds: 0 })

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime()
      const distance = endTime.getTime() - now

      if (distance < 0) {
        setTimeLeft({ minutes: 0, seconds: 0 })
        onTimeUp()
        clearInterval(timer)
      } else {
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((distance % (1000 * 60)) / 1000)
        setTimeLeft({ minutes, seconds })
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [endTime, onTimeUp])

  const isLastMinute = timeLeft.minutes === 0

  return (
    <div className="flex items-center justify-center">
      <div className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-lg border ${
        isLastMinute 
          ? 'border-red-500 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400' 
          : 'border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)]'
      }`}>
        <Clock size={16} className="sm:w-5 sm:h-5" />
        <span className="font-mono text-lg sm:text-xl font-semibold">
          {String(timeLeft.minutes).padStart(2, '0')}:
          {String(timeLeft.seconds).padStart(2, '0')}
        </span>
        <span className="text-xs sm:text-sm">{label}</span>
      </div>
    </div>
  )
} 