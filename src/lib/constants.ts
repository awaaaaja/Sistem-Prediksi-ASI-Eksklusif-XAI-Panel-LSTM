export const WINDOW_SIZE = 12
export const N_FEATURES = 8
export const FEATURES = [
  "Jumlah_ASI_Eksklusif",
  "Rasio_ASI_Bayi",
  "Lag1_Target",
  "Lag2_Target",
  "Lag3_Target",
  "Month_Sin",
  "Month_Cos",
  "Year_Trend",
] as const
export const ML_ENGINE_URL = process.env.ML_ENGINE_URL || "http://localhost:8000"

export const PUSKESMAS_LIST = [
  { kode: "PKM01", nama: "AIR DINGIN", kecamatan: "Koto Tangah" },
  { kode: "PKM02", nama: "ANAK AIR", kecamatan: "Koto Tangah" },
  { kode: "PKM03", nama: "IKUR KOTO", kecamatan: "Koto Tangah" },
  { kode: "PKM04", nama: "LB.BUAYA", kecamatan: "Koto Tangah" },
  { kode: "PKM05", nama: "TUNGGUL HITAM", kecamatan: "Koto Tangah" },
  { kode: "PKM06", nama: "AMBACANG", kecamatan: "Kuranji" },
  { kode: "PKM07", nama: "BELIMBING", kecamatan: "Kuranji" },
  { kode: "PKM08", nama: "KURANJI", kecamatan: "Kuranji" },
  { kode: "PKM09", nama: "LUBUK BEGALUNG", kecamatan: "Lubuk Begalung" },
  { kode: "PKM10", nama: "PEGAMBIRAN", kecamatan: "Lubuk Begalung" },
  { kode: "PKM11", nama: "LUBUK KILANGAN", kecamatan: "Lubuk Kilangan" },
  { kode: "PKM12", nama: "LAPAI", kecamatan: "Nanggalo" },
  { kode: "PKM13", nama: "NANGGALO", kecamatan: "Nanggalo" },
  { kode: "PKM14", nama: "PADANG PASIR", kecamatan: "Padang Barat" },
  { kode: "PKM15", nama: "PEMANCUNGAN", kecamatan: "Padang Selatan" },
  { kode: "PKM16", nama: "RAWANG", kecamatan: "Padang Selatan" },
  { kode: "PKM17", nama: "SEBERANG PADANG", kecamatan: "Padang Selatan" },
  { kode: "PKM18", nama: "ANDALAS", kecamatan: "Padang Timur" },
  { kode: "PKM19", nama: "PARAK KARAKAH", kecamatan: "Padang Timur" },
  { kode: "PKM20", nama: "AIR TAWAR", kecamatan: "Padang Utara" },
  { kode: "PKM21", nama: "ALAI", kecamatan: "Padang Utara" },
  { kode: "PKM22", nama: "ULAK KARANG", kecamatan: "Padang Utara" },
  { kode: "PKM23", nama: "BUNGUS", kecamatan: "Bungus Teluk Kabung" },
  { kode: "PKM24", nama: "PAUH", kecamatan: "Pauh" },
] as const

export const SEGMEN_THRESHOLDS = {
  SANGAT_BAIK: 80,
  SEDANG: 50,
} as const

export const TAHUN_LIST = [2021, 2022, 2023, 2024, 2025] as const

export const KECAMATAN_LIST = [
  { id: 1, nama: "Koto Tangah" },
  { id: 2, nama: "Padang Utara" },
  { id: 3, nama: "Kuranji" },
  { id: 4, nama: "Padang Timur" },
  { id: 5, nama: "Padang Barat" },
  { id: 6, nama: "Padang Selatan" },
  { id: 7, nama: "Lubuk Begalung" },
  { id: 8, nama: "Lubuk Kilangan" },
  { id: 9, nama: "Nanggalo" },
  { id: 10, nama: "Pauh" },
  { id: 11, nama: "Bungus Teluk Kabung" },
] as const
