"use client"

import { motion } from "framer-motion"
import {
  Lightning, ArrowUp, ArrowDown, CheckCircle,
  ChartLine, Baby, DropHalf,
} from "@phosphor-icons/react/dist/ssr"

interface ShapFeature {
  feature: string
  shap_value: number
  mean_abs_impact: number
}

interface ShapData {
  success: boolean
  expected_value: number
  features: ShapFeature[]
}

interface HistoryRow {
  id: number
  tanggal: string
  jumlahBayi6Bulan: number
  jumlahASIEksklusif: number
  persentaseCakupan: number | null
}

interface Props {
  prediction: number
  shapData: ShapData
  currentHistory: HistoryRow[]
}

const FEATURE_LABELS: Record<string, string> = {
  Jumlah_ASI_Eksklusif: "Jumlah ASI Eksklusif",
  Rasio_ASI_Bayi: "Rasio ASI/Bayi",
  Lag1_Target: "Cakupan Bulan Lalu (t-1)",
  Lag2_Target: "Cakupan 2 Bulan Lalu (t-2)",
  Lag3_Target: "Cakupan 3 Bulan Lalu (t-3)",
  Month_Sin: "Musim (Sin)",
  Month_Cos: "Musim (Cos)",
  Year_Trend: "Tren Tahunan",
}

