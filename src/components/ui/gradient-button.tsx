"use client"

import { motion } from "framer-motion"
import { Spinner } from "@phosphor-icons/react/dist/ssr"

interface GradientButtonProps {
  children: React.ReactNode
  onClick?: () => void
  loading?: boolean
  disabled?: boolean
  variant?: "emerald" | "cyan" | "red"
  size?: "sm" | "md" | "lg"
  className?: string
}

export function GradientButton({
  children, onClick, loading, disabled, variant = "emerald", size = "md", className = ""
}: GradientButtonProps) {
  const gradients = {
    emerald: "from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500",
    cyan: "from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500",
    red: "from-red-500 to-red-600 hover:from-red-400 hover:to-red-500",
  }
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  }

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.96 }}
      className={`
        flex items-center gap-2 rounded-lg bg-gradient-to-r font-medium text-white
        transition-all disabled:opacity-50
        ${gradients[variant]} ${sizes[size]} ${className}
      `}
    >
      {loading && <Spinner size={16} className="animate-spin" />}
      {children}
    </motion.button>
  )
}
