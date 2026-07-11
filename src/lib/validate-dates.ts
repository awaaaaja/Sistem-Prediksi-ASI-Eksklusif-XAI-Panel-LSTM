import { parse, isValid, getDate, getMonth, getDaysInMonth } from "date-fns"
import type { UploadRow } from "@/types"

export interface ValidationResult {
  valid: boolean
  errors: string[]
  validRows: UploadRow[]
}

export function validateDates(rows: UploadRow[]): ValidationResult {
  const errors: string[] = []
  const validRows: UploadRow[] = []

  for (const [index, row] of rows.entries()) {
    const baris = index + 2
    const date = parse(String(row.Tanggal), "yyyy-MM-dd", new Date())

    if (!isValid(date)) {
      errors.push(
        `Baris ${baris}: Tanggal "${row.Tanggal}" tidak valid (format harus YYYY-MM-DD)`
      )
      continue
    }

    const day = getDate(date)
    const month = getMonth(date) + 1
    const maxDay = getDaysInMonth(date)

    if (day > maxDay) {
      errors.push(
        `Baris ${baris}: Tanggal "${row.Tanggal}" tidak valid — bulan ${month} hanya memiliki ${maxDay} hari`
      )
      continue
    }

    validRows.push(row)
  }

  return { valid: errors.length === 0, errors, validRows }
}
