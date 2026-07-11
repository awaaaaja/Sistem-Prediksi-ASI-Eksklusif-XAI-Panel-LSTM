# Product Requirement Document (PRD)

## Sistem Prediksi ASI Eksklusif + XAI Panel LSTM — 24 Puskesmas

---

## 1. Executive Summary

Proyek ini membangun **Web Application Premium** bernama **"Sistem Prediksi ASI Eksklusif + XAI Panel LSTM"** yang memprediksi cakupan ASI Eksklusif di 24 Puskesmas menggunakan model **LSTM Panel (Multi-Station)** yang telah ditraining sebelumnya. Aplikasi ini mengintegrasikan **Next.js 14+ (App Router)** sebagai full-stack framework, **MySQL** sebagai basis data relasional, dan **Python FastAPI** sebagai microservice inferensi model LSTM dan kalkulasi **SHAP (Explainable AI)**.

Keunikan utama aplikasi ini adalah fitur **XAI Insights** yang menerjemahkan kontribusi fitur `Jumlah_Bayi_6_Bulan` dan `Jumlah_ASI_Eksklusif` pada setiap lag waktu (t-1 hingga t-12) menjadi grafik interpretatif yang mudah dipahami oleh tenaga medis non-teknis.

---

## 2. Tujuan Proyek

| Tujuan | Deskripsi |
|---|---|
| **Prediksi Multi-Station + XAI** | Menyajikan prediksi cakupan ASI Eksklusif 24 Puskesmas + penjelasan kontribusi fitur per prediksi |
| **Upload & Validasi Cerdas** | Dropzone data tahunan, eliminasi otomatis tanggal cacat (30/31 Februari), penyatuan dengan data master |
| **Dashboard Premium** | Visualisasi time-series perbandingan data riil vs prediksi dengan animasi Framer Motion |
| **SHAP Force Plot Interaktif** | Grafik batang/force plot yang menerjemahkan dampak setiap fitur terhadap output prediksi |
| **Export Report Komprehensif** | Excel/CSV berisi data historis, hasil prediksi, dan nilai kontribusi SHAP per baris |

---

## 3. Target User

| User | Kebutuhan Utama |
|---|---|
| **Dinas Kesehatan (Dinkes)** | Pantauan makro 24 Puskesmas, analisis tren, evaluasi efektivitas program berbasis bukti SHAP |
| **Kepala Puskesmas** | Prediksi per Puskesmas, pemahaman faktor dominan (XAI) yang memengaruhi cakupan, upload data mandiri |
| **Epidemiolog / Peneliti** | Analisis kontribusi fitur sekuensial waktu, validasi model, interpretasi variabel lag |
| **Admin / Operator Data** | Upload, validasi, manajemen data master, ekspor laporan |

---

