"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, Lightning, ChartLine,
  Baby, DropHalf
} from "@phosphor-icons/react/dist/ssr"
import { GlowCard } from "@/components/glow-card"
import { AnimatedNumber } from "@/components/animated-number"
import { ShapForcePlot } from "@/components/xai/shap-force-plot"
import { ShapSummaryBar } from "@/components/xai/shap-summary-bar"
import { ShapFeatureTimeline } from "@/components/xai/shap-feature-timeline"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts"
import Link from "next/link"

interface PuskesmasDetail {
  id: number
  kode: string
  nama: string
  kecamatan: { nama: string } | null
  alamat: string | null
}

interface HistoryRow {
  id: number
  tanggal: string
  jumlahBayi6Bulan: number
  jumlahASIEksklusif: number
  persentaseCakupan: number | null
}

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

interface ShapData {
  success: boolean
  expected_value: number
  features: ShapFeature[]
}

const tooltipStyle = {
  background: "var(--tooltip-bg)",
  border: "1px solid var(--tooltip-border)",
  borderRadius: 8,
  color: "var(--tooltip-text)",
  fontSize: 12,
}

export default function DetailPage({ params }: { params: { id: string } }) {
  const id = params.id
  const [puskesmas, setPuskesmas] = useState<PuskesmasDetail | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [prediction, setPrediction] = useState<number | null>(null)
  const [shapData, setShapData] = useState<ShapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [predicting, setPredicting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [pRes, hRes] = await Promise.all([
          fetch(`/api/puskesmas/${id}`),
          fetch(`/api/history/${id}`),
        ])
        if (pRes.ok) setPuskesmas(await pRes.json())
        if (hRes.ok) setHistory(await hRes.json())
      } catch {
        setError("Gagal memuat data")
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function handlePredict() {
    setPredicting(true)
    setError(null)
    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puskesmasId: Number(id) }),
      })
      const data = await res.json()
      if (data.success) {
        setPrediction(data.prediction)
        setShapData(data.shap)
      } else {
        setError(data.error || "Prediksi gagal")
      }
    } catch {
      setError("Gagal terhubung ke server prediksi")
    }
    setPredicting(false)
  }

  const chartData = history.map((h) => ({
    bulan: h.tanggal.slice(0, 7),
    bayi: h.jumlahBayi6Bulan,
    asi: h.jumlahASIEksklusif,
    persentase: h.persentaseCakupan ?? null,
  }))

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="rounded-lg p-2 text-theme-secondary transition-colors hover:bg-hover-theme hover:text-theme"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-theme">
            {loading ? (
              <span className="inline-block h-8 w-48 shimmer rounded" />
            ) : (
              puskesmas?.nama ?? "Puskesmas Tidak Ditemukan"
            )}
          </h1>
          {puskesmas && (
            <p className="text-sm text-theme-secondary">
              {puskesmas.kode} &middot; {puskesmas.kecamatan?.nama ?? "-"}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <motion.button
          onClick={handlePredict}
          disabled={predicting || loading}
          whileHover={{ scale: predicting || loading ? 1 : 1.02 }}
          whileTap={{ scale: predicting || loading ? 1 : 0.96 }}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50"
        >
          <Lightning size={18} weight="fill" />
          {predicting ? "Memprediksi..." : "Prediksi Sekarang"}
        </motion.button>
        {history.length > 0 && (
          <span className="self-center text-xs text-muted">
            {history.length} bulan data tersedia
          </span>
        )}
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg bg-red-500/10 p-4 text-sm text-red-400"
        >
          {error}
        </motion.div>
      )}

      <GlowCard>
        <h2 className="mb-4 text-lg font-semibold text-theme">Data Historis (48 Bulan)</h2>
        <div className="flex items-center gap-6 text-xs text-theme-secondary">
          <span className="flex items-center gap-1"><Baby size={14} className="text-emerald-400" /> Bayi 6 Bulan</span>
          <span className="flex items-center gap-1"><DropHalf size={14} className="text-cyan-400" /> ASI Eksklusif</span>
        </div>
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="bulan" tick={{ fill: "var(--text-muted)", fontSize: 11 }} interval={5} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
              <Line type="monotone" dataKey="bayi" stroke="#10b981" strokeWidth={2} dot={false} name="Bayi 6 Bulan" />
              <Line type="monotone" dataKey="asi" stroke="#06b6d4" strokeWidth={2} dot={false} name="ASI Eksklusif" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlowCard>

      <AnimatePresence mode="wait">
        {prediction !== null && (
          <motion.div
            key={prediction}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <GlowCard glow="emerald">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-emerald-500/10 p-3 text-emerald-400">
                  <ChartLine size={24} />
                </div>
                <div>
                  <p className="text-sm text-theme-secondary">Prediksi Cakupan ASI Eksklusif</p>
                  <p className="text-3xl font-bold text-theme">
                    <AnimatedNumber value={prediction} decimals={2} suffix="%" />
                  </p>
                </div>
              </div>
            </GlowCard>
          </motion.div>
        )}
      </AnimatePresence>

      {shapData && (
        <>
          <GlowCard>
            <h2 className="mb-4 text-lg font-semibold text-theme">SHAP Force Plot</h2>
            <ShapForcePlot features={shapData.features} expectedValue={shapData.expected_value} />
          </GlowCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <GlowCard>
              <h2 className="mb-4 text-lg font-semibold text-theme">Feature Importance</h2>
              <ShapSummaryBar features={shapData.features} />
            </GlowCard>

            <GlowCard>
              <h2 className="mb-4 text-lg font-semibold text-theme">Feature Timeline (12 Lag)</h2>
              <ShapFeatureTimeline features={shapData.features} />
            </GlowCard>
          </div>

          <GlowCard>
            <h2 className="mb-4 text-lg font-semibold text-theme">Interpretation</h2>
            <div className="space-y-3 text-sm text-theme-secondary">
              {shapData.features.map((f) => (
                <p key={f.feature}>
                  <span className="font-medium text-theme">{f.feature}</span> — kontribusi rata-rata{" "}
                  <span className={f.mean_abs_impact >= 0 ? "text-emerald-400" : "text-cyan-400"}>
                      {f.mean_abs_impact >= 0 ? "+" : ""}
                    {f.mean_abs_impact.toFixed(2)}%
                  </span>{" "}
                  terhadap prediksi. Lag paling berpengaruh:{" "}
                  <span className="text-theme">
                    t-{f.impacts.reduce((a, b) => Math.abs(a.shap_value) > Math.abs(b.shap_value) ? a : b).lag}
                  </span>.
                </p>
              ))}
              <p className="mt-3 text-muted">
                Nilai baseline (expected value): {shapData.expected_value.toFixed(2)}%
              </p>
            </div>
          </GlowCard>
        </>
      )}
    </motion.div>
  )
}
