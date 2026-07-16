"use client"

import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import {
  FileCsv, FileJs, Download, FilePdf,
} from "@phosphor-icons/react/dist/ssr"
import { GlowCard } from "@/components/glow-card"
import { PdfReportContent } from "@/components/pdf-report-content"
import { generatePDF, formatDate } from "@/lib/pdf-report"

interface Puskesmas {
  id: number
  kode: string
  nama: string
}

interface HistoryRow {
  tanggal: string
  jumlahBayi6Bulan: number
  jumlahASIEksklusif: number
  persentaseCakupan: number | null
  puskesmas: { kode: string; nama: string }
}

export default function LaporanPage() {
  const [exporting, setExporting] = useState(false)
  const [data, setData] = useState<HistoryRow[]>([])
  const [puskesmasList, setPuskesmasList] = useState<Puskesmas[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/puskesmas")
        const list: Puskesmas[] = await res.json()
        setPuskesmasList(list)
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [])

  async function loadHistory() {
    const url = selectedId
      ? `/api/export?type=data&format=json&puskesmasId=${selectedId}`
      : "/api/export?type=data&format=json"
    const res = await fetch(url)
    if (!res.ok) return
    const rows = await res.json()
    setData(Array.isArray(rows) ? rows : [])
  }

  useEffect(() => { loadHistory() }, [selectedId])

  const totalBayi = data.reduce((s, r) => s + r.jumlahBayi6Bulan, 0)
  const totalASI = data.reduce((s, r) => s + r.jumlahASIEksklusif, 0)
  const rataCakupan = data.length > 0 ? data.reduce((s, r) => s + (r.persentaseCakupan ?? 0), 0) / data.length : 0

  const byMonth: Record<string, { sum: number; count: number }> = {}
  for (const r of data) {
    const key = r.tanggal.slice(0, 7)
    if (!byMonth[key]) byMonth[key] = { sum: 0, count: 0 }
    byMonth[key].sum += r.persentaseCakupan ?? 0
    byMonth[key].count++
  }

  const monthlyComparison = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bulan, v], i, arr) => {
      const cakupan = v.sum / v.count
      const prev = i > 0 ? arr[i - 1][1].sum / arr[i - 1][1].count : cakupan
      return { bulan, cakupan: +cakupan.toFixed(2), delta: +(cakupan - prev).toFixed(2) }
    })

  const byKode: Record<string, { sum: number; count: number; min: number; max: number }> = {}
  for (const r of data) {
    if (!byKode[r.puskesmas.kode]) byKode[r.puskesmas.kode] = { sum: 0, count: 0, min: 999, max: 0 }
    byKode[r.puskesmas.kode].sum += r.persentaseCakupan ?? 0
    byKode[r.puskesmas.kode].count++
    byKode[r.puskesmas.kode].min = Math.min(byKode[r.puskesmas.kode].min, r.persentaseCakupan ?? 0)
    byKode[r.puskesmas.kode].max = Math.max(byKode[r.puskesmas.kode].max, r.persentaseCakupan ?? 0)
  }

  const pkmRata = Object.entries(byKode)
    .map(([kode, v]) => ({ kode, rata: v.sum / v.count, min: v.min, max: v.max }))
    .sort((a, b) => a.rata - b.rata)

  const pkmTerendah = pkmRata.slice(0, 3)
  const pkmTertinggi = pkmRata.slice(-3).reverse()

  const latestMonth = monthlyComparison[monthlyComparison.length - 1]
  const firstMonth = monthlyComparison[0]
  const totalDelta = latestMonth && firstMonth ? latestMonth.cakupan - firstMonth.cakupan : 0

  const narrativeInterpretation = (() => {
    const lines: string[] = []
    const selectedNama = selectedId
      ? puskesmasList.find((p) => String(p.id) === selectedId)?.nama || `PKM ID ${selectedId}`
      : "seluruh Puskesmas"

    lines.push(`Laporan ini mencakup data dari ${selectedNama}. ` +
      `Rata-rata cakupan ASI Eksklusif selama periode pelaporan adalah ${rataCakupan.toFixed(2)}%.`)

    if (monthlyComparison.length >= 2) {
      const trend = totalDelta >= 0 ? "mengalami peningkatan" : "mengalami penurunan"
      lines.push(`Secara keseluruhan, tren cakupan ${trend} sebesar ${Math.abs(totalDelta).toFixed(2)}% ` +
        `dari ${firstMonth?.bulan} (${firstMonth?.cakupan.toFixed(2)}%) ke ${latestMonth?.bulan} (${latestMonth?.cakupan.toFixed(2)}%).`)
    }

    if (pkmTerendah.length > 0 && !selectedId) {
      lines.push(`Puskesmas dengan rata-rata cakupan terendah adalah ${pkmTerendah.map(p => `${p.kode} (${p.rata.toFixed(2)}%)`).join(", ")}. ` +
        `Sementara yang tertinggi adalah ${pkmTertinggi.map(p => `${p.kode} (${p.rata.toFixed(2)}%)`).join(", ")}.`)
    }

    return lines.join("\n")
  })()

  const recommendations: string[] = []
  if (!selectedId) {
    for (const p of pkmTerendah) {
      if (p.rata < 60) {
        recommendations.push(
          `${p.kode} memiliki rata-rata cakupan ${p.rata.toFixed(2)}% (di bawah 60%). ` +
          `Rekomendasi: Evaluasi program KIE ASI Eksklusif, optimalkan kunjungan rumah, ` +
          `dan perkuat peran kader di wilayah ${p.kode}.`
        )
      } else if (p.rata < 75) {
        recommendations.push(
          `${p.kode} memiliki rata-rata cakupan ${p.rata.toFixed(2)}%. ` +
          `Rekomendasi: Tingkatkan sosialisasi ASI Eksklusif di kelas ibu hamil ` +
          `dan optimalisasi posyandu.`
        )
      } else {
        recommendations.push(
          `${p.kode} memiliki rata-rata cakupan ${p.rata.toFixed(2)}% (cukup baik). ` +
          `Rekomendasi: Pertahankan strategi yang sudah berjalan dan lakukan ` +
          `pendampingan ke Puskesmas dengan cakupan lebih rendah.`
        )
      }
    }
    for (const p of pkmTertinggi.slice(0, 1)) {
      recommendations.push(
        `${p.kode} mencapai cakupan tertinggi ${p.rata.toFixed(2)}%. ` +
        `Identifikasi praktik baik (best practice) yang diterapkan untuk direplikasi ke Puskesmas lain.`
      )
    }
    if (monthlyComparison.length >= 2) {
      const bulanTurun = monthlyComparison.filter(m => m.delta < 0).slice(0, 2)
      for (const m of bulanTurun) {
        recommendations.push(
          `Pada ${m.bulan} terjadi penurunan cakupan sebesar ${Math.abs(m.delta).toFixed(2)}%. ` +
          `Evaluasi faktor penyebab (cuaca, libur nasional, keterbatasan tenaga) dan ` +
          `siapkan strategi mitigasi untuk periode serupa.`
        )
      }
    }
  } else {
    const pkm = pkmRata[0]
    if (pkm) {
      if (pkm.rata < 60) {
        recommendations.push(
          `Cakupan ${pkm.kode} tergolong rendah (${pkm.rata.toFixed(2)}%). ` +
          `Rekomendasi: Lakukan root cause analysis, perkuat konseling laktasi, ` +
          `dan aktifkan kelompok pendukung ASI (KP-ASI) di wilayah kerja.`
        )
      } else if (pkm.rata < 75) {
        recommendations.push(
          `Cakupan ${pkm.kode} berada di level menengah (${pkm.rata.toFixed(2)}%). ` +
          `Rekomendasi: Tingkatkan frekuensi penyuluhan dan pelatihan kader tentang ` +
          `manajemen laktasi.`
        )
      } else {
        recommendations.push(
          `Cakupan ${pkm.kode} sudah baik (${pkm.rata.toFixed(2)}%). ` +
          `Rekomendasi: Pertahankan capaian dan dokumentasikan strategi sukses sebagai ` +
          `bahan pembelajaran Puskesmas lain.`
        )
      }
    }
  }

  const reportData = {
    title: "Laporan Data & Prediksi ASI Eksklusif",
    puskesmasName: selectedId
      ? puskesmasList.find((p) => String(p.id) === selectedId)?.nama
      : "Semua Puskesmas",
    stats: [
      { label: "Total Puskesmas", value: selectedId ? 1 : puskesmasList.length },
      { label: "Total Baris Data", value: data.length },
      { label: "Rata-rata Cakupan", value: `${rataCakupan.toFixed(2)}%` },
      { label: "Total Bayi", value: totalBayi.toLocaleString() },
      { label: "Total ASI Eksklusif", value: totalASI.toLocaleString() },
      { label: "Periode Data", value: data.length > 0
        ? `${data[0].tanggal.slice(0, 7)} s/d ${data[data.length - 1].tanggal.slice(0, 7)}`
        : "-" },
    ],
    tableHeaders: ["Puskesmas", "Tanggal", "Bayi 6B", "ASI Eksklusif", "Cakupan"],
    tableRows: data.map((r) => [
      r.puskesmas?.kode ?? "-",
      r.tanggal.slice(0, 10),
      r.jumlahBayi6Bulan,
      r.jumlahASIEksklusif,
      r.persentaseCakupan != null ? `${r.persentaseCakupan.toFixed(2)}%` : "-",
    ]),
    chartData: data.slice(-24).map((r) => ({
      label: r.tanggal.slice(0, 7),
      value: r.jumlahBayi6Bulan,
      value2: r.jumlahASIEksklusif,
    })),
    narrativeInterpretation,
    recommendations,
    monthlyComparison,
    showSignature: true,
    letterhead: {
      institution: "PEMERINTAH KOTA/KABUPATEN",
      subInstitution: "DINAS KESEHATAN",
      address: "Jl. Kesehatan No. 1",
      city: "Indonesia",
    },
  }

  async function handleExport(type: "data" | "prediksi", format: "csv" | "json") {
    setExporting(true)
    try {
      const params = new URLSearchParams({ type, format })
      if (selectedId) params.set("puskesmasId", selectedId)
      const res = await fetch(`/api/export?${params}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${type}_laporan.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* ignore */ }
    setExporting(false)
  }

  async function handlePDF() {
    setExporting(true)
    await generatePDF("pdf-report", `laporan_asi_eksklusif.pdf`)
    setExporting(false)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-theme">Laporan</h1>
        <p className="mt-1 text-sm text-theme-secondary">Export data & hasil prediksi ke CSV, JSON, atau PDF</p>
      </div>

      <GlowCard>
        <div className="mb-4 flex items-center gap-4">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs text-theme-secondary">Filter Puskesmas</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-lg border border-theme bg-theme-secondary px-3 py-2 text-sm text-theme outline-none focus:ring-emerald-500"
            >
              <option value="">Semua Puskesmas</option>
              {puskesmasList.map((p) => (
                <option key={p.id} value={p.id}>{p.kode} - {p.nama}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handlePDF}
            disabled={exporting || data.length === 0}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white transition-all hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50"
          >
            <FilePdf size={18} weight="fill" />
            {exporting ? "Memproses..." : "Download PDF"}
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleExport("data", "csv")}
            disabled={exporting}
            className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
          ><Download size={16} /> CSV Data</button>
          <button
            onClick={() => handleExport("data", "json")}
            disabled={exporting}
            className="flex items-center gap-2 rounded-lg bg-cyan-500/10 px-4 py-2 text-sm text-cyan-400 transition-colors hover:bg-cyan-500/20 disabled:opacity-50"
          ><FileJs size={16} /> JSON Data</button>
          <button
            onClick={() => handleExport("prediksi", "csv")}
            disabled={exporting}
            className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
          ><Download size={16} /> CSV Prediksi</button>
        </div>
      </GlowCard>

      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        <PdfReportContent data={reportData} reportRef={reportRef as React.RefObject<HTMLDivElement | null>} />
      </div>
    </motion.div>
  )
}
