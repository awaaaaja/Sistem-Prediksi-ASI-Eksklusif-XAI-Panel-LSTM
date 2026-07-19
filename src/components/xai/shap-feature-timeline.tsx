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

export function ShapFeatureTimeline({ features }: Props) {
  const maxAbs = Math.max(...features.map((f) => Math.abs(f.shap_value)), 0.001)

  return (
    <div className="space-y-5">
      {features.map((f, i) => {
        const pct = (f.shap_value / maxAbs) * 100
        const isPositive = f.shap_value >= 0
        return (
          <div key={f.feature}>
            <p className="mb-2 text-xs font-medium text-theme-secondary">{f.feature}</p>
            <div className="flex items-center gap-3">
              <span className="w-8 text-right text-[10px] text-muted">{isPositive ? "+" : ""}{f.shap_value.toFixed(2)}%</span>
              <div className="flex-1">
                <motion.div
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  className="h-3 rounded"
                  style={{
                    width: `${Math.abs(pct)}%`,
                    minWidth: 4,
                    background: isPositive
                      ? "linear-gradient(90deg, #10b981, #059669)"
                      : "linear-gradient(90deg, #3b82f6, #2563eb)",
                    transformOrigin: isPositive ? "left" : "right",
                    marginLeft: isPositive ? 0 : `${100 - Math.abs(pct)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
