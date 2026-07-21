"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  Building, TrendUp, FileArrowDown, Database,
  CaretUp, CaretDown, Clock, UploadSimple, Lightning,
  MagnifyingGlass, Funnel, X,
} from "@phosphor-icons/react/dist/ssr"
import { GlowCard } from "@/components/glow-card"
import { AnimatedNumber } from "@/components/animated-number"
import { ProgressRing } from "@/components/ui/progress-ring"
import { StatSkeleton } from "@/components/ui/skeleton-shimmer"
import { useToast } from "@/components/ui/toast"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Area, AreaChart,
} from "recharts"
import { PUSKESMAS_LIST, KECAMATAN_LIST, TAHUN_LIST } from "@/lib/constants"

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

interface RiwayatPrediksiItem {
  id: number
  kode: string
  nama: string
  nilaiPrediksi: number
  createdAt: string
}

interface UploadLogItem {
  id: number
  namaFile: string
  totalBaris: number
  barisValid: number
  status: string
  createdAt: string
}

interface SegmenTrend {
  tahun: number
  sangatBaik: number
  sedang: number
  rendah: number
}

interface DashboardData {
  segmenTrend: SegmenTrend[]
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
  riwayatPrediksi: RiwayatPrediksiItem[]
  uploadLogs: UploadLogItem[]
}

