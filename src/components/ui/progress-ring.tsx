"use client"

import { useEffect } from "react"
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion"

interface ProgressRingProps {
  value: number
  size?: number
  strokeWidth?: number
  color?: string
  label?: string
  suffix?: string
}

export function ProgressRing({
  value, size = 64, strokeWidth = 6,
  color = "#10b981", suffix = "%"
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = useMotionValue(0)
  const springProgress = useSpring(progress, { stiffness: 60, damping: 15 })
  const strokeDashoffset = useTransform(
    springProgress,
    [0, 100],
    [circumference, 0]
  )

  useEffect(() => {
    progress.set(value)
  }, [value, progress])

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="var(--skeleton-base)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset }}
        />
      </svg>
      
    </div>
  )
}
