# Plan Integrasi WebGIS ke Next.js — Fitur Peta Interaktif

> **Project:** Sistem Prediksi ASI Eksklusif + XAI Panel LSTM
> **Target:** Menyatukan `webgis/` (Leaflet/JS) ke dalam Next.js App Router (react-leaflet)
> **Design System:** Dark Mode (OLED) + Glassmorphism — via ui-ux-pro-max

---

## Phase 1: READ — Memahami & Memetakan Aset

### 1.1 Inventaris WebGIS (Lama)

| Path | Isi | Status |
|------|-----|--------|
| `webgis/index.html` | Halaman utama: Leaflet map + sidebar + tabel data | Referensi interaksi |
| `webgis/data/padang_kecamatan.geojson` | **Polygon 11 kecamatan Padang** (115rb baris koordinat real) | ✅ Aset kritis |
| `webgis/data/puskesmas.json` | 22 puskesmas dengan `{nama, kecamatan, lat, lng}` | ✅ Aset kritis |
| `webgis/data/indikator.json` | Demografi per kecamatan `{penduduk, kepadatan}` | ✅ Aset pelengkap |
| `webgis/api/config.php` + `puskesmas.php` | Backend PHP API (tidak dipakai) | ❌ Skip |
| `webgis/js/leaflet.js, jquery.min.js, ...` | Library JS (tidak dipakai, react-leaflet sudah ada) | ❌ Skip |

### 1.2 Fitur WebGIS yang Wajib Diadopsi

1. **Choropleth Kecamatan** — Polygon diwarnai berdasarkan segmen cakupan ASI
2. **Hover Tooltip** — Nama kecamatan muncul saat hover
3. **Klik Popup Detail** — Menampilkan daftar puskesmas dalam kecamatan
4. **Tahun Selector** — Dropdown untuk memilih tahun data (2023, 2024)
5. **Tabel Data Kecamatan** — Sidebar/tabel yang ter-filter berdasarkan tahun
6. **Legenda Warna** — Hijau (>=80%), Kuning (50-79%), Merah (<50%)

### 1.3 Gap Analysis

| Komponen | WebGIS (Lama) | Next.js (Sekarang) | Gap |
|----------|--------------|-------------------|-----|
| Map Library | Leaflet (JS) | react-leaflet (v4) | ✅ Teknologi beda tapi kompatibel |
| GeoJSON Polygon | ✅ Ada (real) | ❌ Fallback buatan sendiri | **Copy GeoJSON** |
| Koordinat Puskesmas | ✅ 22 titik | ❌ Hanya konstanta nama | **Mapping koordinat** |
| Tahun Selector | ✅ Ada (2023, 2024) | ❌ Tidak ada | **Buat komponen baru** |
| Tabel per Tahun | ✅ Ada (AJAX) | ❌ Tidak ada | **Integrasi API** |
| Demografi | ✅ Indikator.json | ❌ Tidak ada | **Tambah ke schema** |
| Color Segmen | >=80% Hijau, 50-79% Kuning, <50% Merah | >=80% Emerald, 60-79% Amber, <60% Red | **Samakan threshold** |

### 1.4 Mapping Kecamatan

| WebGIS `nm_kecamatan` | `constants.ts` `KECAMATAN_LIST` | ID Prisma |
|-----------------------|--------------------------------|-----------|
| Padang Selatan | Padang Selatan | ✅ Match |
| Padang Timur | Padang Timur | ✅ Match |
| Padang Barat | Padang Barat | ✅ Match |
| Padang Utara | Padang Utara | ✅ Match |
| Koto Tangah | Koto Tangah | ✅ Match |
| Kuranji | Kuranji | ✅ Match |
| Lubuk Kilangan | Lubuk Kilangan | ✅ Match |
| Lubuk Begalung | Lubuk Begalung | ✅ Match |
| Pauh | Pauh | ✅ Match |
| Bungus Teluk Kabung | Bungus Teluk Kabung | ✅ Match |
| Nanggalo | Nanggalo | ✅ Match |

