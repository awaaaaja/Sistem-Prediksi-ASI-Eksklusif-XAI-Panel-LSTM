"use server"

import { prisma } from "@/lib/prisma"

export async function exportReport(
  format: "csv" | "json",
  puskesmasId?: number
): Promise<string> {
  const where = puskesmasId ? { puskesmasId } : {}

  const data = await prisma.dataBulanan.findMany({
    where,
    include: {
      puskesmas: { select: { kode: true, nama: true } },
    },
    orderBy: [{ puskesmasId: "asc" }, { tanggal: "asc" }],
  })

  if (format === "json") {
    return JSON.stringify(data, null, 2)
  }

  const header = "Kode,Nama,Tanggal,Jumlah_Bayi_6_Bulan,Jumlah_ASI_Eksklusif,Persentase_Cakupan"
  const rows = data.map(
    (d) =>
      `${d.puskesmas.kode},${d.puskesmas.nama},${d.tanggal.toISOString().split("T")[0]},${d.jumlahBayi6Bulan},${d.jumlahASIEksklusif},${d.persentaseCakupan ?? ""}`
  )

  return [header, ...rows].join("\n")
}

export async function exportPredictionReport(
  format: "csv" | "json",
  puskesmasId?: number
): Promise<string> {
  const where = puskesmasId ? { puskesmasId } : {}

  const data = await prisma.prediksi.findMany({
    where,
    include: {
      puskesmas: { select: { kode: true, nama: true } },
    },
    orderBy: [{ puskesmasId: "asc" }, { createdAt: "desc" }],
  })

  if (format === "json") {
    return JSON.stringify(data, null, 2)
  }

  const header = "Kode,Nama,Tanggal_Prediksi,Nilai_Prediksi"
  const rows = data.map(
    (d) =>
      `${d.puskesmas.kode},${d.puskesmas.nama},${d.createdAt.toISOString()},${d.nilaiPrediksi}`
  )

  return [header, ...rows].join("\n")
}
