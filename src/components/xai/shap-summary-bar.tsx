"use client"

import { motion } from "framer-motion"

interface ShapImpact {
  lag: number
  shap_value: number
  feature_name: string
}

interface ShapFeature {
  feature: string
  mean_abs_impact: number
  impacts: ShapImpact[]
}

interface Props {
  features: ShapFeature[]
}

export function ShapSummaryBar({ features }: Props) {
  const maxMean = Math.max(...features.map((f) => f.mean_abs_impact), 0.001)

  return (
    <div className="space-y-4">
      {features.map((f, i) => {
        const pct = (f.mean_abs_impact / maxMean) * 100
        return (
          <div key={f.feature}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-theme-secondary">{f.feature}</span>
              <span className="font-mono text-xs text-muted">
                {f.mean_abs_impact.toFixed(2)}%
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--skeleton-base)" }}>
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
