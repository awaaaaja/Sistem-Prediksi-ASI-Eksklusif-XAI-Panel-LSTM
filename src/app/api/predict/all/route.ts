import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ML_ENGINE_URL, WINDOW_SIZE } from "@/lib/constants"
import { buildFeatureArray, PREDICT_FEATURES_SELECT } from "@/lib/features"

export async function POST() {
  try {
    const puskesmasList = await prisma.puskesmas.findMany({
      where: { aktif: true },
      select: { id: true, kode: true, nama: true },
    })

    const results: { kode: string; nama: string; nilaiPrediksi: number; error?: string; executionTimeMs?: number }[] = []
    let totalSuccess = 0
    let totalFailed = 0

    for (const pkm of puskesmasList) {
      const history = await prisma.dataBulanan.findMany({
        where: { puskesmasId: pkm.id },
        select: PREDICT_FEATURES_SELECT,
        orderBy: { tanggal: "asc" },
      })

      if (history.length < WINDOW_SIZE) {
        results.push({ kode: pkm.kode, nama: pkm.nama, nilaiPrediksi: 0, error: `Data tidak cukup: ${history.length} bulan` })
        totalFailed++
        continue
      }

      try {
        const historyArr = buildFeatureArray(history)

        const predRes = await fetch(`${ML_ENGINE_URL}/ml/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ puskesmas_id: pkm.id, history: historyArr }),
        })

        if (!predRes.ok) {
          results.push({ kode: pkm.kode, nama: pkm.nama, nilaiPrediksi: 0, error: "Prediksi gagal" })
          totalFailed++
          continue
        }

        const predData = await predRes.json()

        await prisma.prediksi.create({
          data: {
            puskesmasId: pkm.id,
            nilaiPrediksi: predData.predictions[0],
            executionTimeMs: predData.execution_time_ms,
          },
        })

        results.push({
          kode: pkm.kode,
          nama: pkm.nama,
          nilaiPrediksi: predData.predictions[0],
          executionTimeMs: predData.execution_time_ms,
        })
        totalSuccess++
      } catch {
        results.push({ kode: pkm.kode, nama: pkm.nama, nilaiPrediksi: 0, error: "Gagal terhubung ke ML Engine" })
        totalFailed++
      }
    }

    return NextResponse.json({ success: true, results, totalSuccess, totalFailed })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