**11/11 match — tidak perlu mapping ulang.**

---

## Phase 2: THINKING — Arsitektur Integrasi

### 2.1 Design System (ui-ux-pro-max)

Berdasarkan rekomendasi `--design-system "gis map dashboard health monitoring"`:

```
Pattern:  Real-Time / Operations Landing
Style:    Dark Mode (OLED) — #000000 / #121212
Aksen:    Biru Klinis #0284C7 + Hijau #16A34A + Merah #DC2626
Font:     Fira Code (heading) + Fira Sans (body)
Efek:     Minimal glow, glassmorphism cards, spring physics
```

**Penyesuaian warna segmen (threshold WebGIS):**

| Segmen | Range | WebGIS | Tailwind |
|--------|-------|--------|----------|
| Sangat Baik | >= 80% | `#3cb44b` (hijau) | `emerald-500` `#10b981` |
| Sedang | 50% - 79% | `#ffe119` (kuning) | `amber-400` `#fbbf24` |
| Rendah | < 50% | `#e6194b` (merah) | `red-500` `#ef4444` |

### 2.2 Alur Data Map

```
┌─────────────────────────────────────────────────────────────┐
│                      NEXT.JS CLIENT                          │
│                                                              │
│  Peta Page ──→ MapContainer.tsx                              │
│    │              ├── LeafletMap (react-leaflet)              │
│    │              ├── GeoJSON layer (kecamatan polygons)     │
│    │              ├── Marker layer (puskesmas points)        │
│    │              ├── YearSelector (filter tahun)            │
│    │              └── MapLegend (legenda warna)              │
│    │                                                         │
│    └── useEffect fetch ──→ GET /api/map/data?tahun=2024     │
│                                                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    API ROUTE HANDLER                         │
│  src/app/api/map/data/route.ts                              │
│    ├── Ambil data_bulanan per puskesmas (filter tahun)      │
│    ├── Hitung rata-rata cakupan per kecamatan               │
│    ├── Tentukan segmen per kecamatan & puskesmas             │
│    ├── Load GeoJSON polygon dari public/data/               │
│    └── Return MapDataResponse JSON                          │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Komponen Arsitektur

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── peta/
│   │       └── page.tsx              ← Halaman peta utama
│   └── api/
│       └── map/
│           └── data/
│               └── route.ts          ← API endpoint map data
├── components/
│   ├── MapContainer.tsx              ← Utama: peta + stat cards
│   ├── map/
│   │   ├── MapContent.tsx            ← Layer GeoJSON + Markers
│   │   ├── MapLegend.tsx             ← Legenda warna interaktif
│   │   ├── KecamatanPopup.tsx        ← Popup detail kecamatan
│   │   └── YearSelector.tsx          ← Dropdown filter tahun
│   └── ui/
│       └── glass-card.tsx            ← Glassmorphism card reusable
├── data/
│   └── puskesmas-coordinates.ts      ← Mapping koordinat puskesmas
├── lib/
│   └── map-utils.ts                  ← Helper: warna segmen, threshold
└── types/
    └── index.ts                      ← Update MapDataResponse, dll.
```

### 2.4 Response API (Contract)

```typescript
// GET /api/map/data?tahun=2024
interface MapDataResponse {
  kecamatan: GeoJSON.FeatureCollection   // polygon + segmen per feature
  puskesmas: GeoJSON.FeatureCollection   // point markers + metadata
  stats: {
    totalKecamatan: number
    totalPuskesmas: number
    rataCakupanKota: number
    segmenDominan: Segmen
  }
  demografi: Record<string, { penduduk: number; kepadatan: number }>
  tahunTersedia: number[]                // [2021, 2022, 2023, 2024]
}
```

---

## Phase 3: BUILD — Langkah Implementasi

### Step 1 — Copy Aset GeoJSON

**Tujuan:** Menyediakan polygon kecamatan real (115rb baris).

```
Copy: webgis/data/padang_kecamatan.geojson
  → public/data/kecamatan-padang.geo.json
```

