# Plan Tiered Scaling + Monthly Variation — Data ASI Eksklusif

> **Tujuan:** Scaling data CSV agar peta interaktif menampilkan variasi realistis (hijau + kuning) dengan dominasi **Sangat Baik (≥80%)**, bukan seragam semua hijau.
> **Masalah:** Scaling sebelumnya (target semua ≥80%) membuat 99.9% rows hijau — peta terlihat tidak realistis.
> **Solusi:** Tiered target per puskesmas berdasarkan ranking historis + noise bulanan ±3%.
> **Estimasi:** ~2 jam

---

## Phase 1: READ — Memahami Data & Pipeline

### 1.1 Distribusi Historis Per Puskesmas (Rata-rata 71-75%)

| # | Puskesmas | Rata-rata Asli | Range | Tier |
|---|-----------|---------------|-------|------|
| 1 | LUBUK BEGALUNG | 71.14% | 56.8-86.2 | ↓ Rendah |
| 2 | BUNGUS | 71.25% | 56.1-84.9 | ↓ Rendah |
| 3 | ANAK AIR | 71.61% | 55.1-87.5 | ↓ Rendah |
| 4 | IKUR KOTO | 72.02% | 57.0-91.6 | ↓ Rendah |
| 5 | AIR DINGIN | 72.09% | 55.6-88.2 | → Sedang |
| 6 | LAPAI | 72.25% | 55.6-89.9 | → Sedang |
| 7 | TUNGGUL HITAM | 72.40% | 55.1-89.3 | → Sedang |
| 8 | AMBACANG | 72.75% | 56.0-88.9 | → Sedang |
| 9 | SEBERANG PADANG | 72.80% | 59.0-91.8 | → Sedang |
| 10 | ANDALAS | 72.90% | 56.3-90.7 | → Sedang |
| 11 | PARAK KARAKAH | 73.19% | 56.1-87.9 | → Sedang |
| 12 | ALAI | 73.36% | 56.3-90.1 | → Sedang |
| 13 | PADANG PASIR | 73.72% | 56.3-91.3 | ↑ Tinggi |
| 14 | PAUH | 73.75% | 56.9-89.8 | ↑ Tinggi |
| 15 | PEGAMBIRAN | 73.78% | 56.9-91.3 | ↑ Tinggi |
| 16 | LUBUK KILANGAN | 73.78% | 56.9-89.7 | ↑ Tinggi |
| 17 | LB.BUAYA | 73.92% | 58.8-90.6 | ↑ Tinggi |
| 18 | AIR TAWAR | 74.09% | 56.3-91.2 | ↑ Tinggi |
| 19 | RAWANG | 74.39% | 57.8-90.4 | ↑ Tinggi |
| 20 | PEMANCUNGAN | 74.41% | 57.8-91.4 | ↑ Tinggi |
| 21 | BELIMBING | 74.62% | 56.1-90.1 | ↑ Tinggi |
| 22 | ULAK KARANG | 74.75% | 57.8-88.8 | ↑ Tinggi |
| 23 | NANGGALO | 74.90% | 58.5-92.5 | ↑ Tinggi |
| 24 | KURANJI | 75.14% | 58.2-90.7 | ↑ Tinggi |

### 1.2 Inconsistency Data Asli

```
Row: 2021-01-31, AIR DINGIN
  Bayi = 0.649, ASI = 0.648
  ASI/Bayi × 100 = 99.74%
  Tapi Persentase_Cakupan = 84.62% ❌
```

### 1.3 Pipeline Saat Ini

```
data_master_2021_2024_scaled.csv  (1152 rows, scaled)
    ├── prisma/seed.ts        → MySQL Database → API → Map & Dashboard
    ├── ml-engine/retrain.py  → LSTM Model (.keras) → ML Engine → API → Prediksi
    └── ml-engine/evaluate.py → Evaluasi per puskesmas
```

### 1.4 File yang Terkena Dampak

| File | Peran | Aksi |
|------|-------|------|
| `data_master_2021_2024_scaled.csv` | CSV scaling saat ini | ❌ **Akan di-replace** |
| `ml-engine/training/retrain.py` (line 52) | Baca CSV training | ✅ Sudah mengarah ke scaled |
| `ml-engine/training/evaluate.py` (line 24) | Baca CSV evaluasi | ✅ Sudah mengarah ke scaled |
| `prisma/seed.ts` (line 119) | Baca CSV seed | ✅ Sudah mengarah ke scaled |
| `ml-engine/models/model_lstm_panel.keras` | Model LSTM | ❌ **Replace** (retrain ulang) |
| `ml-engine/models/scaler_X.pkl` | Scaler fitur | ❌ **Replace** (retrain ulang) |
| `ml-engine/models/scaler_Y.pkl` | Scaler target | ❌ **Replace** (retrain ulang) |

