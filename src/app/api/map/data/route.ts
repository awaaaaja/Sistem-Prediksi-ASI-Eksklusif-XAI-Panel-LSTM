import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { PUSKESMAS_COORDS, KECAMATAN_DEMOGRAFI } from "@/data/puskesmas-coordinates"
import { SEGMEN_THRESHOLDS, KECAMATAN_LIST } from "@/lib/constants"
import type { Segmen } from "@/types"
import fs from "fs"
import path from "path"

function getSegmen(nilai: number | null): Segmen {
  if (nilai === null || nilai === undefined) return "RENDAH"
  if (nilai >= SEGMEN_THRESHOLDS.SANGAT_BAIK) return "SANGAT_BAIK"
  if (nilai >= SEGMEN_THRESHOLDS.SEDANG) return "SEDANG"
  return "RENDAH"
}

const KEC_NAMA_TO_ID = Object.fromEntries(
  KECAMATAN_LIST.map((k) => [k.nama, k.id])
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const tahunDiDB = await prisma.$queryRawUnsafe<{ tahun: number }[]>(
    `SELECT DISTINCT YEAR(tanggal) as tahun FROM data_bulanan ORDER BY tahun DESC`
  )
  const tahunTersedia = tahunDiDB.map((r) => r.tahun)
  const maxTahun = tahunTersedia.length > 0 ? Math.max(...tahunTersedia) : 0

  const tahunParam = searchParams.get("tahun")
  const tahunReq = tahunParam ? parseInt(tahunParam, 10) : maxTahun
  const tahun = tahunTersedia.includes(tahunReq) ? tahunReq : maxTahun

  const puskesmasList = await prisma.puskesmas.findMany({
    include: { kecamatan: true },
    orderBy: { kode: "asc" },
  })

  const kecamatanList = await prisma.kecamatan.findMany({
    orderBy: { nama: "asc" },
  })
  const kecNamaMap = new Map(kecamatanList.map((k) => [k.nama, k]))

  let cakupanMap = new Map<number, number>()
  if (tahun > 0) {
    const dataPerPkm = await prisma.$queryRawUnsafe<{
      puskesmas_id: number
      rata_cakupan: number
    }[]>(
      `
      SELECT d.puskesmas_id, AVG(d.persentase_cakupan) as rata_cakupan
      FROM data_bulanan d
      WHERE YEAR(d.tanggal) = ?
      GROUP BY d.puskesmas_id
      `,
      tahun
    )
    for (const row of dataPerPkm) {
      cakupanMap.set(row.puskesmas_id, row.rata_cakupan)
    }
  }

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

  const puskesmasFeatures = puskesmasList.map((p) => {
    const coord = PUSKESMAS_COORDS[p.kode] ?? (
      (p.latitude && p.longitude)
        ? { lat: p.latitude, lng: p.longitude }
        : undefined
    )
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
        coordinates: coord
          ? [coord.lng, coord.lat]
          : [0, 0],
      },
    }
  })

  let geoJSON: { type: string; features: any[] } | null = null
  try {
    const filePath = path.join(process.cwd(), "public", "data", "kecamatan-padang.geo.json")
    const raw = fs.readFileSync(filePath, "utf-8")
    geoJSON = JSON.parse(raw)
  } catch {
    // fallback: kecamatan sebagai point
    geoJSON = null
  }

  let kecamatanFeatures: any[]
  if (geoJSON) {
    kecamatanFeatures = geoJSON.features.map((f: any) => {
      const nm_kecamatan = f.properties.nm_kecamatan
      const kecDb = kecNamaMap.get(nm_kecamatan)
      const kecId = kecDb?.id ?? KEC_NAMA_TO_ID[nm_kecamatan]
      const ck = kecId ? kecamatanCakupan[kecId] : undefined
      const avg = ck && ck.count > 0 ? ck.total / ck.count : null
      const pkmCount = kecDb
        ? puskesmasList.filter((p) => p.kecamatanId === kecDb.id).length
        : 0
      return {
        ...f,
        properties: {
          ...f.properties,
          id: kecId ?? null,
          nama: nm_kecamatan,
          rata_cakupan: avg ? Math.round(avg * 100) / 100 : null,
          segmen: getSegmen(avg),
          puskesmas_count: pkmCount,
        },
      }
    })
  } else {
    kecamatanFeatures = kecamatanList.map((k) => {
      const ck = kecamatanCakupan[k.id]
      const avg = ck && ck.count > 0 ? ck.total / ck.count : null
      return {
        type: "Feature",
        properties: {
          id: k.id,
          nama: k.nama,
          rata_cakupan: avg ? Math.round(avg * 100) / 100 : null,
          segmen: getSegmen(avg),
          puskesmas_count: puskesmasList.filter((p) => p.kecamatanId === k.id).length,
        },
        geometry: {
          type: "Point",
          coordinates: k.longitude && k.latitude ? [k.longitude, k.latitude] : [0, 0],
        },
      }
    })
  }

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
    demografi: KECAMATAN_DEMOGRAFI,
    tahunTersedia,
  })
}