## 4. Arsitektur Sistem Terintegrasi

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         CLIENT  LAYER  (Next.js 14+)                      │
│  TypeScript · Tailwind CSS · Framer Motion · Recharts                    │
│  Glassmorphism UI · Dark Mode · SHAP Force Plot Component                │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │ Server Actions / Route Handlers
┌────────────────────────────▼─────────────────────────────────────────────┐
│                         API  LAYER  (Next.js)                             │
│  Server Actions · Route Handlers · Zod Validation · Rate Limiting        │
│  └ src/lib/actions/{predict,upload,export,shap}.ts                       │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
┌─────────────▼──────────────┐ ┌────────────▼─────────────────────────────┐
│     DATABASE  LAYER        │ │       ML / XAI ENGINE  (FastAPI)          │
│  MySQL 8                    │ │                                          │
│  Prisma ORM                 │ │  POST /ml/predict                        │
│  Tabel:                     │ │  POST /ml/predict/batch                  │
│  └ puskesmas (24 baris)     │ │  POST /ml/shap  ← ENDPOINT XAI BARU      │
│  └ data_bulanan (historis)  │ │  GET  /ml/health                         │
│  └ prediksi (output model)  │ │                                          │
│  └ shap_values (kontribusi) │ │  model_lstm_panel.h5                     │
│  └ upload_log (riwayat)     │ │  scaler_X.pkl · scaler_Y.pkl             │
│  └ users (auth)             │ │  SHAP DeepExplainer untuk LSTM 3D        │
└─────────────────────────────┘ └──────────────────────────────────────────┘
```

### 4.1 Alur Data Inference + XAI

1. **User** memilih Puskesmas + rentang waktu → *Server Action* `predictPuskesmas()`
2. Server mengambil **12 bulan historis** dari tabel `data_bulanan` → array 2D `(12, 3)` dengan kolom: `[Jumlah_Bayi_6_Bulan, Jumlah_ASI_Eksklusif, Persentase_Cakupan]`
3. Data dikirim ke **FastAPI endpoint `/ml/predict`**: JSON `{puskesmas_id, history: number[][]}`
4. FastAPI: `scaler_X.transform()` → reshape ke `(1, 12, 3)` → `model.predict()` → `scaler_Y.inverse_transform()`
5. **SHAP Calculation**: Panggil endpoint `/ml/shap` dengan data yang sama → gunakan `DeepExplainer` dengan *background distribution* dari data training → hasil: matriks SHAP `(12, 3)` per fitur per lag
6. Hasil prediksi + SHAP values dikembalikan ke Next.js → disimpan ke tabel `prediksi` dan `shap_values` → dirender dengan Recharts + komponen SHAP Force Plot kustom

### 4.2 Alur Upload & Append Data

1. User upload file CSV/XLSX tahunan melalui DropZone komponen
2. **Validasi server-side**: parse tanggal dengan `date-fns`, eliminasi 30/31 Februari, cek format `YYYY-MM-DD`, deteksi duplikasi `(puskesmas_id, bulan)`
3. **Preview**: tampilkan 10 baris pertama + ringkasan validasi
4. **Append**: insert batch data baru di atas `data_master_2021_2024.csv` (tabel `data_bulanan`)
5. Verifikasi: setiap Puskesmas memiliki ≥ 12 bulan data kontinu untuk sliding window

---

## 5. Functional Requirements

### 5.1 Dashboard Interaktif (Halaman Utama)

| ID | Fitur | Detail |
|---|---|---|
| F-01 | **Ringkasan Makro** | Kartu statistik glassmorphism: rata-rata cakupan, Puskesmas terbaik/terendah, tren bulanan, total bayi terukur |
| F-02 | **Grafik Time-Series** | Line chart (Recharts) perbandingan aktual vs prediksi 12 bulan ke depan, animasi stroke reveal Framer Motion |
| F-03 | **Selektor Puskesmas** | Dropdown search + autocomplete 24 Puskesmas, grouped by Kecamatan |
| F-04 | **Mode Perbandingan** | Pilih 2-4 Puskesmas untuk overlay grafik perbandingan |
| F-05 | **Tabel Data** | Tabel sorting/filter dengan SkeletonShimmer loading |

### 5.2 Module XAI Insights (SHAP)

| ID | Fitur | Detail |
|---|---|---|
| F-06 | **SHAP Force Plot** | Force plot interaktif: visualisasi kontribusi `Jumlah_Bayi_6_Bulan` dan `Jumlah_ASI_Eksklusif` per lag t-1 sd t-12 terhadap output prediksi |
| F-07 | **SHAP Summary Bar** | Bar chart horizontal: rata-rata |SHAP value| per fitur, menunjukkan fitur paling dominan |
| F-08 | **Feature Timeline** | Line chart kecil per fitur: bagaimana kontribusi fitur berubah sepanjang 12 lag waktu |
| F-09 | **Interpretasi Otomatis** | Paragraf naratif yang menjelaskan fitur mana yang menaikkan/menurunkan prediksi dalam bahasa awam medis |

### 5.3 Module Upload & Validasi Cerdas

| ID | Fitur | Detail |
|---|---|---|
| F-10 | **DropZone File** | Drag & drop atau klik, accept `.csv` dan `.xlsx`, preview maks 10 baris |
| F-11 | **Validasi Tanggal Cacat** | Eliminasi otomatis 30/31 Februari, 31 April, 31 Juni, 31 September, 31 November. Format `YYYY-MM-DD` wajib |
| F-12 | **Validasi Kolom** | Wajib: `Tanggal`, `Puskesmas`, `Jumlah_Bayi_6_Bulan`, `Jumlah_ASI_Eksklusif`. Cek tipe data numerik |
| F-13 | **Deteksi Duplikasi** | Cek kombinasi `(Puskesmas, Tanggal)` terhadap database, beri peringatan |
| F-14 | **Konfirmasi Append** | Ringkasan: total baris, valid, ditolak. Tombol \"Append\" baru eksekusi |
| F-15 | **Log Riwayat** | Tabel riwayat upload: filename, timestamp, status, jumlah baris |

### 5.4 Module Export Report

| ID | Fitur | Detail |
|---|---|---|
| F-16 | **Export Excel** | File `.xlsx` dengan multiple sheets: `Data Historis`, `Prediksi`, `SHAP Values`, dengan formatting profesional |
| F-17 | **Export CSV** | File `.csv` gabungan: Tanggal, Puskesmas, Aktual, Prediksi, SHAP_Jumlah_Bayi_t-1, ... SHAP_Jumlah_ASI_t-12 |
| F-18 | **Filter Export** | Pilih Puskesmas, rentang bulan, include/exclude SHAP columns |

---

## 6. Non-Functional Requirements

| Kategori | Spesifikasi |
|---|---|
| **Kinerja** | FCP < 1.5 detik; inferensi < 2 detik; SHAP kalkulasi < 5 detik |
| **Keamanan** | Validasi input client & server; prepared statements (Prisma); CSRF; rate limiting; file size limit 10MB |
| **Skalabilitas** | Mendukung > 24 Puskesmas tanpa perubahan arsitektur; stateless FastAPI |
| **Kompatibilitas** | Chrome, Firefox, Edge, Safari (2 versi terakhir); mobile-first dari 320px |
| **XAI Akurasi** | SHAP DeepExplainer dengan 100 background samples; konsistensi nilai antar request |
| **Data Integrity** | Transaksi database atomic untuk append; rollback otomatis jika gagal |

---

## 7. Spesifikasi Design System & Motion Layout

### 7.1 Tema Visual

| Elemen | Spesifikasi |
|---|---|
| **Mode** | Dark mode default (#0a0f1e), light mode opsi |
| **Aksen** | Emerald `#10b981` → Cyan `#06b6d4` (gradient) |
| **Glassmorphism** | `bg-white/5`, `backdrop-blur-xl`, `border-white/10`, `rounded-2xl` |
| **Glow** | `box-shadow: 0 0 25px rgba(16,185,129,0.2)` pada hover |
| **Font** | Inter (sans-serif), size token 12/14/16/20/24/32/48 |
| **SHAP Colors** | Merah (`#ef4444`) untuk kontribusi positif (menaikkan prediksi), Biru (`#3b82f6`) untuk negatif |

