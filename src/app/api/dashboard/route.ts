import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const [puskesmasCount, dataCount, prediksiCount, uploadLogs, allData, recentPrediksi, allPrediksi] = await Promise.all([
    prisma.puskesmas.count({ where: { aktif: true } }),
    prisma.dataBulanan.count(),
    prisma.prediksi.count(),
    prisma.uploadLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.dataBulanan.findMany({
      orderBy: { tanggal: "asc" },
      include: { puskesmas: { select: { kode: true, nama: true } } },
    }),
    prisma.prediksi.findMany({
      orderBy: { createdAt: "desc" },
      take: 24,
      include: { puskesmas: { select: { kode: true, nama: true } } },
    }),
    prisma.prediksi.findMany({
      orderBy: [{ puskesmasId: "asc" }, { createdAt: "desc" }],
      distinct: ["puskesmasId"],
      include: { puskesmas: { select: { kode: true, nama: true } } },
    }),
  ])

  const monthlyTrend: Record<string, { total: number; count: number }> = {}
  const puskesmasMap: Record<string, { total: number; count: number; totalBayi: number; totalASI: number }> = {}
  for (const d of allData) {
    const key = d.tanggal.toISOString().slice(0, 7)
    if (!monthlyTrend[key]) monthlyTrend[key] = { total: 0, count: 0 }
    const pct = d.jumlahBayi6Bulan > 0 ? (d.jumlahASIEksklusif / d.jumlahBayi6Bulan) * 100 : 0
    monthlyTrend[key].total += pct
    monthlyTrend[key].count++

    if (!puskesmasMap[d.puskesmas.kode]) {
      puskesmasMap[d.puskesmas.kode] = { total: 0, count: 0, totalBayi: 0, totalASI: 0 }
    }
    puskesmasMap[d.puskesmas.kode].total += pct
    puskesmasMap[d.puskesmas.kode].count++
    puskesmasMap[d.puskesmas.kode].totalBayi += d.jumlahBayi6Bulan
    puskesmasMap[d.puskesmas.kode].totalASI += d.jumlahASIEksklusif
  }

  const trend = Object.entries(monthlyTrend)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bulan, v]) => ({
      bulan,
      rataCakupan: +(v.total / v.count).toFixed(2),
      totalPuskesmas: v.count,
    }))

  const avgCakupan = allData.length > 0
    ? +(allData.reduce((s, d) => s + (d.jumlahBayi6Bulan > 0 ? (d.jumlahASIEksklusif / d.jumlahBayi6Bulan) * 100 : 0), 0) / allData.length).toFixed(2)
    : 0

  const latestMonth = trend.length > 0 ? trend[trend.length - 1] : null
  const prevMonth = trend.length > 1 ? trend[trend.length - 2] : null
  const trendCakupan = prevMonth && latestMonth
    ? +((latestMonth.rataCakupan - prevMonth.rataCakupan) / prevMonth.rataCakupan * 100).toFixed(1)
    : 0

  const latestPrediction = recentPrediksi.length > 0 ? recentPrediksi[0] : null

  const puskesmasStats = Object.entries(puskesmasMap)
    .map(([kode, v]) => ({
      kode,
      rataCakupan: +(v.total / v.count).toFixed(2),
      totalBayi: v.totalBayi,
      totalASI: v.totalASI,
      totalBulan: v.count,
    }))
    .sort((a, b) => b.rataCakupan - a.rataCakupan)

  const prediksiPerPkm = allPrediksi.map((p) => ({
    kode: p.puskesmas.kode,
    nama: p.puskesmas.nama,
    nilaiPrediksi: p.nilaiPrediksi,
    tanggalPrediksi: p.createdAt.toISOString(),
  }))

  return NextResponse.json({
    stats: {
      totalPuskesmas: puskesmasCount,
      totalDataBulanan: dataCount,
      totalPrediksi: prediksiCount,
      rataCakupan: avgCakupan,
      trendCakupan: trendCakupan,
      latestPrediction: latestPrediction ? {
        kode: latestPrediction.puskesmas.kode,
        nama: latestPrediction.puskesmas.nama,
        nilaiPrediksi: latestPrediction.nilaiPrediksi,
        tanggalPrediksi: latestPrediction.createdAt.toISOString(),
      } : null,
    },
    trend,
    puskesmasStats,
    prediksiPerPkm,
    uploadLogs: uploadLogs.map((l) => ({
      id: l.id,
      namaFile: l.namaFile,
      totalBaris: l.totalBaris,
      barisValid: l.barisValid,
      status: l.status,
      createdAt: l.createdAt.toISOString(),
    })),
  })
}