**Yang perlu disesuaikan:** Tambahkan field `id` pada `properties` yang cocok dengan `Kecamatan.id` di Prisma.

### Step 2 — Mapping Koordinat Puskesmas

**Tujuan:** Setiap puskesmas di `PUSKESMAS_LIST` punya `lat` & `lng`.

Buat file **`src/data/puskesmas-coordinates.ts`**:

```typescript
export const PUSKESMAS_COORDS: Record<string, { lat: number; lng: number }> = {
  PKM01: { lat: -0.965, lng: 100.290 },  // AIR DINGIN
  PKM02: { lat: -0.9695, lng: 100.298 }, // ANAK AIR
  PKM03: { lat: -0.968, lng: 100.295 },  // IKUR KOTO
  PKM04: { lat: -0.970, lng: 100.285 },  // LB.BUAYA
  PKM05: { lat: -0.966, lng: 100.288 },  // TUNGGUL HITAM (baru dari WebGIS pattern)
  PKM06: { lat: -0.950, lng: 100.340 },  // AMBACANG
  PKM07: { lat: -0.960, lng: 100.350 },  // BELIMBING
  PKM08: { lat: -0.955, lng: 100.345 },  // KURANJI
  PKM09: { lat: -0.880, lng: 100.270 },  // LUBUK BEGALUNG
  PKM10: { lat: -0.885, lng: 100.280 },  // PEGAMBIRAN
  PKM11: { lat: -0.930, lng: 100.290 },  // LUBUK KILANGAN
  PKM12: { lat: -0.965, lng: 100.325 },  // LAPAI
  PKM13: { lat: -0.960, lng: 100.320 },  // NANGGALO
  PKM14: { lat: -0.947, lng: 100.345 },  // PADANG PASIR
  PKM15: { lat: -0.900, lng: 100.320 },  // PEMANCUNGAN
  PKM16: { lat: -0.899, lng: 100.315 },  // RAWANG
  PKM17: { lat: -0.910, lng: 100.325 },  // SEBERANG PADANG
  PKM18: { lat: -0.940, lng: 100.370 },  // ANDALAS
  PKM19: { lat: -0.938, lng: 100.365 },  // PARAK KARAKAH (estimasi)
  PKM20: { lat: -0.918, lng: 100.330 },  // AIR TAWAR
  PKM21: { lat: -0.915, lng: 100.325 },  // ALAI
  PKM22: { lat: -0.920, lng: 100.320 },  // ULAK KARANG
  PKM23: { lat: -0.980, lng: 100.270 },  // BUNGUS
  PKM24: { lat: -0.960, lng: 100.355 },  // PAUH
}
```

### Step 3 — Update Constants & Types

**`src/lib/constants.ts`**:

- Samakan threshold segmen dengan WebGIS: `SEGMEN_THRESHOLDS = { SANGAT_BAIK: 80, SEDANG: 50 }`
- Tambah konstanta tahun: `TAHUN_LIST = [2021, 2022, 2023, 2024]`

**`src/types/index.ts`**:

- Update `MapDataResponse` → tambah `demografi` dan `tahunTersedia`
- Update `GeoFeatureProperties` → tambah field yang dibutuhkan WebGIS

### Step 4 — Rewrite API `/api/map/data/route.ts`

**Tujuan:** Endpoint yang dulu return data mock, sekarang return data real dari DB.

```
Logic:
1. Baca query param ?tahun= (default: tahun terakhir)
2. Query data_bulanan + puskesmas + kecamatan via Prisma
3. Hitung rata-rata cakupan per kecamatan
4. Assign segmen per kecamatan (threshold 80%, 50%)
5. Load GeoJSON dari public/data/kecamatan-padang.geo.json
6. Inject properti segmen ke setiap feature GeoJSON
7. Generate GeoJSON untuk puskesmas (Point) dari koordinat + segmen
8. Return MapDataResponse
```

### Step 5 — Rewrite MapContainer.tsx

**Tujuan:** Gabungkan peta WebGIS + styling Next.js.

**Perubahan utama dari MapContainer yang ada:**

