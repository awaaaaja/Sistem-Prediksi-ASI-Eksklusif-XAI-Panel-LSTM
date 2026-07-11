"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  Building, TrendUp, FileArrowDown, Database,
  CaretUp, CaretDown, Clock,
} from "@phosphor-icons/react/dist/ssr"
import { GlowCard } from "@/components/glow-card"
import { AnimatedNumber } from "@/components/animated-number"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Area, AreaChart,
} from "recharts"

interface TrendPoint {
  bulan: string
  rataCakupan: number
  totalPuskesmas: number
}

interface PuskesmasStat {
  kode: string
  rataCakupan: number
  totalBayi: number
  totalASI: number
  totalBulan: number
}

interface PrediksiItem {
  kode: string
  nama: string
  nilaiPrediksi: number
  tanggalPrediksi: string
}

interface UploadLogItem {
  id: number
  namaFile: string
  totalBaris: number
  barisValid: number
  status: string
  createdAt: string
}

interface DashboardData {
  stats: {
    totalPuskesmas: number
    totalDataBulanan: number
    totalPrediksi: number
    rataCakupan: number
    trendCakupan: number
    latestPrediction: { kode: string; nama: string; nilaiPrediksi: number; tanggalPrediksi: string } | null
  }
  trend: TrendPoint[]
  puskesmasStats: PuskesmasStat[]
  prediksiPerPkm: PrediksiItem[]
  uploadLogs: UploadLogItem[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/dashboard")
        const d: DashboardData = await res.json()
        setData(d)
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [])

  const stats = data ? [
    {
      label: "Total Puskesmas",
      value: data.stats.totalPuskesmas,
      icon: Building,
      glow: "emerald" as const,
      decimals: 0,
      suffix: "",
      change: null as number | null,
    },
    {
      label: "Rata-rata Cakupan",
      value: data.stats.rataCakupan,
      icon: TrendUp,
      glow: "cyan" as const,
      decimals: 2,
      suffix: "%",
      change: data.stats.trendCakupan,
    },
    {
      label: "Total Prediksi",
      value: data.stats.totalPrediksi,
      icon: FileArrowDown,
      glow: "emerald" as const,
      decimals: 0,
      suffix: "",
      change: null,
    },
    {
      label: "Bulan Data Historis",
      value: data.stats.totalPrediksi + (data.trend?.length || 0),
      icon: Database,
      glow: "cyan" as const,
      decimals: 0,
      suffix: "",
      change: null,
    },
    {
      label: "Data Bulanan",
      value: data.stats.totalDataBulanan,
      icon: Database,
      glow: "emerald" as const,
      decimals: 0,
      suffix: "",
      change: null,
    },
    {
      label: "Prediksi Terakhir",
      value: data.stats.latestPrediction ? data.stats.latestPrediction.nilaiPrediksi * 100 : 0,
      icon: TrendUp,
      glow: "cyan" as const,
      decimals: 2,
      suffix: "%",
      change: null,
    },
  ] : []

  const topPuskesmas = data?.puskesmasStats?.slice(0, 5) || []
  const bottomPuskesmas = data?.puskesmasStats?.slice(-5).reverse() || []

