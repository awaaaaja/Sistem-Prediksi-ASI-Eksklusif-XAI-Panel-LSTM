# Rencana Implementasi: Retrain Model + SHAP Counterfactual Analysis

## 1. Latar Belakang

**Kondisi saat ini:**
- Model (model_lstm_panel.keras) dilatih dengan data data_master_2021_2025_sangat_baik.csv — data yang dimodifikasi (semua nilai <80% dipaksa >=80%)
- Database di-seed dengan data_master_2021_2024_scaled.csv — hanya sampai 2024, dengan nilai scaled

**Masalah untuk sidang:**
- Modifikasi data (sangat_baik) sulit dipertahankan secara akademik
- Reviewer akan mempertanyakan: "Apa dasar ilmiah mengubah data asli?"
- Data scaled di database tidak sesuai dengan data asli

**Solusi:** Gunakan data asli (data_master_2021_2025_raw.csv) untuk training dan seed. Gunakan SHAP Counterfactual untuk memberikan interpretasi bagaimana mencapai target >=80% tanpa memodifikasi data.

---

## 2. Ringkasan Perubahan

| # | File | Perubahan | Tujuan |
|---|------|-----------|--------|
| 1 | ml-engine/training/retrain.py | CSV_PATH -> data_master_2021_2025_raw.csv | Train model dengan data asli |
| 2 | prisma/seed.ts | Path CSV -> data_master_2021_2025_raw.csv | Seed database dengan data asli 2021-2025 |
| 3 | src/types/index.ts | Tambah interface baru | Tipe data counterfactual |
| 4 | src/components/xai/counterfactual-analysis.tsx | File baru | Komponen analisis counterfactual |
| 5 | src/app/(dashboard)/puskesmas/[id]/page.tsx | Render komponen baru | Tampilkan analisis di halaman detail |
| 6 | Eksekusi retrain + reseed | Run scripts | Implementasi perubahan |

---

## 3. Detail Perubahan per File

### 3.1. ml-engine/training/retrain.py

**Sebelum (baris 52):**
CSV_PATH = os.path.join(..., "data_master_2021_2025_sangat_baik.csv")

**Sesudah:**
CSV_PATH = os.path.join(..., "data_master_2021_2025_raw.csv")

**Efek:** Model dilatih dengan data asli. Target distribusi: mean~74%, std~9%, range 55-95%.

---

### 3.2. prisma/seed.ts

**Sebelum (baris 119):**
const csvPath = path.join(__dirname, "..", "data_master_2021_2024_scaled.csv")

**Sesudah:**
const csvPath = path.join(__dirname, "..", "data_master_2021_2025_raw.csv")

Catatan: Kedua CSV memiliki kolom identik (Tanggal,Kecamatan,Puskesmas,Jumlah_Bayi_6_Bulan,Jumlah_ASI_Eksklusif,Persentase_Cakupan). Jumlah data: 1.440 baris (24 puskesmas x 60 bulan = 2021-2025).

---

### 3.3. src/types/index.ts — Interface Baru

Sisipkan setelah ShapResponse (setelah baris 76):

export interface CounterfactualAnalysis {
  prediction: number
  targetValue: number
  gap: number
  isTargetMet: boolean
  topNegativeFeatures: {
    feature: string
    currentValue: number
    totalShapContribution: number
    estimatedRequiredChange: number
    recommendedValue: number
  }[]
  primaryIntervention: {
    feature: string
    currentValue: number
    currentLabel: string
    targetValue: number
    targetLabel: string
  } | null
}

---

### 3.4. src/components/xai/counterfactual-analysis.tsx — File Baru

Komponen analisis counterfactual yang menerima prediction, shapData, dan 12 bulan history terakhir.

Logika perhitungan:

1. Cek apakah prediction >= 80
   - Ya: tampilkan "Target 80% Tercapai"
   - Tidak: lanjut ke analisis

2. Hitung gap = 80 - prediction

3. Hitung total SHAP per fitur (sum across all 12 lags)

4. Primary intervention pada Rasio_ASI_Bayi (fitur dengan korelasi r=0.89, yang actionable)

5. Estimasi target ratio:
   - Ambil current ratio dari history terakhir
   - Hitung sensitivity dari data: slope linear regression ratio vs coverage
   - target_ratio = current_ratio + (gap / sensitivity_estimate)

6. Visualisasi:
   - Progress bar: target 80% vs prediction
   - Jika belum tercapai: card rekomendasi intervensi
   - Feature cards: Rasio_ASI_Bayi, dengan current value dan target
   - Daftar fitur negatif lain yang perlu ditingkatkan

---

### 3.5. src/app/(dashboard)/puskesmas/[id]/page.tsx

Tambah import CounterfactualAnalysis component.
Render di bawah SHAP visualization section.

---

### 3.6. Eksekusi

Step 1 — Retrain model:
  cd ml-engine
  .\venv\Scripts\python training\retrain.py

Step 2 — Reseed database:
  npx tsx prisma/seed.ts

Step 3 — Run aplikasi:
  npm run dev:all

---

## 4. Data Flow

Data Asli 2021-2025
  -> Train Model (R^2 ~0.98 real)
    -> Prediksi natural (mean ~74%, std ~9%)
      -> Prediksi < 80%? 
        -> SHAP Counterfactual: "Perlu tingkatkan Rasio ASI/Bayi dari X ke Y"
      -> Prediksi >= 80%?
        -> "Target Tercapai"

---

## 5. Perbandingan Sebelum vs Sesudah

Aspek              | Sebelum (Sangat Baik)         | Sesudah (Data Asli + SHAP CF)
-------------------|-------------------------------|-------------------------------
Data Training      | Dimodifikasi (forced >=80%)   | Asli (natural distribution)
R^2                | 0.995 (tapi artificial)       | ~0.985 (real)
MAE                | 0.21% (terlalu rendah)        | ~0.81% (realistic)
Variasi            | std=2.84% (sempit)            | std~9% (natural)
Justifikasi Sidang | Sulit: "mengapa data diubah?" | Kuat: "model akurat, SHAP explainable"
Nilai Penelitian   | Rendah                        | Tinggi: insight actionable dari SHAP
