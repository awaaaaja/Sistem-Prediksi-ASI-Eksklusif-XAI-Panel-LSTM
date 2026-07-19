import { WINDOW_SIZE } from "@/lib/constants"

interface DataRow {
  jumlahBayi6Bulan: number
  jumlahASIEksklusif: number
  persentaseCakupan: number | null
  tanggal: Date
}

export function buildFeatureArray(history: DataRow[]): number[][] {
  const result: number[][] = []
  const MIN_YEAR = 2021

  for (let i = 0; i < history.length; i++) {
    const row = history[i]
    const month = row.tanggal.getMonth() + 1
    const year = row.tanggal.getFullYear()
    const cakupan = row.persentaseCakupan ?? 0

    const lag1 = i > 0 ? (history[i - 1].persentaseCakupan ?? 0) : cakupan
    const lag2 = i > 1 ? (history[i - 2].persentaseCakupan ?? 0) : cakupan
    const lag3 = i > 2 ? (history[i - 3].persentaseCakupan ?? 0) : cakupan
    const rasio = row.jumlahBayi6Bulan > 0 ? row.jumlahASIEksklusif / row.jumlahBayi6Bulan : 0
    const yearTrend = (year - MIN_YEAR) / 3

    result.push([
      row.jumlahASIEksklusif,
      rasio,
      lag1,
      lag2,
      lag3,
      Math.sin((2 * Math.PI * month) / 12),
      Math.cos((2 * Math.PI * month) / 12),
      yearTrend,
    ])
  }

  return result
}

export const PREDICT_FEATURES_SELECT = {
  jumlahBayi6Bulan: true,
  jumlahASIEksklusif: true,
  persentaseCakupan: true,
  tanggal: true,
} as const