const tooltipStyle = {
  background: "var(--tooltip-bg)",
  border: "1px solid var(--tooltip-border)",
  borderRadius: 8,
  color: "var(--tooltip-text)",
  fontSize: 12,
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [segmentFilter, setSegmentFilter] = useState<string | null>(null)
  const [kecamatanFilter, setKecamatanFilter] = useState<string | null>(null)
  const [tahunFilter, setTahunFilter] = useState<string>("")
  const { toast } = useToast()

  const SEGMEN_THRESHOLDS = { SANGAT_BAIK: 80, SEDANG: 50 }

  function getSegmen(rataCakupan: number): string {
    if (rataCakupan >= SEGMEN_THRESHOLDS.SANGAT_BAIK) return "SANGAT_BAIK"
    if (rataCakupan >= SEGMEN_THRESHOLDS.SEDANG) return "SEDANG"
    return "RENDAH"
  }

  const filteredPuskesmasStats = data?.puskesmasStats
    .filter((p) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const match = PUSKESMAS_LIST.find((x) => x.kode === p.kode)
        if (!match) return true
        if (!match.nama.toLowerCase().includes(q) && !match.kode.toLowerCase().includes(q)) return false
      }
      if (segmentFilter) {
        const seg = getSegmen(p.rataCakupan)
        if (seg !== segmentFilter) return false
      }
      if (kecamatanFilter) {
        const match = PUSKESMAS_LIST.find((x) => x.kode === p.kode)
        if (!match || match.kecamatan !== kecamatanFilter) return false
      }
      return true
    }) || []

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const url = tahunFilter ? `/api/dashboard?tahun=${tahunFilter}` : "/api/dashboard"
        const res = await fetch(url)
        if (!res.ok) throw new Error("Gagal memuat data")
        const d: DashboardData = await res.json()
        setData(d)
      } catch {
        toast("error", "Gagal memuat data dashboard")
      }
      setLoading(false)
    }
    load()
  }, [toast, tahunFilter])

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
      value: data.stats.latestPrediction ? data.stats.latestPrediction.nilaiPrediksi : 0,
      icon: TrendUp,
      glow: "cyan" as const,
      decimals: 2,
      suffix: "%",
      change: null,
    },
  ] : []

  const lineData = data?.segmenTrend || []

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-theme">Dashboard</h1>
        <p className="mt-1 text-sm text-theme-secondary">
          Sistem Prediksi Cakupan ASI Eksklusif &mdash; 24 Puskesmas
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {stats.map((s, i) => (
            <GlowCard key={s.label} glow={s.glow} delay={i * 0.05}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs text-theme-secondary">{s.label}</p>
                  <p className="mt-2 text-xl font-bold text-theme">
                    <AnimatedNumber value={s.value} decimals={s.decimals} suffix={s.suffix} />
                  </p>
                  {s.change !== null && (
                    <motion.p
                      initial={{ rotate: -90 }}
                      animate={{ rotate: 0 }}
                      className={`mt-1 flex items-center gap-0.5 text-xs ${s.change >= 0 ? "text-emerald-400" : "text-red-400"}`}
                    >
                      {s.change >= 0 ? <CaretUp size={12} weight="fill" /> : <CaretDown size={12} weight="fill" />}
                      {Math.abs(s.change)}% dari bulan lalu
                    </motion.p>
                  )}
                  {s.label === "Prediksi Terakhir" && data?.stats.latestPrediction && (
                    <p className="mt-0.5 text-[10px] text-muted">
                      {data.stats.latestPrediction.kode} &middot;{" "}
                      {new Date(data.stats.latestPrediction.tanggalPrediksi).toLocaleDateString("id-ID")}
                    </p>
                  )}
                </div>
                {(s.label === "Rata-rata Cakupan" || s.label === "Prediksi Terakhir") ? (
                  <ProgressRing
                    value={Math.min(s.value, 100)}
                    size={56}
                    strokeWidth={5}
                    color={s.glow === "emerald" ? "#10b981" : "#06b6d4"}
                  />
                ) : (
                  <div className={`rounded-lg p-2 ${
                    s.glow === "emerald" ? "bg-emerald-500/10 text-emerald-400" : "bg-cyan-500/10 text-cyan-400"
                  }`}>
                    <s.icon size={16} />
                  </div>
                )}
              </div>
            </GlowCard>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlowCard delay={0.1}>
          <h2 className="mb-4 text-lg font-semibold text-theme">Tren Cakupan ASI Eksklusif (48 Bulan)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.trend || []}>
                <defs>
                  <linearGradient id="cakupanGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="bulan"
                  tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                  interval={5}
                />
                <YAxis
                  tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
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

        <GlowCard delay={0.15}>
          <h2 className="mb-4 text-lg font-semibold text-theme">Distribusi Segmen per Tahun</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="tahun"
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  interval={0}
                />
                <YAxis
                  tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                  domain={[0, 24]}
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: unknown, name) => {
                    const label = name === "sangatBaik" ? "Sangat Baik" : name === "sedang" ? "Sedang" : "Rendah"
                    return [`${value} puskesmas`, label] as [string, string]
                  }}
                />
                <Legend
                  formatter={(value: string) => {
                    if (value === "sangatBaik") return "Sangat Baik"
                    if (value === "sedang") return "Sedang"
                    return "Rendah"
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="sangatBaik"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#10b981" }}
                  name="sangatBaik"
                />
                <Line
                  type="monotone"
                  dataKey="sedang"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#f59e0b" }}
                  name="sedang"
                />
                <Line
                  type="monotone"
                  dataKey="rendah"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#ef4444" }}
                  name="rendah"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlowCard>
      </div>

      <GlowCard delay={0.3}>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-theme">Daftar Puskesmas</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <MagnifyingGlass size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Cari puskesmas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 rounded-lg border border-theme bg-theme-secondary py-1.5 pl-9 pr-3 text-sm text-theme outline-none placeholder:text-muted focus:ring-1 focus:ring-emerald-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-theme">
                  <X size={14} />
                </button>
              )}
            </div>
            <select
              value={kecamatanFilter || ""}
              onChange={(e) => setKecamatanFilter(e.target.value || null)}
              className="rounded-lg border border-theme bg-theme-secondary px-3 py-1.5 text-sm text-theme outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Semua Kecamatan</option>
              {KECAMATAN_LIST.map((k) => (
                <option key={k.id} value={k.nama}>{k.nama}</option>
              ))}
            </select>
            <select
              value={tahunFilter}
              onChange={(e) => setTahunFilter(e.target.value)}
              className="rounded-lg border border-theme bg-theme-secondary px-3 py-1.5 text-sm text-theme outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Semua Tahun</option>
              {TAHUN_LIST.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { label: "Semua", value: null },
            { label: "Sangat Baik", value: "SANGAT_BAIK" },
            { label: "Sedang", value: "SEDANG" },
            { label: "Rendah", value: "RENDAH" },
          ].map((s) => (
            <button
              key={s.value || "all"}
              onClick={() => setSegmentFilter(s.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                segmentFilter === s.value
                  ? s.value === "SANGAT_BAIK"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : s.value === "SEDANG"
                    ? "bg-yellow-500/20 text-yellow-400"
                    : s.value === "RENDAH"
                    ? "bg-red-500/20 text-red-400"
                    : "bg-emerald-500/20 text-emerald-400"
                  : "bg-theme-secondary text-muted hover:text-theme"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="shimmer h-12 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-theme text-left text-theme-secondary">
                  <th className="pb-3 font-medium">Kode</th>
                  <th className="pb-3 font-medium">Puskesmas</th>
                  <th className="pb-3 font-medium">Kecamatan</th>
                  <th className="pb-3 font-medium">Segmen</th>
                  <th className="pb-3 font-medium">Rata-rata Cakupan</th>
                  <th className="pb-3 font-medium">Total Bayi</th>
                  <th className="pb-3 font-medium">Total ASI</th>
                  <th className="pb-3 font-medium">Bulan Data</th>
                  <th className="pb-3 font-medium">Prediksi</th>
                  <th className="pb-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredPuskesmasStats.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-sm text-muted">
                      Tidak ada puskesmas yang cocok dengan filter
                    </td>
                  </tr>
                ) : (
                  filteredPuskesmasStats.map((p, i) => {
                    const pred = data?.prediksiPerPkm.find((x) => x.kode === p.kode)
                    const pkmInfo = PUSKESMAS_LIST.find((x) => x.kode === p.kode)
                    const seg = getSegmen(p.rataCakupan)
                    const segmenLabel = seg === "SANGAT_BAIK" ? "Sangat Baik" : seg === "SEDANG" ? "Sedang" : "Rendah"
                    const segmenColor = seg === "SANGAT_BAIK" ? "text-emerald-400" : seg === "SEDANG" ? "text-yellow-400" : "text-red-400"
                    const segmenBg = seg === "SANGAT_BAIK" ? "bg-emerald-500/10" : seg === "SEDANG" ? "bg-yellow-500/10" : "bg-red-500/10"
                    return (
                      <motion.tr
                        key={p.kode}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.02, duration: 0.3 }}
                        className="border-b border-theme text-theme last:border-0 hover:shadow-[0_0_12px_rgba(16,185,129,0.05)] bg-hover-theme transition-colors"
                      >
                        <td className="py-3 font-medium">{p.kode}</td>
                        <td className="py-3 text-theme-secondary">{pkmInfo?.nama || "-"}</td>
                        <td className="py-3 text-muted">{pkmInfo?.kecamatan || "-"}</td>
                        <td className="py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${segmenBg} ${segmenColor}`}>
                            {segmenLabel}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full" style={{ backgroundColor: "var(--skeleton-base)" }}>
                              <div
                                className={`h-full rounded-full ${
                                  seg === "SANGAT_BAIK" ? "bg-emerald-500" : seg === "SEDANG" ? "bg-yellow-500" : "bg-red-500"
                                }`}
                                style={{ width: `${Math.min(p.rataCakupan, 100)}%` }}
                              />
                            </div>
                            <span className={segmenColor}>{p.rataCakupan}%</span>
                          </div>
                        </td>
                        <td className="py-3 text-theme-secondary">{p.totalBayi.toLocaleString()}</td>
                        <td className="py-3 text-theme-secondary">{p.totalASI.toLocaleString()}</td>
                        <td className="py-3 text-muted">{p.totalBulan}</td>
                        <td className="py-3">
                          {pred ? (
                            <span className="text-cyan-400">{pred.nilaiPrediksi.toFixed(2)}%</span>
                          ) : (
                            <span className="text-muted">-</span>
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
                              } catch {
                                toast("error", "Gagal memuat detail puskesmas")
                              }
                            }}
                            className="rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400 transition-colors hover:bg-emerald-500/20"
                          >
                            Detail
                          </a>
                        </td>
                      </motion.tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </GlowCard>

      <GlowCard delay={0.35}>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-theme">
          <FileArrowDown size={18} className="text-theme-secondary" />
          Riwayat Prediksi
        </h2>
        {data?.riwayatPrediksi && data.riwayatPrediksi.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-theme text-left text-theme-secondary">
                  <th className="pb-3 font-medium">Puskesmas</th>
                  <th className="pb-3 font-medium">Prediksi</th>
                  <th className="pb-3 font-medium">Waktu</th>
                </tr>
              </thead>
              <tbody>
                {data.riwayatPrediksi.map((p, i) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.02, duration: 0.3 }}
                    className="border-b border-theme text-theme last:border-0 bg-hover-theme transition-colors"
                  >
                    <td className="py-3">
                      <span className="text-muted">{p.kode}</span>{" "}
                      <span className="text-theme-secondary">{p.nama}</span>
                    </td>
                    <td className="py-3">
                      <span className="text-cyan-400">{p.nilaiPrediksi.toFixed(2)}%</span>
                    </td>
                    <td className="py-3 text-muted">
                      {new Date(p.createdAt).toLocaleString("id-ID")}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-2 py-8 text-center"
          >
            <Lightning size={32} className="text-muted" />
            <p className="text-sm text-muted">Belum ada riwayat prediksi</p>
            <p className="text-xs text-muted">Lakukan prediksi dari halaman Puskesmas untuk memulai</p>
          </motion.div>
        )}
      </GlowCard>

      <GlowCard delay={0.4}>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-theme">
          <Clock size={18} className="text-theme-secondary" />
          Aktivitas Upload Terakhir
        </h2>
        {data?.uploadLogs && data.uploadLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-theme text-left text-theme-secondary">
                  <th className="pb-3 font-medium">File</th>
                  <th className="pb-3 font-medium">Total</th>
                  <th className="pb-3 font-medium">Valid</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Waktu</th>
                </tr>
              </thead>
              <tbody>
                {data.uploadLogs.map((log) => (
                  <tr key={log.id} className="border-b border-theme text-theme last:border-0 bg-hover-theme transition-colors">
                    <td className="py-3 text-theme-secondary">{log.namaFile}</td>
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
                    <td className="py-3 text-muted">
                      {new Date(log.createdAt).toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-2 py-8 text-center"
          >
            <UploadSimple size={32} className="text-muted" />
            <p className="text-sm text-muted">Belum ada aktivitas upload</p>
            <p className="text-xs text-muted">Upload data bulanan untuk memulai prediksi</p>
          </motion.div>
        )}
      </GlowCard>
    </motion.div>
  )
}
