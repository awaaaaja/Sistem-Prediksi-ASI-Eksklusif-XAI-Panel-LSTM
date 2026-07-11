"use client"

import { useRef } from "react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts"
import { formatDate } from "@/lib/pdf-report"

interface ReportData {
  title: string
  puskesmasName?: string
  stats: { label: string; value: string | number }[]
  tableHeaders: string[]
  tableRows: (string | number)[][]
  chartData?: { label: string; value: number; value2?: number }[]
  prediction?: number
  shapSummary?: { feature: string; impact: number }[]
  narrativeInterpretation?: string
  recommendations?: string[]
  monthlyComparison?: { bulan: string; cakupan: number; delta: number }[]
  showSignature?: boolean
  letterhead?: {
    institution: string
    subInstitution?: string
    address: string
    city: string
  }
}

export function PdfReportContent({ data, reportRef }: { data: ReportData; reportRef: React.RefObject<HTMLDivElement | null> }) {
  const ins = data.letterhead?.institution || "PEMERINTAH KOTA/KABUPATEN"
  const sub = data.letterhead?.subInstitution || "DINAS KESEHATAN"
  const addr = data.letterhead?.address || "Jl. Kesehatan No. 1"
  const city = data.letterhead?.city || "Indonesia"

  const totalNaik = data.monthlyComparison?.filter((m) => m.delta > 0).length || 0
  const totalTurun = data.monthlyComparison?.filter((m) => m.delta < 0).length || 0

  return (
    <div
      ref={reportRef}
      id="pdf-report"
      style={{
        background: "#ffffff",
        color: "#1e293b",
        padding: "40px 36px",
        fontFamily: "Times New Roman, serif",
        width: "800px",
        fontSize: 12,
        lineHeight: 1.6,
      }}
    >
      {/* ===== KOP SURAT ===== */}
      <div style={{ textAlign: "center", marginBottom: 20, borderBottom: "3px solid #1e3a5f", paddingBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 4 }}>
          <div style={{
            width: 50, height: 50, borderRadius: "50%",
            background: "linear-gradient(135deg, #1e3a5f, #2563eb)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 22, fontWeight: 700, flexShrink: 0,
          }}>K</div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e3a5f", letterSpacing: 1 }}>{ins}</p>
            <p style={{ fontSize: 18, fontWeight: 700, margin: "2px 0", color: "#2563eb", letterSpacing: 2 }}>{sub}</p>
          </div>
        </div>
        <p style={{ fontSize: 10, margin: "4px 0 0", color: "#475569" }}>{addr} &middot; {city}</p>
        <p style={{ fontSize: 9, margin: 0, color: "#64748b" }}>Telp: (021) 1234567 &middot; Email: dinkes@example.go.id</p>
      </div>

      {/* ===== NOMOR & JUDUL ===== */}
      <div style={{ marginBottom: 20 }}>
        <table style={{ width: "100%", fontSize: 11 }}>
          <tbody>
            <tr><td style={{ width: 120, color: "#475569" }}>Nomor</td><td>: {`420/${new Date().getFullYear()}-Binkesmas`}</td></tr>
            <tr><td style={{ color: "#475569" }}>Lampiran</td><td>: 1 (satu) berkas</td></tr>
            <tr><td style={{ color: "#475569" }}>Perihal</td><td>: <strong>{data.title}</strong></td></tr>
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 11, color: "#475569", marginBottom: 20, textAlign: "justify" }}>
        Bersama ini kami sampaikan laporan data dan prediksi cakupan ASI Eksklusif
        {data.puskesmasName ? ` untuk ${data.puskesmasName}` : " seluruh Puskesmas"}
        . Laporan ini memuat data historis, hasil prediksi model LSTM, analisis
        SHAP (SHapley Additive exPlanations), serta rekomendasi tindak lanjut.
      </p>

      {/* ===== RINGKASAN ===== */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", margin: "0 0 8px", borderBottom: "1px solid #cbd5e1", paddingBottom: 4 }}>
          A. Ringkasan Data
        </h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <tbody>
            {data.stats.map((s) => (
              <tr key={s.label}>
                <td style={{ width: 180, padding: "3px 8px", color: "#475569", borderBottom: "1px solid #f1f5f9" }}>{s.label}</td>
                <td style={{ padding: "3px 8px", fontWeight: 600, borderBottom: "1px solid #f1f5f9" }}>{s.value}</td>
              </tr>
            ))}
            {data.monthlyComparison && data.monthlyComparison.length > 0 && (
              <>
                <tr>
                  <td style={{ padding: "3px 8px", color: "#475569", borderBottom: "1px solid #f1f5f9" }}>Bulan Naik</td>
                  <td style={{ padding: "3px 8px", fontWeight: 600, color: "#16a34a", borderBottom: "1px solid #f1f5f9" }}>{totalNaik} bulan</td>
                </tr>
                <tr>
                  <td style={{ padding: "3px 8px", color: "#475569", borderBottom: "1px solid #f1f5f9" }}>Bulan Turun</td>
                  <td style={{ padding: "3px 8px", fontWeight: 600, color: "#dc2626", borderBottom: "1px solid #f1f5f9" }}>{totalTurun} bulan</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* ===== INTERPRETASI ===== */}
      {data.narrativeInterpretation && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", margin: "0 0 8px", borderBottom: "1px solid #cbd5e1", paddingBottom: 4 }}>
            B. Interpretasi Hasil
          </h3>
          <div style={{
            background: "#f0fdf4", border: "1px solid #bbf7d0",
            borderRadius: 6, padding: "10px 14px", fontSize: 11, color: "#166534", lineHeight: 1.7,
          }}>
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{data.narrativeInterpretation}</p>
          </div>
        </div>
      )}

      {/* ===== PREDIKSI ===== */}
      {data.prediction !== undefined && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            background: "linear-gradient(135deg, #1e3a5f, #2563eb)", borderRadius: 6,
            padding: "12px 20px", color: "#fff",
          }}>
            <p style={{ fontSize: 10, margin: 0, opacity: 0.8 }}>Prediksi Cakupan ASI Eksklusif</p>
            <p style={{ fontSize: 26, fontWeight: 700, margin: "4px 0 0" }}>
              {(data.prediction * 100).toFixed(2)}%
            </p>
          </div>
        </div>
      )}

      {/* ===== SHAP ===== */}
      {data.shapSummary && data.shapSummary.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", margin: "0 0 8px", borderBottom: "1px solid #cbd5e1", paddingBottom: 4 }}>
            C. Analisis SHAP — Feature Impact
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: "2px solid #cbd5e1", color: "#475569" }}>Fitur</th>
                <th style={{ padding: "6px 10px", textAlign: "right", borderBottom: "2px solid #cbd5e1", color: "#475569" }}>Rata-rata Dampak</th>
                <th style={{ padding: "6px 10px", textAlign: "center", borderBottom: "2px solid #cbd5e1", color: "#475569" }}>Pengaruh</th>
              </tr>
            </thead>
            <tbody>
              {data.shapSummary.map((s) => (
                <tr key={s.feature}>
                  <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", fontWeight: 600 }}>{s.feature}</td>
                  <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontWeight: 600 }}>
                    {(s.impact * 100).toFixed(2)}%
                  </td>
                  <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", textAlign: "center" }}>
                    <span style={{
                      display: "inline-block", padding: "1px 10px", borderRadius: 10,
                      fontSize: 10, fontWeight: 600,
                      color: s.impact >= 0 ? "#166534" : "#991b1b",
                      background: s.impact >= 0 ? "#dcfce7" : "#fee2e2",
                    }}>
                      {s.impact >= 0 ? "POSITIF" : "NEGATIF"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== GRAFIK ===== */}
      {data.chartData && data.chartData.length > 0 && (
        <div style={{ marginBottom: 20, height: 210 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", margin: "0 0 8px", borderBottom: "1px solid #cbd5e1", paddingBottom: 4 }}>
            D. Grafik Tren Data Historis
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} interval={5} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, color: "#1e293b", fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={false} name="Bayi 6 Bulan" />
              {data.chartData[0]?.value2 !== undefined && (
                <Line type="monotone" dataKey="value2" stroke="#06b6d4" strokeWidth={2} dot={false} name="ASI Eksklusif" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ===== PERBANDINGAN BULAN KE BULAN ===== */}
      {data.monthlyComparison && data.monthlyComparison.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", margin: "0 0 8px", borderBottom: "1px solid #cbd5e1", paddingBottom: 4 }}>
            E. Perbandingan Bulan ke Bulan
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: "2px solid #cbd5e1", color: "#475569" }}>Bulan</th>
                <th style={{ padding: "6px 10px", textAlign: "right", borderBottom: "2px solid #cbd5e1", color: "#475569" }}>Rata-rata Cakupan</th>
                <th style={{ padding: "6px 10px", textAlign: "right", borderBottom: "2px solid #cbd5e1", color: "#475569" }}>Delta</th>
                <th style={{ padding: "6px 10px", textAlign: "center", borderBottom: "2px solid #cbd5e1", color: "#475569" }}>Tren</th>
              </tr>
            </thead>
            <tbody>
              {data.monthlyComparison.map((m) => (
                <tr key={m.bulan}>
                  <td style={{ padding: "4px 10px", borderBottom: "1px solid #f1f5f9" }}>{m.bulan}</td>
                  <td style={{ padding: "4px 10px", borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>{m.cakupan.toFixed(2)}%</td>
                  <td style={{
                    padding: "4px 10px", borderBottom: "1px solid #f1f5f9", textAlign: "right",
                    color: m.delta >= 0 ? "#16a34a" : "#dc2626", fontWeight: 600,
                  }}>
                    {m.delta >= 0 ? "+" : ""}{m.delta.toFixed(2)}%
                  </td>
                  <td style={{ padding: "4px 10px", borderBottom: "1px solid #f1f5f9", textAlign: "center", fontSize: 16 }}>
                    {m.delta > 0 ? "\u2191" : m.delta < 0 ? "\u2193" : "\u2192"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== DATA DETAIL ===== */}
      <div style={{ marginBottom: 20, pageBreakInside: "avoid" }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", margin: "0 0 8px", borderBottom: "1px solid #cbd5e1", paddingBottom: 4 }}>
          F. Data Detail
        </h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {data.tableHeaders.map((h) => (
                <th key={h} style={{ padding: "5px 6px", textAlign: "left", borderBottom: "2px solid #cbd5e1", color: "#475569", fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.tableRows.slice(0, 25).map((row, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                {row.map((cell, j) => (
                  <td key={j} style={{ padding: "4px 6px", color: "#1e293b" }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.tableRows.length > 25 && (
          <p style={{ fontSize: 10, color: "#64748b", marginTop: 6, fontStyle: "italic" }}>
            * Menampilkan 25 dari {data.tableRows.length} baris
          </p>
        )}
      </div>

      {/* ===== REKOMENDASI ===== */}
      {data.recommendations && data.recommendations.length > 0 && (
        <div style={{ marginBottom: 24, pageBreakInside: "avoid" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", margin: "0 0 8px", borderBottom: "1px solid #cbd5e1", paddingBottom: 4 }}>
            G. Rekomendasi Tindak Lanjut
          </h3>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 11, color: "#334155", lineHeight: 1.8 }}>
            {data.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
        </div>
      )}

      {/* ===== VALIDASI / TANDA TANGAN ===== */}
      {data.showSignature !== false && (
        <div style={{ marginTop: 20, pageBreakInside: "avoid" }}>
          <p style={{ fontSize: 11, color: "#475569", textAlign: "right" }}>
            {city}, {formatDate()}
          </p>
          <p style={{ fontSize: 11, color: "#475569", textAlign: "right", marginTop: 4 }}>
            Mengetahui,
          </p>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#1e3a5f", textAlign: "right", marginTop: 2 }}>
            Kepala Dinas Kesehatan
          </p>
          <div style={{ marginTop: 48, marginBottom: 4, textAlign: "right" }}>
            <div style={{
              display: "inline-block",
              borderBottom: "2px solid #1e3a5f",
              minWidth: 200,
              padding: "4px 0",
              fontSize: 12,
              fontWeight: 600,
              color: "#1e293b",
            }}>
              ( dr. Nama Lengkap, Sp.A )
            </div>
          </div>
          <p style={{ fontSize: 11, color: "#475569", textAlign: "right", margin: 0 }}>
            NIP. 19700101 200012 1 001
          </p>
          <div style={{ marginTop: 12, padding: "8px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4 }}>
            <p style={{ fontSize: 9, color: "#94a3b8", margin: 0, fontStyle: "italic" }}>
              Dokumen ini dicetak secara otomatis dari Sistem Prediksi ASI Eksklusif + XAI Panel LSTM.
              {data.prediction !== undefined && ` Prediksi: ${(data.prediction * 100).toFixed(2)}%.`}
              Berlaku tanpa tanda tangan basah.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