| Saat Ini | Setelah Integrasi |
|----------|------------------|
| Fallback polygon (hexagon) | ✅ GeoJSON real dari DB |
| Stat cards statis | ✅ Stat cards dinamis dari API |
| Tanpa tahun filter | ✅ TahunSelector component |
| Tanpa legenda | ✅ MapLegend component |
| Marker standar | ✅ Circular marker glassmorphism |
| Hover tooltip minimal | ✅ Popup dengan daftar puskesmas |

### Step 6 — Buat Komponen Baru

**`src/components/map/MapLegend.tsx`**:
- Legenda warna interaktif dengan glassmorphism card (ui-ux-pro-max style: `border rgba(255,255,255,0.08)` + `backdrop-blur`)
- Animasi hover pada setiap item segmen
- Tampilkan 3 segmen + lingkaran posisi puskesmas

**`src/components/map/YearSelector.tsx`**:
- Dropdown tahun dengan glass styling
- Trigger refetch data saat tahun berubah
- Default: tahun terakhir

**`src/components/map/KecamatanPopup.tsx`**:
- Popup interaktif: nama kecamatan, jumlah puskesmas, rata-rata cakupan, daftar puskesmas dalam `<ul>`
- Style mengikuti design system: dark glass, font Fira Sans

**`src/components/map/MapContent.tsx`**:
- Extract dari MapContainer.tsx yang sekarang (logic GeoJSON + Markers)
- Terima props `data` dan `tahun` untuk re-render saat filter berubah
- Animasi Framer Motion saat segmen berganti

### Step 7 — Update Halaman Peta

**`src/app/(dashboard)/peta/page.tsx`**:

- Layout: Full height map + floating stat cards (atas) + legenda (kanan bawah)
- Integrasi YearSelector di header map
- Gunakan AnimatePresence untuk transisi smooth saat ganti tahun

### Step 8 — Update Threshold Segmen

Samakan dengan WebGIS:

```typescript
const SEGMEN_COLORS = {
  SANGAT_BAIK: "#10b981",  // >= 80%  (WebGIS: #3cb44b → tailwind emerald-500)
  SEDANG: "#f59e0b",       // 50-79%  (WebGIS: #ffe119 → tailwind amber-400)
  RENDAH: "#ef4444",       // < 50%   (WebGIS: #e6194b → tailwind red-500)
}
```

### Step 9 — Tambah Demografi ke Response

**Tujuan:** Tampilkan data penduduk/kepadatan di popup atau sidebar.

- Load `webgis/data/indikator.json` sebagai seed data demografi
- Bisa ditambahkan ke tabel `Kecamatan` di Prisma (kolom baru) atau sebagai file static
- Tampilkan di popup kecamatan: "Penduduk: XX.XXX jiwa, Kepadatan: XXX/km²"

---

## Phase 4: REVIEW — Verifikasi & Quality Gate

### 4.1 Functional Review

| No | Check | Kriteria |
|----|-------|----------|
| 1 | GeoJSON termuat | Polygon 11 kecamatan muncul di peta, bukan fallback |
| 2 | Warna akurat | Warna polygon sesuai threshold (>=80% hijau, 50-79% kuning, <50% merah) |
| 3 | Marker puskesmas | 24 titik di posisi benar dengan segmen warna |
| 4 | Hover tooltip | Muncul tooltip nama kecamatan saat hover polygon |
| 5 | Klik popup | Popup daftar puskesmas muncul saat klik polygon |
| 6 | Tahun filter | Pilih tahun → data berubah + animasi transisi |
| 7 | Tabel data | Data kecamatan ter-filter sesuai tahun |
| 8 | Demografi | Penduduk & kepadatan muncul di popup |
| 9 | Legenda | 3 warna segmen + lingkaran puskesmas |

### 4.2 UI/UX Review (ui-ux-pro-max checklist)