---

## Phase 2: THINKING — Strategi Tiered Scaling

### 2.1 Arsitektur Tier

```
4 Bottom  ──→ target 75-80% → rata-rata ~78% → Marker KUNING di peta
12 Middle ──→ target 80-85% → rata-rata ~83% → Marker HIJAU TERANG
8 Top     ──→ target 83-88% → rata-rata ~86% → Marker HIJAU GELAP
```

### 2.2 Monthly Variation Logic

```
Untuk SETIAP row, dihitung per-bulan:

  target_base[puskesmas] = tier_target        // 0.78 / 0.83 / 0.86
  noise = uniform(-0.03, +0.03)               // ±3% acak per bulan
  target_aktual = target_base + noise
  CLAMP(target_aktual, 0.72, 0.92)            // floor 72%, ceiling 92%

  current_ratio = Jumlah_ASI / Jumlah_Bayi
  factor = target_aktual / current_ratio

  Jumlah_ASI_baru = (Jumlah_ASI × factor).toFixed(15)
  Persentase_Cakupan_baru = (ASI_baru / Bayi × 100).toFixed(2)

  Edge case: jika Bayi = 0 atau ASI = 0 → SKIP (pertahankan nilai asli)
```

**Mengapa ±3%?**
| Noise | Variasi Per Bulan | Hasil Peta |
|-------|-------------------|------------|
| 0% | Semua row identik per puskesmas | Tidak realistis |
| ±1% | Std dev ~0.5% | Masih terlalu rapat |
| ±3% | Std dev ~1.5-2% | Variasi alami, realistis |
| ±5% | Std dev ~3% | Terlalu liar, banyak outlier |

### 2.3 Ekspektasi Distribusi Setelah Scaling

| Segmen | Range | Data Asli | Target Setelah Scaling |
|--------|-------|-----------|----------------------|
| Sangat Baik | ≥ 80% | 0% | **~75-85% rows** |
| Sedang | 50-79% | 100% | **~15-25% rows** |
| Rendah | < 50% | 0% | **0%** (clamp floor 72%) |

Per puskesmas:
| Tier | Puskesmas | Target Base | Rata-rata Bulanan | Warna Peta |
|------|-----------|-------------|-------------------|------------|
| ↓ Bottom | 4 | 0.78 | ~77-79% | **Kuning** |
| → Middle | 12 | 0.83 | ~81-84% | **Hijau Muda** |
| ↑ Top | 8 | 0.86 | ~84-87% | **Hijau Tua** |

### 2.4 Dampak ke Fitur LSTM

| Fitur | Dampak | Keterangan |
|-------|--------|------------|
| `Jumlah_ASI_Eksklusif` | ⬆️ Naik bervariasi | Scaling berbeda per tier |
| `Rasio_ASI_Bayi` | ⬆️ Naik, variasi tetap | Noise ±3% menjaga variasi |
| `Lag1/2/3_Target` | ⬆️ Ikut naik | Autoregressive tetap konsisten |
| `Month_Sin/Cos` | ✅ Tidak berubah | Encoding musiman tetap |
| `Year_Trend` | ✅ Tidak berubah | Trend tetap |

### 2.5 Risiko

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| R² turun karena variasi terbatas | Model kurang general | Pantau val_r2, jika < 0.80 → naikkan noise ke ±4% |
| Tier boundary terlalu kaku | Loncatan antar tier tidak smooth | Noise ±3% akan menciptakan transisi alami |
| Data sintetik overfit | Prediksi tidak akurat | Pertahankan pola musiman asli (ratio asli × factor) |

---

## Phase 3: BUILD — 6 Langkah Implementasi

### Step 1 — Generate Ulang CSV (Tiered + Monthly Noise)

**Input:** `data_master_2021_2024.csv`
**Output:** `data_master_2021_2024_scaled.csv` (replace)
**Durasi:** 10 menit

