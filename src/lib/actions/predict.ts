"use server"

import { prisma } from "@/lib/prisma"
import { ML_ENGINE_URL, WINDOW_SIZE } from "@/lib/constants"
import { buildFeatureArray, PREDICT_FEATURES_SELECT } from "@/lib/features"
import type { PrediksiDTO, ShapResponse } from "@/types"

export async function predictPuskesmas(
  puskesmasId: number
): Promise<PrediksiDTO> {
  const history = await prisma.dataBulanan.findMany({
    where: { puskesmasId },
    select: PREDICT_FEATURES_SELECT,
    orderBy: { tanggal: "asc" },
  })

  if (history.length < WINDOW_SIZE) {
    throw new Error(
      `Data historis tidak mencukupi: ${history.length} bulan, minimal ${WINDOW_SIZE}`
    )
  }

  const historyArr = buildFeatureArray(history)

  const res = await fetch(`${ML_ENGINE_URL}/ml/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ puskesmas_id: puskesmasId, history: historyArr }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Prediksi gagal")
  }

  const data = await res.json()

  const prediksi = await prisma.prediksi.create({
    data: {
      puskesmasId,
      nilaiPrediksi: data.predictions[0],
      executionTimeMs: data.execution_time_ms,
    },
  })

  return {
    id: prediksi.id,
    puskesmasId: prediksi.puskesmasId,
    tanggalPrediksi: prediksi.tanggalPrediksi.toISOString(),
    nilaiPrediksi: prediksi.nilaiPrediksi,
    executionTimeMs: prediksi.executionTimeMs,
    createdAt: prediksi.createdAt.toISOString(),
  }
}

export async function getShapValues(
  prediksiId: number,
  puskesmasId: number
): Promise<ShapResponse> {
  const history = await prisma.dataBulanan.findMany({
    where: { puskesmasId },
    select: PREDICT_FEATURES_SELECT,
    orderBy: { tanggal: "asc" },
  })

  if (history.length < WINDOW_SIZE) {
    throw new Error("Data historis tidak mencukupi untuk kalkulasi SHAP")
  }

  const historyArr = buildFeatureArray(history)

  const res = await fetch(`${ML_ENGINE_URL}/ml/shap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ puskesmas_id: puskesmasId, history: historyArr }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "SHAP kalkulasi gagal")
  }

  const shapData: ShapResponse = await res.json()

  for (const feat of shapData.features) {
    for (const imp of feat.impacts) {
      await prisma.shapValue.upsert({
        where: {
          prediksiId_fitur_lag: {
            prediksiId,
            fitur: imp.feature_name,
            lag: imp.lag,
          },
        },
        update: { shapValue: imp.shap_value },
        create: {
          prediksiId,
          fitur: imp.feature_name,
          lag: imp.lag,
          shapValue: imp.shap_value,
        },
      })
    }
  }

  return shapData
}
