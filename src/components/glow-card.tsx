"use client"

import { motion } from "framer-motion"
import type { ReactNode } from "react"

interface GlowCardProps {
  children: ReactNode
  className?: string
  glow?: "emerald" | "cyan" | "none"
  onClick?: () => void
  delay?: number
}

export function GlowCard({ children, className = "", glow = "none", onClick, delay = 0 }: GlowCardProps) {
  const glowClass = glow === "emerald" ? "glow-emerald" : glow === "cyan" ? "glow-cyan" : ""
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -3 }}
      onClick={onClick}
      className={`glass rounded-xl p-5 transition-all ${glowClass} ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {children}
    </motion.div>
  )
}
