"use client"

import { motion } from "framer-motion"

interface ShapFeature {
  feature: string
  shap_value: number
  mean_abs_impact: number
}

interface Props {
  features: ShapFeature[]
  expectedValue: number
}

export function ShapForcePlot({ features, expectedValue }: Props) {
  const totalImpact = features.reduce((s, f) => s + f.shap_value, 0)
  const finalValue = expectedValue + totalImpact
  const maxAbs = Math.max(...features.map((f) => Math.abs(f.shap_value)), 0.001)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-theme-secondary">
        <span>Base: {expectedValue.toFixed(2)}%</span>
        <span className="text-emerald-400">Output: {finalValue.toFixed(2)}%</span>
      </div>
      <div className="relative h-8 overflow-hidden rounded-lg" style={{ backgroundColor: "var(--skeleton-base)" }}>
        {features.map((f, i) => {
          const pct = (f.shap_value / maxAbs) * 50
          const isPositive = f.shap_value >= 0
          return (
            <motion.div
              key={f.feature}
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              className="absolute top-0 h-full origin-left"
              style={{
                left: `calc(50% + ${isPositive ? 0 : pct}%)`,
                width: `${Math.abs(pct)}%`,
                background: isPositive
                  ? "linear-gradient(90deg, rgba(16,185,129,0.6), rgba(16,185,129,0.2))"
                  : "linear-gradient(90deg, rgba(59,130,246,0.2), rgba(59,130,246,0.6))",
              }}
            />
          )
        })}
        <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2" style={{ backgroundColor: "var(--text-muted)" }} />
      </div>
      <div className="flex flex-wrap gap-2">
        {features.map((f) => (
          <span
            key={f.feature}
            className="rounded-full px-2.5 py-1 text-xs text-theme-secondary"
            style={{ backgroundColor: "var(--skeleton-base)" }}
          >
            {f.feature}: {f.shap_value >= 0 ? "+" : ""}{f.shap_value.toFixed(2)}%
          </span>
        ))}
      </div>
    </div>
  )
}
