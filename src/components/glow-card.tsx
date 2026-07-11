"use client"

import { motion } from "framer-motion"
import type { ReactNode } from "react"

interface GlowCardProps {
  children: ReactNode
  className?: string
  glow?: "emerald" | "cyan" | "none"
  onClick?: () => void
}

export function GlowCard({ children, className = "", glow = "none", onClick }: GlowCardProps) {
  const glowClass = glow === "emerald" ? "glow-emerald" : glow === "cyan" ? "glow-cyan" : ""
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={`glass rounded-xl p-5 transition-all ${glowClass} ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {children}
    </motion.div>
  )
}