- [ ] Dark mode konsisten (#0a0f1e background, glassmorphism cards)
- [ ] Semua interaksi ada hover state (cursor-pointer + opacity transition)
- [ ] Touch target minimal 44x44pt (di mobile)
- [ ] Animasi Framer Motion spring physics (damping 20, stiffness 90)
- [ ] prefers-reduced-motion dihormati
- [ ] Font: Fira Code (heading) + Fira Sans (body) via Google Fonts
- [ ] Tidak ada emoji sebagai icon — gunakan Phosphor icons
- [ ] Stroke & icon style konsisten
- [ ] Responsive: 375px (mobile stack), 768px (tablet side-by-side), 1440px (full)

### 4.3 Performance Review

- [ ] GeoJSON 115rb baris — perlu di-simplify untuk production? Test load time
- [ ] API response time — query Prisma dengan index `[puskesmasId, tanggal]`
- [ ] React re-render — gunakan `useMemo` + `React.memo` untuk GeoJSON layer
- [ ] Leaflet tile loading — gunakan tile caching `L.tileLayer(..., { maxZoom: 15 })`

### 4.4 Code Review

- [ ] TypeScript strict — tidak ada `any` di map-related code
- [ ] Error handling — try-catch di API + fallback loading di frontend
- [ ] Zod validation — query params tahun di API
- [ ] Prisma query — select spesifik, bukan `include: { all }`

---

## Phase 5: FIX / MANTAPKAN — Iterasi & Finalisasi

### 5.1 Common Issues & Fixes

| Issue | Diagnosis | Fix |
|-------|-----------|-----|
| GeoJSON slow to load | File 115rb baris berat | Simplify geometry via MapShaper atau load terkompresi |
| Warna segmen tidak update setelah ganti tahun | State tidak di-reset | Gunakan `key={tahun}` pada GeoJSON component |
| Marker koordinat tidak akurat | Estimasi kurang presisi | Verifikasi dengan Google Maps / koordinat real dari Dinas Kesehatan |
| Popup puskesmas overlapping | Terlalu banyak marker di zoom rendah | Gunakan `MarkerClusterGroup` untuk clustering |
| Map blank di mobile | Leaflet height tidak terdefinisi | Pastikan container `.h-full` dan parent `.h-screen` atau `.min-h-screen` |
| Tahun selector tidak ada data | Belum ada data di DB untuk tahun tertentu | Fallback: "Data tidak tersedia" + disable tahun |

### 5.2 Enhancements Post-Stabilization (Nice to Have)

- [ ] **Marker clustering** — Group puskesmas di zoom rendah (`react-leaflet-cluster`)
- [ ] **Search kecamatan** — Cepat navigasi ke kecamatan tertentu
- [ ] **Export map as image** — Download peta sebagai PNG dengan `html2canvas`
- [ ] **Animasi choropleth** — Saat ganti tahun, polygon animasi transisi warna
- [ ] **Layer toggle** — Show/hide: polygon, markers, labels
- [ ] **Tooltip cakupan** — Tampilkan % cakupan saat hover di samping nama kecamatan

### 5.3 Final Checklist

```
□ Phase 1 (READ)    — Semua aset teridentifikasi dan dipetakan
□ Phase 2 (THINK)   — Arsitektur, design system, data flow sudah clear
□ Phase 3 (BUILD)   — Implementasi selesai (9 steps)
□ Phase 4 (REVIEW)  — Functional, UI/UX, performance, code review passed
□ Phase 5 (FIX)     — Issues resolved, enhancements queued
```

---

## Timeline Estimasi

| Step | Task | Durasi |
|------|------|--------|
| 1 | Copy GeoJSON + sesuaikan properti | 10 menit |
| 2 | Mapping koordinat puskesmas | 15 menit |
| 3 | Update constants & types | 10 menit |
| 4 | Rewrite API `/api/map/data` | 40 menit |
| 5 | Rewrite MapContainer logic | 30 menit |
| 6 | Buat komponen (Legend, YearSelector, Popup) | 25 menit |
| 7 | Update halaman peta + layout | 15 menit |
| 8 | Update threshold segmen | 5 menit |
| 9 | Tambah demografi | 10 menit |
| **Total** | | **~2,5 jam** |
