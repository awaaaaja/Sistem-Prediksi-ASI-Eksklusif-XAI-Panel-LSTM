"use client"

import { useState, useRef } from "react"
import { motion } from "framer-motion"
import {
  CloudArrowUp, FileCsv, CheckCircle, Spinner,
  Database, ArrowRight, WarningCircle,
} from "@phosphor-icons/react/dist/ssr"
import { GlowCard } from "@/components/glow-card"
import Link from "next/link"

interface UploadRow {
  Kode_Puskesmas: string
  Tanggal: string
  Jumlah_Bayi_6_Bulan: number
  Jumlah_ASI_Eksklusif: number
}

interface UploadResult {
  success: boolean
  inserted: number
  errors: string[]
  logId: number
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<UploadRow[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setUploadResult(null)
    setErrors([])

    setPreviewLoading(true)
    try {
      const fd = new FormData()
      fd.append("file", f)
      const res = await fetch("/api/data/upload?action=preview", {
        method: "POST",
        body: fd,
      })
      const data = await res.json()
      if (data.success) {
        setErrors(data.errors || [])
        setParsedRows(data.sampleRows || [])
      } else {
        setErrors([data.error || "Gagal preview file"])
      }
    } catch {
      setErrors(["Gagal membaca file"])
    }
    setPreviewLoading(false)
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/data/upload", {
        method: "POST",
        body: fd,
      })
      const data: UploadResult = await res.json()
      setUploadResult(data)
    } catch {
      setUploadResult({ success: false, inserted: 0, errors: ["Gagal menghubungi server"], logId: 0 })
    }
    setUploading(false)
  }

  const kodes = [...new Set(parsedRows.map((r) => r.Kode_Puskesmas))]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Upload Data</h1>
        <p className="mt-1 text-sm text-dark-400">
          Upload file CSV &rarr; Preview &rarr; Simpan ke Database &rarr; Prediksi
        </p>
      </div>

      <GlowCard>
        <div
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-dark-600 py-12 transition-colors hover:border-emerald-500/50"
        >
          <CloudArrowUp size={40} className="mb-3 text-dark-400" />
          <p className="text-sm text-dark-300">
            {file ? file.name : "Klik untuk pilih file CSV"}
          </p>
          <p className="mt-1 text-xs text-dark-500">
            Format: Kode_Puskesmas, Tanggal, Jumlah_Bayi_6_Bulan, Jumlah_ASI_Eksklusif
          </p>
          <input ref={inputRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
        </div>
      </GlowCard>

      {previewLoading && (
        <GlowCard>
          <div className="flex items-center justify-center gap-3 py-8">
            <Spinner size={24} className="animate-spin text-emerald-400" />
            <p className="text-sm text-dark-300">Memvalidasi file...</p>
          </div>
        </GlowCard>
      )}

      {file && !previewLoading && !uploadResult && (
        <>
          <GlowCard>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileCsv size={24} className="text-emerald-400" />
                <div>
                  <p className="font-medium text-white">
                    {kodes.length} Puskesmas &middot; {parsedRows.length} baris valid
                  </p>
                  {errors.length > 0 && (
                    <p className="text-xs text-red-400">{errors.length} error</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white transition-all hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50"
              >
                {uploading ? (
                  <Spinner size={18} className="animate-spin" />
                ) : (
                  <Database size={18} />
                )}
                {uploading ? "Menyimpan..." : "Upload ke Database"}
              </button>
            </div>

            {parsedRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-left text-dark-400">
                      <th className="pb-2 font-medium">Kode</th>
                      <th className="pb-2 font-medium">Tanggal</th>
                      <th className="pb-2 font-medium">Bayi 6B</th>
                      <th className="pb-2 font-medium">ASI Eksklusif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, i) => (
                      <tr key={i} className="border-b border-white/5 text-white last:border-0">
                        <td className="py-2">{row.Kode_Puskesmas}</td>
                        <td className="py-2">{row.Tanggal}</td>
                        <td className="py-2">{row.Jumlah_Bayi_6_Bulan}</td>
                        <td className="py-2">{row.Jumlah_ASI_Eksklusif}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {errors.length > 0 && (
              <div className="mt-4 rounded-lg bg-red-500/10 p-3">
                <p className="mb-1 text-xs font-medium text-red-400">Errors:</p>
                {errors.slice(0, 5).map((err, i) => (
                  <p key={i} className="text-xs text-red-300">{err}</p>
                ))}
              </div>
            )}
          </GlowCard>
        </>
      )}

      {uploadResult && (
        <>
          <GlowCard glow={uploadResult.success ? "emerald" : "none"}>
            <div className="flex items-center gap-4">
              {uploadResult.success ? (
                <CheckCircle size={28} className="text-emerald-400" />
              ) : (
                <WarningCircle size={28} className="text-red-400" />
              )}
              <div>
                <p className="font-semibold text-white">
                  {uploadResult.success ? "Upload Berhasil" : "Upload Sebagian Gagal"}
                </p>
                <p className="text-sm text-dark-400">
                  {uploadResult.inserted} baris tersimpan
                  {uploadResult.errors.length > 0 && `, ${uploadResult.errors.length} error`}
                </p>
              </div>
            </div>
          </GlowCard>

          <GlowCard>
            <h2 className="mb-4 text-lg font-semibold text-white">Puskesmas Terupload</h2>
            <div className="space-y-2">
              {kodes.map((kode) => (
                <Link
                  key={kode}
                  href={`/puskesmas/${encodeURIComponent(kode)}`}
                  className="flex items-center justify-between rounded-lg border border-white/5 px-4 py-3 transition-colors hover:border-emerald-500/30 hover:bg-white/[0.02]"
                >
                  <span className="text-sm font-medium text-white">{kode}</span>
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    Lihat Detail <ArrowRight size={14} />
                  </span>
                </Link>
              ))}
            </div>
          </GlowCard>
        </>
      )}
    </motion.div>
  )
}
