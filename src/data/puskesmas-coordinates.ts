export interface PuskesmasCoord {
  lat: number
  lng: number
}

export const PUSKESMAS_COORDS: Record<string, PuskesmasCoord> = {
  // Override khusus untuk puskesmas dengan koordinat DB yang tidak akurat
  PKM15: { lat: -0.9750, lng: 100.3600 },  // PEMANCUNGAN → Padang Selatan (DB seed di pantai, geser inland)
}

export const KECAMATAN_DEMOGRAFI: Record<string, { penduduk: number; kepadatan: number }> = {
  "Bungus Teluk Kabung": { penduduk: 28788, kepadatan: 286 },
  "Lubuk Kilangan":      { penduduk: 60614, kepadatan: 705 },
  "Lubuk Begalung":      { penduduk: 128453, kepadatan: 4156 },
  "Padang Selatan":      { penduduk: 62333, kepadatan: 6215 },
  "Padang Timur":        { penduduk: 78407, kepadatan: 962 },
  "Padang Barat":        { penduduk: 43200, kepadatan: 6171 },
  "Padang Utara":        { penduduk: 55484, kepadatan: 6867 },
  "Nanggalo":            { penduduk: 59240, kepadatan: 7341 },
  "Kuranji":             { penduduk: 153137, kepadatan: 2667 },
  "Pauh":                { penduduk: 63489, kepadatan: 434 },
  "Koto Tangah":         { penduduk: 209793, kepadatan: 903 },
}
