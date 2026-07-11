"use client"

import { useEffect, useState } from "react"
import { useMotionValue, useSpring, useTransform } from "framer-motion"

interface AnimatedNumberProps {
  value: number
  decimals?: number
  suffix?: string
  prefix?: string
  className?: string
}

export function AnimatedNumber({ value, decimals = 2, suffix = "", prefix = "", className = "" }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState("0")
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { stiffness: 50, damping: 15 })
  const display = useTransform(spring, (v) => `${prefix}${v.toFixed(decimals)}${suffix}`)

  useEffect(() => {
    motionValue.set(value)
  }, [value, motionValue])

  useEffect(() => {
    const unsubscribe = display.on("change", (v) => setDisplayValue(v))
    return () => unsubscribe()
  }, [display])

  return <span className={className}>{displayValue}</span>
}
