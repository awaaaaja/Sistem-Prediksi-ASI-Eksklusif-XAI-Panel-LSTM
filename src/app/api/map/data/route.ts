import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function getSegmen(nilai: number | null): "SANGAT_BAIK" | "SEDANG" | "RENDAH" {
  if (nilai === null || nilai === undefined) return "RENDAH"
  if (nilai >= 80) return "SANGAT_BAIK"
  if (nilai >= 60) return "SEDANG"
  return "RENDAH"
}

export async function GET() {
  // Ambil semua puskesmas + kecamatan
  const puskesmasList = await prisma.puskesmas.findMany({
    include: { kecamatan: true },
    orderBy: { kode: "asc" },
  })

  const kecamatanList = await prisma.kecamatan.findMany({
    orderBy: { nama: "asc" },
  })

  // Ambil data terbaru per puskesmas untuk segmen
  const latestDataPerPkm = await prisma.$queryRawUnsafe<{
    puskesmas_id: number
    rata_cakupan: number
  }[]>(`
    SELECT d.puskesmas_id, AVG(d.persentase_cakupan) as rata_cakupan
    FROM data_bulanan d
    INNER JOIN (
      SELECT puskesmas_id, MAX(tanggal) as max_tgl
      FROM data_bulanan
      GROUP BY puskesmas_id
    ) latest ON d.puskesmas_id = latest.puskesmas_id
      AND d.tanggal >= DATE_SUB(latest.max_tgl, INTERVAL 3 MONTH)
    GROUP BY d.puskesmas_id
  `)

  const cakupanMap = new Map<number, number>()
  for (const row of latestDataPerPkm) {
    cakupanMap.set(row.puskesmas_id, row.rata_cakupan)
  }

  // Hitung rata-rata per kecamatan
  const kecamatanCakupan: Record<number, { total: number; count: number }> = {}
  for (const p of puskesmasList) {
    if (!p.kecamatanId) continue
    if (!kecamatanCakupan[p.kecamatanId]) {
      kecamatanCakupan[p.kecamatanId] = { total: 0, count: 0 }
    }
    const val = cakupanMap.get(p.id)
    if (val !== undefined) {
      kecamatanCakupan[p.kecamatanId].total += val
      kecamatanCakupan[p.kecamatanId].count++
    }
  }

  // Build GeoJSON Puskesmas
  const puskesmasFeatures = puskesmasList
    .filter((p) => p.latitude && p.longitude)
    .map((p) => {
      const cakupan = cakupanMap.get(p.id)
      return {
        type: "Feature" as const,
        properties: {
          id: p.id,
          nama: p.nama,
          kode: p.kode,
          kecamatan: p.kecamatan?.nama ?? "",
          rata_cakupan: cakupan ?? null,
          segmen: getSegmen(cakupan ?? null),
          alamat: p.alamat,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [p.longitude!, p.latitude!],
        },
      }
    })

  // Build GeoJSON Kecamatan (marker di tengah kecamatan)
  const kecamatanFeatures = kecamatanList
    .filter((k) => k.latitude && k.longitude)
    .map((k) => {
      const ck = kecamatanCakupan[k.id]
      const avg = ck ? ck.total / ck.count : null
      return {
        type: "Feature" as const,
        properties: {
          id: k.id,
          nama: k.nama,
          rata_cakupan: avg,
          segmen: getSegmen(avg),
          puskesmas_count: puskesmasList.filter((p) => p.kecamatanId === k.id).length,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [k.longitude!, k.latitude!],
        },
      }
    })

  // Stats kota
  const allCakupan = puskesmasFeatures
    .map((f) => f.properties.rata_cakupan)
    .filter((v): v is number => v !== null)
  const rataKota =
    allCakupan.length > 0
      ? allCakupan.reduce((a, b) => a + b, 0) / allCakupan.length
      : 0

  const dominan = getSegmen(rataKota)

  return NextResponse.json({
    kecamatan: {
      type: "FeatureCollection",
      features: kecamatanFeatures,
    },
    puskesmas: {
      type: "FeatureCollection",
      features: puskesmasFeatures,
    },
    stats: {
      totalKecamatan: kecamatanList.length,
      totalPuskesmas: puskesmasList.length,
      rataCakupanKota: Math.round(rataKota * 100) / 100,
      segmenDominan: dominan,
    },
  })
}