export function CounterfactualAnalysis({ prediction, shapData, currentHistory }: Props) {
  const TARGET = 80
  const gap = TARGET - prediction
  const isMet = prediction >= TARGET

  const featureMap = new Map(
    shapData.features.map((f) => [f.feature, f])
  )

  const sortedByShap = [...shapData.features].sort(
    (a, b) => a.shap_value - b.shap_value
  )

  // Top negative contributors (shap_value < 0), prioritize actionable features
  const negativeFeatures = sortedByShap.filter((f) => f.shap_value < 0)

  // Move Rasio_ASI_Bayi to top if it's among negative contributors
  const prioritized = negativeFeatures.sort((a, b) => {
    if (a.feature === "Rasio_ASI_Bayi") return -1
    if (b.feature === "Rasio_ASI_Bayi") return 1
    return a.shap_value - b.shap_value
  })

  // Estimate required ratio change for Rasio_ASI_Bayi
  const ratioFeature = featureMap.get("Rasio_ASI_Bayi")

  // Calculate current ratio from last 12 months
  const lastRatio =
    currentHistory.length > 0
      ? currentHistory[currentHistory.length - 1].jumlahASIEksklusif /
        currentHistory[currentHistory.length - 1].jumlahBayi6Bulan
      : 0

  // Estimate sensitivity: average coverage change per unit ratio change
  const validHistory = currentHistory.filter(
    (h) => h.persentaseCakupan != null && h.jumlahBayi6Bulan > 0
  )
  let sensitivity = 55 // default fallback
  let targetRatio = lastRatio
  let ratioGap = 0

  if (validHistory.length >= 2) {
    const ratios = validHistory.map(
      (h) => h.jumlahASIEksklusif / h.jumlahBayi6Bulan
    )
    const coverages = validHistory.map((h) => h.persentaseCakupan!)
    const meanRatio = ratios.reduce((s, v) => s + v, 0) / ratios.length
    const meanCoverage =
      coverages.reduce((s, v) => s + v, 0) / coverages.length

    // Simple linear regression
    let num = 0
    let den = 0
    for (let i = 0; i < validHistory.length; i++) {
      num += (ratios[i] - meanRatio) * (coverages[i] - meanCoverage)
      den += (ratios[i] - meanRatio) ** 2
    }
    if (den > 1e-10) {
      sensitivity = num / den
    }
  }

  // Estimate: how much ratio needs to change to close the gap
  if (ratioFeature && !isMet && sensitivity > 0) {
    const neededCoverageIncrease = gap
    const neededRatioIncrease = neededCoverageIncrease / sensitivity
    targetRatio = lastRatio + neededRatioIncrease
    ratioGap = neededRatioIncrease
  }

  // Current SHAP-based estimate
  const ratioShapContribution = ratioFeature?.shap_value ?? 0

  // Total negative contribution sum
  const totalNegShap = negativeFeatures.reduce(
    (s, f) => s + f.shap_value,
    0
  )

  // Percentage of gap explainable by ratio
  const ratioExplainsPct =
    totalNegShap < 0
      ? Math.min(100, Math.round((Math.abs(ratioShapContribution) / Math.abs(totalNegShap)) * 100))
      : 0

  // Avg coverage from history for context
  const avgCoverage =
    validHistory.length > 0
      ? validHistory.reduce((s, h) => s + h.persentaseCakupan!, 0) / validHistory.length
      : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass rounded-xl p-5"
    >
      {/* Header */}
      <div className="mb-5 flex items-center gap-2">
        <Lightning size={20} className="text-emerald-400" />
        <h2 className="text-lg font-semibold text-theme">
          Analisis Counterfactual: Target {TARGET}%
        </h2>
      </div>

      {/* Progress Bar */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-theme-secondary">Prediksi Saat Ini</span>
          <span className="font-medium text-theme">{prediction.toFixed(1)}%</span>
        </div>
        <div className="relative h-4 overflow-hidden rounded-full" style={{ backgroundColor: "var(--skeleton-base)" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (prediction / TARGET) * 100)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
          />
          <div
            className="absolute top-0 h-full w-0.5 bg-white/60"
            style={{ left: "100%" }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white/80">
            Target: {TARGET}%
          </div>
        </div>
      </div>

      {/* Status Card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className={`mb-5 rounded-lg p-4 ${
          isMet
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-amber-500/10 text-amber-400"
        }`}
      >
        <div className="flex items-center gap-3">
          {isMet ? (
            <CheckCircle size={24} weight="fill" />
          ) : (
            <ArrowUp size={24} weight="bold" />
          )}
          <div>
            <p className="font-medium">
              {isMet
                ? "Target 80% Tercapai"
                : `Target 80% Belum Tercapai (Selisih ${gap.toFixed(1)}%)`}
            </p>
            <p className="mt-0.5 text-xs opacity-80">
              {isMet
                ? `Prediksi ${prediction.toFixed(1)}% berada di atas target ${TARGET}%`
                : `Dibutuhkan peningkatan sebesar ${gap.toFixed(1)}% untuk mencapai target`}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Intervention Recommendations */}
      {!isMet && (
        <>
          {/* Primary Intervention: Rasio_ASI_Bayi */}
          {ratioFeature && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <DropHalf size={18} className="text-emerald-400" />
                <h3 className="font-medium text-theme">
                  Intervensi Utama: Rasio ASI/Bayi
                </h3>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  {ratioExplainsPct}% dari gap
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-theme-secondary">Nilai Saat Ini</p>
                  <p className="text-lg font-bold text-theme">
                    {lastRatio.toFixed(3)}
                  </p>
                  <p className="text-xs text-muted">
                    Rata-rata historis:{" "}
                    {validHistory.length > 0
                      ? (
                          validHistory.reduce((s, h) => s + h.jumlahASIEksklusif / h.jumlahBayi6Bulan, 0) /
                          validHistory.length
                        ).toFixed(3)
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-theme-secondary">Nilai Target</p>
                  <p className="text-lg font-bold text-emerald-400">
                    {targetRatio.toFixed(3)}
                  </p>
                  <p className="text-xs text-emerald-400/70">
                    +{ratioGap.toFixed(3)} ({ratioGap > 0 ? ((ratioGap / lastRatio) * 100).toFixed(1) : 0}%)
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-lg bg-emerald-500/5 p-3 text-xs text-theme-secondary">
                <p className="flex items-start gap-2">
                  <Baby size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                  <span>
                    Untuk mencapai target {TARGET}%, Rasio ASI/Bayi perlu ditingkatkan
                    dari <strong className="text-theme">{lastRatio.toFixed(3)}</strong> menjadi{" "}
                    <strong className="text-emerald-400">{targetRatio.toFixed(3)}</strong>.
                    Ini berarti meningkatkan jumlah ibu yang memberikan ASI eksklusif
                    setiap bulannya.
                  </span>
                </p>
              </div>
            </motion.div>
          )}

          {/* Other Negative Features */}
          {prioritized.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="space-y-2"
            >
              <h3 className="flex items-center gap-2 text-sm font-medium text-theme">
                <ChartLine size={16} className="text-theme-secondary" />
                Fitur Lain yang Perlu Ditingkatkan
              </h3>
              {prioritized.map((f, i) => (
                <motion.div
                  key={f.feature}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1 + i * 0.1 }}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                  style={{ backgroundColor: "var(--skeleton-base)" }}
                >
                  <span className="text-theme-secondary">
                    {FEATURE_LABELS[f.feature] || f.feature}
                  </span>
                  <span className="flex items-center gap-1 text-cyan-400">
                    <ArrowDown size={12} />
                    {Math.abs(f.shap_value).toFixed(2)}%
                  </span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </>
      )}

      {/* Context Footer */}
      <div className="mt-4 border-t border-theme pt-3 text-xs text-muted">
        <p>
          Rata-rata cakupan historis: {avgCoverage.toFixed(1)}% &middot;
          SHAP baseline (expected value): {shapData.expected_value.toFixed(2)}% &middot;
          Sensitivitas rasio terhadap cakupan: {sensitivity.toFixed(1)}x
        </p>
      </div>
    </motion.div>
  )
}
