"use server"

import { prisma } from "@/lib/prisma"
import { parse, isValid } from "date-fns"
import type { UploadRow, UploadPreview, UploadResult } from "@/types"

function parseCSV(text: string): UploadRow[] {
  const lines = text.trim().split("\n")
  if (lines.length < 2) return []

  const rows: UploadRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",")
    if (cols.length < 4) continue
    const row: UploadRow = {
      Kode_Puskesmas: cols[0]?.trim() || "",
      Tanggal: cols[1]?.trim() || "",
      Jumlah_Bayi_6_Bulan: parseFloat(cols[2]?.trim() || "0"),
      Jumlah_ASI_Eksklusif: parseFloat(cols[3]?.trim() || "0"),
    }
    if (cols.length > 4) {
      row.Persentase_Cakupan = parseFloat(cols[4]?.trim() || "0")
    }
    rows.push(row)
  }
  return rows
}

export async function validateUpload(
  formData: FormData
): Promise<UploadPreview> {
  const file = formData.get("file") as File | null
  if (!file) throw new Error("File tidak ditemukan")

  const text = await file.text()
  const rows = parseCSV(text)
  const errors: string[] = []
  const validRows: UploadRow[] = []

  for (const [index, row] of rows.entries()) {
    const baris = index + 2
    const date = parse(row.Tanggal, "yyyy-MM-dd", new Date())
    if (!isValid(date)) {
      errors.push(
        `Baris ${baris}: Tanggal "${row.Tanggal}" tidak valid (format YYYY-MM-DD)`
      )
      continue
    }
    if (!row.Kode_Puskesmas) {
      errors.push(`Baris ${baris}: Kode Puskesmas kosong`)
      continue
    }
    if (isNaN(row.Jumlah_Bayi_6_Bulan)) {
      errors.push(`Baris ${baris}: Jumlah_Bayi_6_Bulan bukan angka`)
      continue
    }
    if (isNaN(row.Jumlah_ASI_Eksklusif)) {
      errors.push(`Baris ${baris}: Jumlah_ASI_Eksklusif bukan angka`)
      continue
    }
    validRows.push(row)
  }

  return {
    total: rows.length,
    valid: validRows.length,
    errors,
    sampleRows: validRows.slice(0, 5),
  }
}

export async function appendData(formData: FormData): Promise<UploadResult> {
  const file = formData.get("file") as File | null
  if (!file) throw new Error("File tidak ditemukan")

  const text = await file.text()
  const rows = parseCSV(text)
  const errors: string[] = []
  let inserted = 0

  for (const [index, row] of rows.entries()) {
    const baris = index + 2
    const date = parse(row.Tanggal, "yyyy-MM-dd", new Date())

    if (!isValid(date)) {
      errors.push(`Baris ${baris}: Tanggal tidak valid`)
      continue
    }

    const puskesmas = await prisma.puskesmas.findUnique({
      where: { kode: row.Kode_Puskesmas },
    })

    if (!puskesmas) {
      errors.push(`Baris ${baris}: Puskesmas "${row.Kode_Puskesmas}" tidak ditemukan`)
      continue
    }

    try {
      const existing = await prisma.dataBulanan.findUnique({
        where: {
          puskesmasId_tanggal: {
            puskesmasId: puskesmas.id,
            tanggal: date,
          },
        },
      })

      if (existing) {
        await prisma.dataBulanan.update({
          where: { id: existing.id },
          data: {
            jumlahBayi6Bulan: row.Jumlah_Bayi_6_Bulan,
            jumlahASIEksklusif: row.Jumlah_ASI_Eksklusif,
            persentaseCakupan: row.Persentase_Cakupan ?? null,
          },
        })
      } else {
        await prisma.dataBulanan.create({
          data: {
            puskesmasId: puskesmas.id,
            tanggal: date,
            jumlahBayi6Bulan: row.Jumlah_Bayi_6_Bulan,
            jumlahASIEksklusif: row.Jumlah_ASI_Eksklusif,
            persentaseCakupan: row.Persentase_Cakupan ?? null,
          },
        })
      }
      inserted++
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      errors.push(`Baris ${baris}: ${msg}`)
    }
  }

  const log = await prisma.uploadLog.create({
    data: {
      namaFile: file.name,
      totalBaris: rows.length,
      barisValid: inserted,
      barisError: errors.length,
      errors: errors.length > 0 ? errors.join("\n") : null,
      status: errors.length === 0 ? "success" : "partial",
    },
  })

  return { success: errors.length === 0, inserted, errors, logId: log.id }
}
