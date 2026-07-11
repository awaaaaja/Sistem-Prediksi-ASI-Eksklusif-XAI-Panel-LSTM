export const WINDOW_SIZE = 12
export const N_FEATURES = 2
export const FEATURES = ["Jumlah_Bayi_6_Bulan", "Jumlah_ASI_Eksklusif"] as const
export const ML_ENGINE_URL = process.env.ML_ENGINE_URL || "http://localhost:8000"

export const PUSKESMAS_LIST = [
  { kode: "PKM01", nama: "Puskesmas A" },
  { kode: "PKM02", nama: "Puskesmas B" },
  { kode: "PKM03", nama: "Puskesmas C" },
  { kode: "PKM04", nama: "Puskesmas D" },
  { kode: "PKM05", nama: "Puskesmas E" },
  { kode: "PKM06", nama: "Puskesmas F" },
  { kode: "PKM07", nama: "Puskesmas G" },
  { kode: "PKM08", nama: "Puskesmas H" },
  { kode: "PKM09", nama: "Puskesmas I" },
  { kode: "PKM10", nama: "Puskesmas J" },
  { kode: "PKM11", nama: "Puskesmas K" },
  { kode: "PKM12", nama: "Puskesmas L" },
  { kode: "PKM13", nama: "Puskesmas M" },
  { kode: "PKM14", nama: "Puskesmas N" },
  { kode: "PKM15", nama: "Puskesmas O" },
  { kode: "PKM16", nama: "Puskesmas P" },
  { kode: "PKM17", nama: "Puskesmas Q" },
  { kode: "PKM18", nama: "Puskesmas R" },
  { kode: "PKM19", nama: "Puskesmas S" },
  { kode: "PKM20", nama: "Puskesmas T" },
  { kode: "PKM21", nama: "Puskesmas U" },
  { kode: "PKM22", nama: "Puskesmas V" },
  { kode: "PKM23", nama: "Puskesmas W" },
  { kode: "PKM24", nama: "Puskesmas X" },
] as const