```javascript
const fs = require('fs');

// Tier assignment
const TIERS = {
  target: {
    'LUBUK BEGALUNG': 0.78, 'BUNGUS': 0.78,
    'ANAK AIR': 0.78, 'IKUR KOTO': 0.78,
    'AIR DINGIN': 0.83, 'LAPAI': 0.83,
    'TUNGGUL HITAM': 0.83, 'AMBACANG': 0.83,
    'SEBERANG PADANG': 0.83, 'ANDALAS': 0.83,
    'PARAK KARAKAH': 0.83, 'ALAI': 0.83,
    'PADANG PASIR': 0.83, 'PAUH': 0.83,
    'PEGAMBIRAN': 0.83, 'LUBUK KILANGAN': 0.83,
    'LB.BUAYA': 0.86, 'AIR TAWAR': 0.86,
    'RAWANG': 0.86, 'PEMANCUNGAN': 0.86,
    'BELIMBING': 0.86, 'ULAK KARANG': 0.86,
    'NANGGALO': 0.86, 'KURANJI': 0.86,
  }
};

const csvData = fs.readFileSync('data_master_2021_2024.csv','utf-8').trim().split('\n');
const header = csvData[0];
const rows = csvData.slice(1).map(r => r.split(','));

for (const cols of rows) {
  const pkm = cols[2];
  const bayi = parseFloat(cols[3]);
  const asi = parseFloat(cols[4]);

  if (bayi > 0 && asi > 0) {
    const baseTarget = TIERS.target[pkm] || 0.83;
    const noise = (Math.random() - 0.5) * 0.06;  // ±3%
    let targetPct = baseTarget + noise;
    if (targetPct < 0.72) targetPct = 0.72;
    if (targetPct > 0.92) targetPct = 0.92;

    const currentRatio = asi / bayi;
    const factor = targetPct / currentRatio;
    cols[4] = (asi * factor).toFixed(15);
    cols[5] = ((parseFloat(cols[4]) / bayi) * 100).toFixed(2);
  }
  // Edge case: skip jika bayi=0 atau asi=0
}

fs.writeFileSync('data_master_2021_2024_scaled.csv',
  [header, ...rows.map(r => r.join(','))].join('\n'));
```

**Verifikasi:**
- [ ] 1152 rows, 6 kolom, header identik
- [ ] Bottom 4: rata-rata ~78%, mayoritas bulan < 80%
- [ ] Middle 12: rata-rata ~83%, mayoritas bulan ≥ 80%
- [ ] Top 8: rata-rata ~86%, hampir semua bulan ≥ 80%
- [ ] Variasi per puskesmas: std dev 1.5-2%
- [ ] Konsistensi: `PCT = ASI/Bayi × 100` untuk semua row

### Step 2 — Update Path (Skip — sudah dilakukan)

✅ `retrain.py`, `evaluate.py`, `seed.ts` sudah mengarah ke `data_master_2021_2024_scaled.csv`

### Step 3 — Retrain LSTM Model

```bash
cd D:\lstm2
python ml-engine\training\retrain.py
```

**Durasi:** 30-60 menit (300 epochs, early stopping)

**Target metrics:**
| Metric | Target | Warning |
|--------|--------|---------|
| Val R² | ≥ 0.80 | < 0.70 → rollback |
| Val MAE | < 3.0% | > 5.0% → evaluasi |
| Segment accuracy | ≥ 85% | < 70% → noise terlalu besar |

### Step 4 — Re-seed Database

```bash
cd D:\lstm2
npx prisma db seed
```

**Durasi:** 5 menit

**Verifikasi:**
- [ ] 1152 baris data bulanan
- [ ] 288 segmen indikator
- [ ] Rata-rata cakupan kota: ~82-84%

### Step 5 — Rebuild

```bash
cd D:\lstm2
npm run build
```

**Verifikasi:** Compiled successfully, 0 errors.

### Step 6 — Review di Browser

**Verifikasi manual:**
- [ ] **Halaman Peta** — marker puskesmas: 4 kuning + 20 hijau
- [ ] **Filter tahun** — Variasi antar tahun terlihat
- [ ] **Popup kecamatan** — Rata-rata cakupan sesuai tier
- [ ] **Halaman Dashboard** — Rata-rata kota ~82-84%
- [ ] **Detail Puskesmas** — Prediksi sesuai range tier
- [ ] **Statistik Segmen** — Tidak 100% Sangat Baik

---

## Phase 4: REVIEW — Quality Gate

### 4.1 Functional Review

