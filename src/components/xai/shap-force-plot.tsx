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
  expectedValue: number
}

export function ShapForcePlot({ features, expectedValue }: Props) {
  const allImpacts = features.flatMap((f) => f.impacts)
  const maxAbs = Math.max(...allImpacts.map((i) => Math.abs(i.shap_value)), 0.001)
  const totalImpact = allImpacts.reduce((s, i) => s + i.shap_value, 0)
  const finalValue = expectedValue + totalImpact

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-dark-400">
        <span>Base: {(expectedValue * 100).toFixed(2)}%</span>
        <span className="text-emerald-400">Output: {(finalValue * 100).toFixed(2)}%</span>
      </div>
      <div className="relative h-8 overflow-hidden rounded-lg bg-dark-800">
        {allImpacts.map((imp, i) => {
          const pct = (imp.shap_value / maxAbs) * 50
          const isPositive = imp.shap_value >= 0
          return (
            <motion.div
              key={`${imp.feature_name}-${imp.lag}`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: i * 0.03, duration: 0.4 }}
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
        <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-dark-400" />
      </div>
      <div className="flex flex-wrap gap-2">
        {features.map((f) => (
          <span
            key={f.feature}
            className="rounded-full bg-dark-800 px-2.5 py-1 text-xs text-dark-300"
          >
            {f.feature}: {(f.mean_abs_impact * 100).toFixed(2)}%
          </span>
        ))}
      </div>
    </div>
  )
}
