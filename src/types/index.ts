export type Segmen = "SANGAT_BAIK" | "SEDANG" | "RENDAH"

export interface SegmenInfo {
  label: string
  labelSingkat: string
  color: string
  bgClass: string
  textClass: string
  borderClass: string
  range: string
}

export interface KecamatanDTO {
  id: number
  nama: string
  latitude: number | null
  longitude: number | null
}

export interface PuskesmasDTO {
  id: number
  kode: string
  nama: string
  alamat: string | null
  kecamatanId: number | null
  kecamatan?: KecamatanDTO | null
  latitude: number | null
  longitude: number | null
  provinsi: string | null
  aktif: boolean
}

export interface DataBulananDTO {
  id: number
  puskesmasId: number
  tanggal: string
  jumlahBayi6Bulan: number
  jumlahASIEksklusif: number
  persentaseCakupan: number | null
}

export interface PrediksiDTO {
  id: number
  puskesmasId: number
  tanggalPrediksi: string
  nilaiPrediksi: number
  executionTimeMs: number | null
  createdAt: string
}

export interface ShapValueDTO {
  id: number
  prediksiId: number
  fitur: string
  lag: number
  shapValue: number
}

export interface ShapImpact {
  lag: number
  shap_value: number
  feature_name: string
}

export interface ShapFeatureImpact {
  feature: string
  mean_abs_impact: number
  impacts: ShapImpact[]
}

export interface ShapResponse {
  success: boolean
  puskesmas_id: number
  expected_value: number
  features: ShapFeatureImpact[]
}

export interface UploadRow {
  Kode_Puskesmas: string
  Tanggal: string
  Jumlah_Bayi_6_Bulan: number
  Jumlah_ASI_Eksklusif: number
  Persentase_Cakupan?: number
}

export interface UploadPreview {
  total: number
  valid: number
  errors: string[]
  sampleRows: UploadRow[]
}

export interface UploadResult {
  success: boolean
  inserted: number
  errors: string[]
  logId: number
}

export interface APIResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface GeoFeatureProperties {
  id?: number
  nama: string
  kode?: string
  kecamatan?: string
  puskesmas_count?: number
  rata_cakupan: number | null
  segmen: Segmen
  alamat?: string
}

export interface GeoFeature {
  type: "Feature"
  properties: GeoFeatureProperties
  geometry: {
    type: "Point" | "MultiPolygon"
    coordinates: number[] | number[][][][]
  }
}

export interface GeoFeatureCollection {
  type: "FeatureCollection"
  features: GeoFeature[]
}

export interface MapDataResponse {
  kecamatan: GeoFeatureCollection
  puskesmas: GeoFeatureCollection
  stats: {
    totalKecamatan: number
    totalPuskesmas: number
    rataCakupanKota: number
    segmenDominan: Segmen
  }
}

export interface KecamatanDetail {
  id: number
  nama: string
  rataCakupan: number
  segmen: Segmen
  puskesmasList: PuskesmasDTO[]
  totalBayi: number
  totalASI: number
  trendData: { bulan: string; rataCakupan: number }[]
}