### 7.2 Motion & Animasi (Framer Motion)

| Komponen | Animasi |
|---|---|
| **Page Enter** | `initial={{opacity:0, y:20}}` → `animate={{opacity:1, y:0}}` duration 0.4s |
| **Card Hover** | `whileHover={{scale:1.02}}` + glow border, spring stiffness 300 |
| **Skeleton** | CSS shimmer `linear-gradient(90deg, ...)` background move 2s infinite |
| **Count-up** | `useMotionValue(0)` + `useSpring` + `useTransform` — angka bergerak naik |
| **Chart Line** | `pathLength` animasi 0→1, duration 1.2s, ease "easeInOut" |
| **SHAP Force Plot** | Bar muncul staggered dengan delay per fitur, spring bounce |
| **Modal/Toast** | Scale 0.95→1 + opacity 0→1; toast slide from right |

### 7.3 Komponen UI Premium

- `GlowCard` — Card glassmorphism + neon border hover
- `GradientButton` — Tombol emerald→cyan gradient + glow
- `AnimatedNumber` — Count-up dengan spring physics
- `SkeletonShimmer` — Placeholder loading shimmer
- `ShapForcePlot` — Visualisasi SHAP force plot kustom dengan SVG
- `ShapSummaryBar` — Bar chart horizontal kontribusi fitur
- `InterpretationCard` — Kartu narasi interpretasi XAI otomatis
- `DataTable` — Tabel sorting/filter dengan Framer Motion row enter

---

## 8. Spesifikasi Database MySQL

### 8.1 Entity Relationship

