"use client"

import { motion, AnimatePresence } from "framer-motion"
import { CalendarBlank, CaretDown } from "@phosphor-icons/react"
import { useState, useRef, useEffect } from "react"

interface YearSelectorProps {
  tahunTersedia: number[]
  tahun: number
  onChange: (t: number) => void
  loading: boolean
}

export function YearSelector({ tahunTersedia, tahun, onChange, loading }: YearSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const sorted = [...tahunTersedia].sort((a, b) => b - a)

  return (
    <div ref={ref} className="relative min-w-[140px]">
      <motion.button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/60 backdrop-blur-md px-3.5 py-2.5 text-sm text-white/80 hover:border-white/20 transition-colors w-full"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        disabled={loading}
      >
        <CalendarBlank size={16} weight="bold" />
        <span className="flex-1 text-left">{loading ? "Memuat..." : tahun}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <CaretDown size={14} />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute right-0 mt-1 z-[1000] w-full rounded-xl border border-white/10 bg-black/80 backdrop-blur-md py-1 shadow-xl overflow-hidden"
          >
            {sorted.map((t) => (
              <motion.button
                key={t}
                onClick={() => {
                  onChange(t)
                  setOpen(false)
                }}
                className={`w-full px-3.5 py-2 text-left text-sm transition-colors ${
                  t === tahun
                    ? "text-emerald-400 bg-emerald-500/10"
                    : "text-white/70 hover:bg-white/5"
                }`}
                whileHover={{ x: 4 }}
              >
                {t}
              </motion.button>
            ))}
            {sorted.length === 0 && (
              <div className="px-3.5 py-2 text-sm text-white/40">Tidak ada data</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