| No | Check | Kriteria |
|----|-------|----------|
| 1 | CSV baru | 1152 rows, header identik, 6 kolom |
| 2 | PCT konsisten | `PCT = ASI/Bayi × 100` untuk semua row |
| 3 | Tier Bottom | Rata-rata 75-80%, banyak bulan < 80% |
| 4 | Tier Middle | Rata-rata 80-85%, mayoritas ≥ 80% |
| 5 | Tier Top | Rata-rata 83-88%, hampir semua ≥ 80% |
| 6 | Monthly noise | Std dev ≥ 1.0% per puskesmas |
| 7 | Segmentasi peta | 4 kuning + 20 hijau (atau variasi wajar) |
| 8 | Model retrain | Val R² ≥ 0.80 |
| 9 | Seed database | 1152 rows, rata-rata cakupan 82-84% |

### 4.2 Distribusi Peta (Espektasi)

```
Legenda:
  🟢 Hijau (≥80%)  = 18-21 puskesmas
  🟡 Kuning (50-79%) = 3-6 puskesmas
  🔴 Merah (<50%)   = 0 puskesmas

Alasan 0 merah:
  - Clamp floor 72% mencegah row < 50%
  - Bottom tier target 75-80% + noise max -3% = minimal 72%
```

### 4.3 Rollback Plan

Jika hasil tidak sesuai:

```bash
# 1. Hapus CSV hasil scaling yang bermasalah
Remove-Item data_master_2021_2024_scaled.csv

# 2. Kembalikan path file ke CSV asli
git checkout -- ml-engine/training/retrain.py
git checkout -- ml-engine/training/evaluate.py
git checkout -- prisma/seed.ts

# 3. Jalankan ulang scaling dengan parameter berbeda
#    (misal: naikkan noise ke ±4% atau ubah tier targets)
```

---

## Phase 5: FIX / MANTAPKAN — Iterasi & Finalisasi

### 5.1 Common Issues & Fixes

| Issue | Diagnosis | Fix |
|-------|-----------|-----|
| Bottom tier rata-rata > 80% | Target 78% terlalu tinggi | Turunkan baseTarget ke 0.76 |
| Semua puskesmas masih hijau | Tier grouping tidak efektif | Periksa TIERS.target mapping |
| Model R² < 0.70 | Variasi terlalu kecil | Naikkan noise ke ±4% atau ±5% |
| Variasi per bulan terlalu rendah | Noise ±3% belum cukup | Naikkan noise ke ±4% |
| Peta tidak update | Data DB masih lama | `npx prisma db seed` ulang + restart |

### 5.2 Fine-tuning Parameters

| Parameter | Default | Kalau Kurang Variasi | Kalau Terlalu Liar |
|-----------|---------|---------------------|-------------------|
| Base target Bottom | 0.78 | Turun ke 0.76 | Naik ke 0.80 |
| Base target Middle | 0.83 | Turun ke 0.81 | Naik ke 0.85 |
| Base target Top | 0.86 | Turun ke 0.84 | Naik ke 0.88 |
| Noise | ±3% | Naik ke ±4% | Turun ke ±2% |
| Clamp floor | 72% | Turun ke 70% | Naik ke 75% |
| Clamp ceiling | 92% | Turun ke 90% | Naik ke 95% |

### 5.3 Enhancements Post-Stabilization

- [ ] **Color scale di peta** — gradient continuous bukan 3 segmen diskrit
- [ ] **Tooltip bulanan** — hover marker → lihat tren per bulan
- [ ] **Export grafik** — per puskesmas: line chart real vs scaled

---

## Timeline

| Step | Task | Durasi |
|------|------|--------|
| 1 | Generate ulang CSV tiered + noise | 10 menit |
| 2 | Update path (skip — sudah) | 0 menit |
| 3 | Retrain LSTM model | 30-60 menit |
| 4 | Re-seed database | 5 menit |
| 5 | Rebuild | 10 menit |
| 6 | Review di browser | 15 menit |
| **Total** | | **~1,5 jam** |

---

## Summary

```
Data Asli (71-75% per puskesmas, 100% Sedang)
       │
       ▼ Tiered Scaling + Monthly Noise
       │
   4 Bottom (target 75-80%)  → 🟡 3-6 Kuning di peta
  12 Middle (target 80-85%)  → 🟢 18-21 Hijau di peta
   8 Top    (target 83-88%)  → 🟢
       │
       ├── retrain.py → Model LSTM baru
       └── seed.ts → Database baru
              │
              ▼ Peta Realistis: Kuning + Hijau, variasi per bulan
```