```prisma
model Puskesmas {
  id          Int           @id @default(autoincrement())
  kode        String        @unique @db.VarChar(10)
  nama        String        @db.VarChar(200)
  kecamatan   String        @db.VarChar(100)
  kabupaten   String        @db.VarChar(100)
  data_bulanan DataBulanan[]
  prediksi    Prediksi[]
  shap_values ShapValue[]
}

model DataBulanan {
  id                  Int       @id @default(autoincrement())
  puskesmas_id        Int
  tanggal             DateTime  // YYYY-MM-01 setelah normalisasi
  jumlah_bayi_6_bulan Float?
  jumlah_asi_eksklusif Float?
  persentase_cakupan  Float?    // Target
  puskesmas           Puskesmas @relation(fields: [puskesmas_id], references: [id])
  @@unique([puskesmas_id, tanggal])
  @@index([puskesmas_id, tanggal])
}

model Prediksi {
  id                Int       @id @default(autoincrement())
  puskesmas_id      Int
  bulan_prediksi    DateTime
  nilai_prediksi    Float
  nilai_aktual      Float?
  puskesmas         Puskesmas @relation(fields: [puskesmas_id], references: [id])
  @@unique([puskesmas_id, bulan_prediksi])
}

model ShapValue {
  id              Int       @id @default(autoincrement())
  prediksi_id     Int
  fitur           String    // "Jumlah_Bayi_6_Bulan" | "Jumlah_ASI_Eksklusif"
  lag             Int       // 1-12 (t-1 hingga t-12)
  shap_value      Float
  prediksi        Prediksi  @relation(fields: [prediksi_id], references: [id])
  @@index([prediksi_id])
}

model UploadLog {
  id            Int       @id @default(autoincrement())
  filename      String
  total_rows    Int
  rows_valid    Int
  rows_rejected Int
  status        String    // SUCCESS | PARTIAL | FAILED
  detail_error  String?
  created_at    DateTime  @default(now())
}
```

### 8.2 Index Strategis

- `data_bulanan`: composite index `(puskesmas_id, tanggal)` untuk sliding window query
- `prediksi`: index `(puskesmas_id, bulan_prediksi)` untuk lookup cepat
- `shap_values`: index `(prediksi_id)` untuk join dengan prediksi

---

## 9. API Contract

### 9.1 ML/XAI Engine (FastAPI — port 8000)

| Endpoint | Method | Request | Response |
|---|---|---|---|
| `/ml/health` | GET | — | `{status, model_loaded, scaler_X_loaded, scaler_Y_loaded, tensorflow_version, uptime}` |
| `/ml/predict` | POST | `{puskesmas_id, history: number[][]}` | `{success, puskesmas_id, predictions[], execution_time_ms}` |
| `/ml/predict/batch` | POST | `{stations: [{puskesmas_id, history}]}` | `{success, results[], errors[]}` |
| `/ml/shap` | POST | `{puskesmas_id, history: number[][]}` | `{success, shap_values: {feature_name: {lag: value}}[], expected_value}` |

### 9.2 Next.js API Routes

| Endpoint | Method | Deskripsi |
|---|---|---|
| `/api/puskesmas` | GET | Daftar 24 Puskesmas |
| `/api/data/history?puskesmas_id=X` | GET | Data historis per Puskesmas |
| `/api/data/upload` | POST | Upload + validasi file |
| `/api/data/append` | POST | Append data ke database |
| `/api/predict?puskesmas_id=X` | GET | Trigger prediksi + simpan |
| `/api/predict/shap?puskesmas_id=X` | GET | Trigger SHAP kalkulasi |
| `/api/export/csv` | GET | Download CSV report |
| `/api/export/excel` | GET | Download Excel report |

---

## 10. Data Spesifik (dari data_master_2021_2024.csv)

| Kolom | Tipe | Rentang | Fungsi |
|---|---|---|---|
| `Tanggal` | Date (YYYY-MM-DD) | 2021-01 s.d 2024-12 | Index temporal |
| `Kecamatan` | String | 11 Kecamatan | Grup geografis |
| `Puskesmas` | String | 24 Puskesmas | Entitas prediksi |
| `Jumlah_Bayi_6_Bulan` | Float (0-1) | ~0.03 - 0.98 | Fitur (sudah dinormalisasi) |
| `Jumlah_ASI_Eksklusif` | Float (0-1) | ~0.02 - 0.98 | Fitur (sudah dinormalisasi) |
| `Persentase_Cakupan` | Float (%) | ~55% - 93% | **Target prediksi** |

**Catatan XAI**: SHAP akan menghitung kontribusi `Jumlah_Bayi_6_Bulan` dan `Jumlah_ASI_Eksklusif` pada setiap **lag waktu t-1 hingga t-12** terhadap output `Persentase_Cakupan`. Total 24 nilai SHAP per prediksi (2 fitur × 12 lag).

---

## 11. Pengukuran Keberhasilan

| Metrik | Target |
|---|---|
| Waktu Inferensi LSTM | < 2 detik per Puskesmas |
| Waktu Kalkulasi SHAP | < 5 detik per Puskesmas |
| Akurasi Validasi Tanggal | 100% eliminasi tanggal cacat |
| First Contentful Paint | < 1.5 detik |
| SHAP Explanations Valid | Konsisten secara matematis (sum SHAP + expected_value ≈ prediction) |
| Kepuasan Pengguna (UEQ) | Skor ≥ 2.0 |
