"use client"

import { motion } from "framer-motion"
import type { Segmen } from "@/types"

const SEGMEN_ITEMS: { segmen: Segmen; label: string; color: string }[] = [
  { segmen: "SANGAT_BAIK", label: "Sangat Baik (\u226580%)", color: "#10b981" },
  { segmen: "SEDANG", label: "Sedang (50-79%)", color: "#f59e0b" },
  { segmen: "RENDAH", label: "Rendah (<50%)", color: "#ef4444" },
]

interface MapLegendProps {
  activeSegmen: Segmen | null
  onHover: (s: Segmen | null) => void
}

export function MapLegend({ activeSegmen, onHover }: MapLegendProps) {
  return (
    <div className="absolute right-4 top-4 z-[999] rounded-xl border border-white/10 bg-black/70 backdrop-blur-md px-3 py-2.5 text-xs shadow-lg">
      <div className="mb-1.5 font-semibold text-white/90">Legenda</div>
      <div className="space-y-1.5">
        {SEGMEN_ITEMS.map((item) => {
          const isActive = activeSegmen === item.segmen
          return (
            <motion.div
              key={item.segmen}
              className="flex items-center gap-2 cursor-pointer rounded-md px-1.5 py-0.5 transition-colors"
              style={{
                background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
              }}
              onMouseEnter={() => onHover(item.segmen)}
              onMouseLeave={() => onHover(null)}
              whileHover={{ x: 2 }}
              layout
            >
              <motion.span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: item.color }}
                animate={{ scale: isActive ? 1.3 : 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              />
              <span className="text-white/70">{item.label}</span>
            </motion.div>
          )
        })}
        <div className="border-t border-white/10 pt-1.5 mt-1.5 space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-white/40 bg-transparent" />
            <span className="text-white/50">Puskesmas</span>
          </div>
        </div>
      </div>
    </div>
  )
}
