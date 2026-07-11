import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ML_ENGINE_URL, WINDOW_SIZE } from "@/lib/constants"

export async function POST(req: NextRequest) {
  try {
    const { puskesmasId } = await req.json()

    const history = await prisma.dataBulanan.findMany({
      where: { puskesmasId },
      orderBy: { tanggal: "asc" },
      select: { jumlahBayi6Bulan: true, jumlahASIEksklusif: true },
    })

    if (history.length < WINDOW_SIZE) {
      return NextResponse.json(
        { success: false, error: `Data tidak mencukupi: ${history.length} bulan` },
        { status: 400 }
      )
    }

    const historyArr = history.map((h) => [h.jumlahBayi6Bulan, h.jumlahASIEksklusif])

    const [predRes, shapRes] = await Promise.all([
      fetch(`${ML_ENGINE_URL}/ml/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puskesmas_id: puskesmasId, history: historyArr }),
      }),
      fetch(`${ML_ENGINE_URL}/ml/shap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puskesmas_id: puskesmasId, history: historyArr }),
      }),
    ])

    if (!predRes.ok) {
      return NextResponse.json(
        { success: false, error: "Prediksi gagal" },
        { status: 502 }
      )
    }

    const predData = await predRes.json()
    const shapData = shapRes.ok ? await shapRes.json() : null

    await prisma.prediksi.create({
      data: {
        puskesmasId,
        nilaiPrediksi: predData.predictions[0],
        executionTimeMs: predData.execution_time_ms,
      },
    })

    return NextResponse.json({
      success: true,
      prediction: predData.predictions[0],
      executionTimeMs: predData.execution_time_ms,
      shap: shapData,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
