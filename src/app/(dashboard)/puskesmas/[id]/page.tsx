"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
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
  kota: string | null
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
          className="rounded-lg p-2 text-dark-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {loading ? (
              <span className="inline-block h-8 w-48 animate-pulse rounded bg-dark-700" />
            ) : (
              puskesmas?.nama ?? "Puskesmas Tidak Ditemukan"
            )}
          </h1>
          {puskesmas && (
            <p className="text-sm text-dark-400">
              {puskesmas.kode} &middot; {puskesmas.kota ?? "-"}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handlePredict}
          disabled={predicting || loading}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50"
        >
          <Lightning size={18} weight="fill" />
          {predicting ? "Memprediksi..." : "Prediksi Sekarang"}
        </button>
        {history.length > 0 && (
          <span className="self-center text-xs text-dark-500">
            {history.length} bulan data tersedia
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
      )}

      <GlowCard>
        <h2 className="mb-4 text-lg font-semibold text-white">Data Historis (48 Bulan)</h2>
        <div className="flex items-center gap-6 text-xs text-dark-400">
          <span className="flex items-center gap-1"><Baby size={14} className="text-emerald-400" /> Bayi 6 Bulan</span>
          <span className="flex items-center gap-1"><DropHalf size={14} className="text-cyan-400" /> ASI Eksklusif</span>
        </div>
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="bulan" tick={{ fill: "#64748b", fontSize: 11 }} interval={5} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid rgba(148,163,184,0.15)",
                  borderRadius: 8,
                  color: "#f1f5f9",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
              <Line type="monotone" dataKey="bayi" stroke="#10b981" strokeWidth={2} dot={false} name="Bayi 6 Bulan" />
              <Line type="monotone" dataKey="asi" stroke="#06b6d4" strokeWidth={2} dot={false} name="ASI Eksklusif" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlowCard>

      {prediction !== null && (
        <GlowCard glow="emerald">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-emerald-500/10 p-3 text-emerald-400">
              <ChartLine size={24} />
            </div>
            <div>
              <p className="text-sm text-dark-400">Prediksi Cakupan ASI Eksklusif</p>
              <p className="text-3xl font-bold text-white">
                <AnimatedNumber value={prediction * 100} decimals={2} suffix="%" />
              </p>
            </div>
          </div>
        </GlowCard>
      )}

      {shapData && (
        <>
          <GlowCard>
            <h2 className="mb-4 text-lg font-semibold text-white">SHAP Force Plot</h2>
            <ShapForcePlot features={shapData.features} expectedValue={shapData.expected_value} />
          </GlowCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <GlowCard>
              <h2 className="mb-4 text-lg font-semibold text-white">Feature Importance</h2>
              <ShapSummaryBar features={shapData.features} />
            </GlowCard>

            <GlowCard>
              <h2 className="mb-4 text-lg font-semibold text-white">Feature Timeline (12 Lag)</h2>
              <ShapFeatureTimeline features={shapData.features} />
            </GlowCard>
          </div>

          <GlowCard>
            <h2 className="mb-4 text-lg font-semibold text-white">Interpretation</h2>
            <div className="space-y-3 text-sm text-dark-300">
              {shapData.features.map((f) => (
                <p key={f.feature}>
                  <span className="font-medium text-white">{f.feature}</span> — kontribusi rata-rata{" "}
                  <span className={f.mean_abs_impact >= 0 ? "text-emerald-400" : "text-cyan-400"}>
                    {f.mean_abs_impact >= 0 ? "+" : ""}
                    {(f.mean_abs_impact * 100).toFixed(2)}%
                  </span>{" "}
                  terhadap prediksi. Lag paling berpengaruh:{" "}
                  <span className="text-white">
                    t-{f.impacts.reduce((a, b) => Math.abs(a.shap_value) > Math.abs(b.shap_value) ? a : b).lag}
                  </span>.
                </p>
              ))}
              <p className="mt-3 text-dark-500">
                Nilai baseline (expected value): {(shapData.expected_value * 100).toFixed(2)}%
              </p>
            </div>
          </GlowCard>
        </>
      )}
    </motion.div>
  )
}
