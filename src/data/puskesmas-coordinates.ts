export interface PuskesmasCoord {
  lat: number
  lng: number
}

export const PUSKESMAS_COORDS: Record<string, PuskesmasCoord> = {
  // Override — koordinat DB seed yang tidak akurat berdasarkan point-in-polygon test
  // terhadap kecamatan-padang.geo.json
  PKM03: { lat: -0.8850, lng: 100.3700 },  // IKUR KOTO
  PKM11: { lat: -0.9820, lng: 100.4330 },  // LUBUK KILANGAN
  PKM14: { lat: -0.9500, lng: 100.3580 },  // PADANG PASIR
  PKM15: { lat: -0.9750, lng: 100.3600 },  // PEMANCUNGAN
  PKM17: { lat: -0.9600, lng: 100.3650 },  // SEBERANG PADANG
  PKM23: { lat: -1.0000, lng: 100.4150 },  // BUNGUS
  PKM24: { lat: -0.8712, lng: 100.5051 },  // PAUH
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