  const prediksiChartData = data?.prediksiPerPkm?.map((p) => ({
    kode: p.kode,
    prediksi: +(p.nilaiPrediksi * 100).toFixed(2),
  })) || []

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-dark-400">
          Sistem Prediksi Cakupan ASI Eksklusif &mdash; 24 Puskesmas
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-dark-800" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {stats.map((s) => (
            <GlowCard key={s.label} glow={s.glow}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs text-dark-400">{s.label}</p>
                  <p className="mt-2 text-xl font-bold text-white">
                    <AnimatedNumber value={s.value} decimals={s.decimals} suffix={s.suffix} />
                  </p>
                  {s.change !== null && (
                    <p className={`mt-1 flex items-center gap-0.5 text-xs ${s.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {s.change >= 0 ? <CaretUp size={12} weight="fill" /> : <CaretDown size={12} weight="fill" />}
                      {Math.abs(s.change)}% dari bulan lalu
                    </p>
                  )}
                  {s.label === "Prediksi Terakhir" && data?.stats.latestPrediction && (
                    <p className="mt-0.5 text-[10px] text-dark-500">
                      {data.stats.latestPrediction.kode} &middot;{" "}
                      {new Date(data.stats.latestPrediction.tanggalPrediksi).toLocaleDateString("id-ID")}
                    </p>
                  )}
                </div>
                <div className={`rounded-lg p-2 ${
                  s.glow === "emerald" ? "bg-emerald-500/10 text-emerald-400" : "bg-cyan-500/10 text-cyan-400"
                }`}>
                  <s.icon size={16} />
                </div>
              </div>
            </GlowCard>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlowCard>
          <h2 className="mb-4 text-lg font-semibold text-white">Tren Cakupan ASI Eksklusif (48 Bulan)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.trend || []}>
                <defs>
                  <linearGradient id="cakupanGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="bulan"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  interval={5}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid rgba(148,163,184,0.15)",
                    borderRadius: 8,
                    color: "#f1f5f9",
                    fontSize: 12,
                  }}
                  formatter={(value: unknown) => [`${Number(value)}%`, "Rata-rata Cakupan"] as [string, string]}
                />
                <Area
                  type="monotone"
                  dataKey="rataCakupan"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#cakupanGrad)"
                  name="Rata-rata Cakupan"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlowCard>

        <GlowCard>
          <h2 className="mb-4 text-lg font-semibold text-white">Prediksi per Puskesmas</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={prediksiChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  type="number"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="kode"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid rgba(148,163,184,0.15)",
                    borderRadius: 8,
                    color: "#f1f5f9",
                    fontSize: 12,
                  }}
                  formatter={(value: unknown) => [`${Number(value)}%`, "Prediksi"] as [string, string]}
                />
                <Bar
                  dataKey="prediksi"
                  fill="#10b981"
                  radius={[0, 4, 4, 0]}
                  barSize={12}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlowCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlowCard glow="emerald">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Top 5 Puskesmas &mdash; Rata-rata Cakapan Tertinggi
          </h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topPuskesmas} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  type="number"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="kode"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid rgba(148,163,184,0.15)",
                    borderRadius: 8,
                    color: "#f1f5f9",
                    fontSize: 12,
                  }}
                  formatter={(value: unknown) => [`${Number(value)}%`, "Rata-rata Cakupan"] as [string, string]}
                />
                <Bar dataKey="rataCakupan" fill="#10b981" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlowCard>

        <GlowCard glow="cyan">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Bottom 5 Puskesmas &mdash; Rata-rata Cakapan Terendah
          </h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bottomPuskesmas} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  type="number"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="kode"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid rgba(148,163,184,0.15)",
                    borderRadius: 8,
                    color: "#f1f5f9",
                    fontSize: 12,
                  }}
                  formatter={(value: unknown) => [`${Number(value)}%`, "Rata-rata Cakupan"] as [string, string]}
                />
                <Bar dataKey="rataCakupan" fill="#06b6d4" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlowCard>
      </div>

      <GlowCard>
        <h2 className="mb-4 text-lg font-semibold text-white">Daftar Puskesmas</h2>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-dark-800" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-dark-400">
                  <th className="pb-3 font-medium">Kode</th>
                  <th className="pb-3 font-medium">Rata-rata Cakupan</th>
                  <th className="pb-3 font-medium">Total Bayi</th>
                  <th className="pb-3 font-medium">Total ASI</th>
                  <th className="pb-3 font-medium">Bulan Data</th>
                  <th className="pb-3 font-medium">Prediksi</th>
                  <th className="pb-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data?.puskesmasStats.map((p, i) => {
                  const pred = data.prediksiPerPkm.find((x) => x.kode === p.kode)
                  return (
                    <motion.tr
                      key={p.kode}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b border-white/5 text-white last:border-0 hover:bg-white/5"
                    >
                      <td className="py-3 font-medium">{p.kode}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-dark-700">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${Math.min(p.rataCakupan, 100)}%` }}
                            />
                          </div>
                          <span className="text-emerald-400">{p.rataCakupan}%</span>
                        </div>
                      </td>
                      <td className="py-3 text-dark-300">{p.totalBayi.toLocaleString()}</td>
                      <td className="py-3 text-dark-300">{p.totalASI.toLocaleString()}</td>
                      <td className="py-3 text-dark-400">{p.totalBulan}</td>
                      <td className="py-3">
                        {pred ? (
                          <span className="text-cyan-400">{(pred.nilaiPrediksi * 100).toFixed(2)}%</span>
                        ) : (
                          <span className="text-dark-500">-</span>
                        )}
                      </td>
                      <td className="py-3">
                        <a
                          href={`/puskesmas/${p.kode === "PKM01" ? 1 : p.kode === "PKM02" ? 2 : "#"}`}
                          onClick={async (e) => {
                            e.preventDefault()
                            try {
                              const res = await fetch(`/api/puskesmas/by-kode/${p.kode}`)
                              const pkm = await res.json()
                              if (pkm?.id) window.location.href = `/puskesmas/${pkm.id}`
                            } catch { /* ignore */ }
                          }}
                          className="rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400 transition-colors hover:bg-emerald-500/20"
                        >
                          Detail
                        </a>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlowCard>

      <GlowCard>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <Clock size={18} className="text-dark-400" />
          Aktivitas Upload Terakhir
        </h2>
        {data?.uploadLogs && data.uploadLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-dark-400">
                  <th className="pb-3 font-medium">File</th>
                  <th className="pb-3 font-medium">Total</th>
                  <th className="pb-3 font-medium">Valid</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Waktu</th>
                </tr>
              </thead>
              <tbody>
                {data.uploadLogs.map((log) => (
                  <tr key={log.id} className="border-b border-white/5 text-white last:border-0">
                    <td className="py-3 text-dark-300">{log.namaFile}</td>
                    <td className="py-3">{log.totalBaris}</td>
                    <td className="py-3">{log.barisValid}</td>
                    <td className="py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${
                        log.status === "success"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-yellow-500/10 text-yellow-400"
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 text-dark-400">
                      {new Date(log.createdAt).toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-dark-500">Belum ada aktivitas upload</p>
        )}
      </GlowCard>
    </motion.div>
  )
}
