"use client"

import { motion } from "framer-motion"

interface ShapFeature {
  feature: string
  shap_value: number
  mean_abs_impact: number
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
                {f.shap_value >= 0 ? "+" : ""}{f.shap_value.toFixed(2)}%
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--skeleton-base)" }}>
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{
                  background: f.shap_value >= 0
                    ? "linear-gradient(90deg, #10b981, #059669)"
                    : "linear-gradient(90deg, #3b82f6, #2563eb)",
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
