import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") || "data"
  const format = req.nextUrl.searchParams.get("format") || "json"
  const puskesmasId = req.nextUrl.searchParams.get("puskesmasId")

  const prediksiWhere = puskesmasId ? { puskesmasId: Number(puskesmasId) } : {}

  if (type === "prediksi") {
    const data = await prisma.prediksi.findMany({
      where: prediksiWhere,
      include: { puskesmas: { select: { kode: true, nama: true } } },
      orderBy: [{ puskesmasId: "asc" }, { createdAt: "desc" }],
    })

    if (format === "json") {
      return new NextResponse(JSON.stringify(data, null, 2), {
        headers: { "Content-Type": "application/json" },
      })
    }

    const header = "Kode,Nama,Tanggal_Prediksi,Nilai_Prediksi"
    const rows = data.map(
      (d) =>
        `${d.puskesmas.kode},${d.puskesmas.nama},${d.createdAt.toISOString()},${d.nilaiPrediksi}`
    )
    return new NextResponse([header, ...rows].join("\n"), {
      headers: { "Content-Type": "text/csv" },
    })
  }

  const where = puskesmasId ? { puskesmasId: Number(puskesmasId) } : {}
  const data = await prisma.dataBulanan.findMany({
    where,
    include: { puskesmas: { select: { kode: true, nama: true } } },
    orderBy: [{ puskesmasId: "asc" }, { tanggal: "asc" }],
  })

  if (format === "json") {
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: { "Content-Type": "application/json" },
    })
  }

  const header = "Kode,Nama,Tanggal,Jumlah_Bayi_6_Bulan,Jumlah_ASI_Eksklusif,Persentase_Cakupan"
  const rows = data.map(
    (d) =>
      `${d.puskesmas.kode},${d.puskesmas.nama},${d.tanggal.toISOString().split("T")[0]},${d.jumlahBayi6Bulan},${d.jumlahASIEksklusif},${d.persentaseCakupan ?? ""}`
  )
  return new NextResponse([header, ...rows].join("\n"), {
    headers: { "Content-Type": "text/csv" },
  })
}
