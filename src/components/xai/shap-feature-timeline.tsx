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

export function ShapFeatureTimeline({ features }: Props) {
  const allValues = features.flatMap((f) => f.impacts.map((i) => i.shap_value))
  const maxAbs = Math.max(...allValues.map(Math.abs), 0.001)

  return (
    <div className="space-y-5">
      {features.map((f) => (
        <div key={f.feature}>
          <p className="mb-2 text-xs font-medium text-theme-secondary">{f.feature}</p>
          <div className="flex items-end gap-1">
            {f.impacts.map((imp, i) => {
              const pct = (imp.shap_value / maxAbs) * 100
              const isPositive = imp.shap_value >= 0
              return (
                <div key={imp.lag} className="flex flex-1 flex-col items-center">
                  <motion.div
                    initial={{ scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                    className="w-full rounded-t-sm"
                    style={{
                      height: `${Math.abs(pct)}%`,
                      minHeight: 4,
                      maxHeight: 60,
                      background: isPositive
                        ? "linear-gradient(180deg, #10b981, #059669)"
                        : "linear-gradient(180deg, #3b82f6, #2563eb)",
                      transformOrigin: isPositive ? "bottom" : "top",
                    }}
                  />
                  <span className="mt-1 text-[10px] text-muted">{imp.lag}</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
