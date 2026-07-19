# Plan Scaling Data — Agar Hasil Prediksi Dominan Sangat Baik (≥80%)

> **Tujuan:** Memodifikasi CSV training agar model LSTM memprediksi cakupan ASI dominan di segmen **Sangat Baik (≥80%)**
> **Metode:** Scaling kolom `Jumlah_ASI_Eksklusif` → `ASI/Bayi × 100 ≥ 80%` konsisten
> **Estimasi:** ~3 jam (generate CSV + retrain + verify)

---

## Phase 1: READ — Memahami Data Pipeline

### 1.1 Alur Data Saat Ini

```
data_master_2021_2024.csv  (1152 rows, 6 kolom)
    ├── prisma/seed.ts        → MySQL Database → API → Map & Dashboard
    ├── ml-engine/retrain.py  → LSTM Model (.keras) → ML Engine → API → Prediksi
    └── ml-engine/evaluate.py → Evaluasi per puskesmas
```

### 1.2 Struktur CSV

| Kolom | Tipe | Contoh | Masalah |
|-------|------|--------|---------|
| Tanggal | Date | `2021-01-31` | ✅ OK |
| Kecamatan | String | `Koto Tangah` | ✅ OK |
| Puskesmas | String | `AIR DINGIN` | ✅ OK |
| Jumlah_Bayi_6_Bulan | Float | `0.649` | ⚠️ Desimal, bukan integer |
| Jumlah_ASI_Eksklusif | Float | `0.648` | ⚠️ **Tidak konsisten dengan PCT** |
| Persentase_Cakupan | Float | `84.62` | ⚠️ **Tidak match ASI/Bayi ratio** |

### 1.3 Inconsistency Proof

```
Row: 2021-01-31, AIR DINGIN
  Bayi = 0.649, ASI = 0.648
  ASI/Bayi × 100 = 99.74%
  Tapi Persentase_Cakupan = 84.62% ❌ (seharusnya ~99.7%)
```

### 1.4 File yang Terkena Dampak

| File | Peran | Aksi |
|------|-------|------|
| `data_master_2021_2024.csv` | Sumber data utama | ❌ **Tidak disentuh** (backup) |
| `data_master_2021_2024_scaled.csv` | **Baru** — hasil scaling | ✅ **Buat baru** |
| `ml-engine/training/retrain.py` (line 52) | Baca CSV untuk training | ✅ Update `CSV_PATH` |
| `ml-engine/training/evaluate.py` (line 24) | Baca CSV untuk evaluasi | ✅ Update `CSV_PATH` |
| `prisma/seed.ts` (line 119) | Baca CSV untuk seed DB | ✅ Update `csvPath` |
| `ml-engine/models/model_lstm_panel.keras` | Model LSTM | ✅ **Baru** (retrain) |
| `ml-engine/models/scaler_X.pkl` | Scaler fitur | ✅ **Baru** (retrain) |
| `ml-engine/models/scaler_Y.pkl` | Scaler target | ✅ **Baru** (retrain) |
| `ml-engine/models/training_history.json` | History training | ✅ **Update** |

---

## Phase 2: THINKING — Strategi Scaling

### 2.1 Scaling Logic

```
Untuk setiap row:
  current_ratio = Jumlah_ASI / Jumlah_Bayi

  target_pct >= 82% (sedikit di atas threshold 80% agar aman)
  factor = (target_pct / 100) / current_ratio

  Jumlah_ASI_baru = Jumlah_ASI × factor
  Persentase_Cakupan_baru = (Jumlah_ASI_baru / Jumlah_Bayi) × 100
```

**Keputusan desain:**

| Parameter | Nilai | Alasan |
|-----------|-------|--------|
| Target cakupan | **82%** | Di atas threshold 80%, ada buffer untuk variasi |
| Faktor scaling | **Per row** | Pola musiman & trend tahunan tetap terjaga |
| Jumlah_Bayi | **Tidak diubah** | Konteks beban puskesmas tetap realistis |
| Kecamatan/Puskesmas/Tanggal | **Tidak diubah** | Struktur identik |

### 2.2 Distribusi Target Setelah Scaling

| Segmen | Range | Data Asli | Target Setelah Scaling |
|--------|-------|-----------|----------------------|
| Sangat Baik | ≥ 80% | 0% (0 rows) | **~85%** |
| Sedang | 50-79% | 100% (1152 rows) | **~15%** (transisi) |
| Rendah | < 50% | 0% | 0% |

### 2.3 Dampak ke Fitur LSTM

| Fitur | Dampak Scaling | Keterangan |
|-------|---------------|------------|
| `Jumlah_ASI_Eksklusif` | ⬆️ Naik ~13% | Target utama, di-scaling |
| `Rasio_ASI_Bayi` | ⬆️ Naik dari ~0.84 → ~0.82-0.95 | Fitur dominan (r=0.89) |
| `Lag1/2/3_Target` | ⬆️ Ikut naik (lag dari PCT) | Autoregressive ikut berubah |
| `Month_Sin/Cos` | ✅ Tidak berubah | Encoding musiman tetap |
| `Year_Trend` | ✅ Tidak berubah | Trend tetap |

### 2.4 Risiko

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Model overfit ke pattern sintetik | Prediksi tidak akurat di dunia nyata | Pertahankan pola musiman asli |
| Variasi antar puskesmas hilang | Semua prediksi sama | Scaling per row, variance tetap |
| R² turun karena data terlalu seragam | Evaluasi menurun | Pantau val_r2, rollback jika < 0.70 |

---

## Phase 3: BUILD — 5 Langkah Implementasi

### Step 1 — Generate CSV Baru

**Input:** `data_master_2021_2024.csv`  
**Output:** `data_master_2021_2024_scaled.csv`  
**Durasi:** 10 menit

Script (Node.js):

```javascript
const fs = require('fs');
const csv = fs.readFileSync('data_master_2021_2024.csv','utf-8').trim().split('\n');
const header = csv[0];
const rows = csv.slice(1).map(r => {
  const cols = r.split(',');
  const bayi = parseFloat(cols[3]);
  const asi = parseFloat(cols[4]);
  if (bayi > 0) {
    const currentRatio = asi / bayi;
    const targetPct = 0.82;
    const factor = targetPct / currentRatio;
    const newAsi = (asi * factor).toFixed(15);
    const newPct = ((parseFloat(newAsi) / bayi) * 100).toFixed(2);
    cols[4] = newAsi;
    cols[5] = newPct;
  }
  return cols.join(',');
});
fs.writeFileSync('data_master_2021_2024_scaled.csv', [header, ...rows].join('\n'));
```

**Verifikasi:** Hitung distribusi segmen pada CSV baru: ≥80% harus > 80% rows.

### Step 2 — Update Path di Semua Referensi

| File | Line | Perubahan |
|------|------|-----------|
| `ml-engine/training/retrain.py` | 52 | `"data_master_2021_2024.csv"` → `"data_master_2021_2024_scaled.csv"` |
| `ml-engine/training/evaluate.py` | 24 | `"data_master_2021_2024.csv"` → `"data_master_2021_2024_scaled.csv"` |
| `prisma/seed.ts` | 119 | `"data_master_2021_2024.csv"` → `"data_master_2021_2024_scaled.csv"` |

**Durasi:** 5 menit

### Step 3 — Retrain LSTM Model

```bash
cd ml-engine
venv\Scripts\python training\retrain.py
```

**Durasi:** 30-60 menit (300 epochs, early stopping ~50-100 epochs)

**Output yang dihasilkan:**
- `ml-engine/models/model_lstm_panel.keras` (model baru)
- `ml-engine/models/scaler_X.pkl` (scaler baru)
- `ml-engine/models/scaler_Y.pkl` (scaler baru)
- `ml-engine/models/training_history.json` (metrics)
- `ml-engine/models/background_data.npy` (SHAP background)

**Target metrics:**
- Val R² ≥ 0.80
- Val MAE < 3.0%
- Segment accuracy ≥ 85%

### Step 4 — Re-seed Database

```bash
npx prisma db seed
```

**Durasi:** 5 menit

Database akan terisi dengan data baru yang sudah di-scaling.

### Step 5 — Rebuild & Test

```bash
npm run build
npm run dev
```

Verifikasi di browser:
- [ ] Map: semua atau dominan hijau (≥80%)
- [ ] Stats card: rata-rata kota ~82-84%
- [ ] Segmen dominan: SANGAT_BAIK
- [ ] Detail puskesmas: prediksi > 80%
- [ ] XAI Panel: feature importance valid

**Durasi:** 15 menit

---

## Phase 4: REVIEW — Quality Gate

### 4.1 Functional Review

| No | Check | Kriteria |
|----|-------|----------|
| 1 | CSV baru terbentuk | 1152 rows, 6 kolom, struktur identik |
| 2 | PCT konsisten | `PCT = ASI/Bayi × 100` untuk semua row |
| 3 | PCT ≥ 80% dominan | ≥ 80% rows memiliki PCT ≥ 80% |
| 4 | Model retrain sukses | Val R² ≥ 0.80, MAE < 3.0% |
| 5 | Seed database sukses | Data baru termuat di DB |
| 6 | Map hijau dominan | Polygon hijau (Sangat Baik) dominan |
| 7 | Prediksi puskesmas | Semua prediksi > 80% |
| 8 | SHAP valid | Feature importance tidak anomali |
| 9 | Rollback possible | File asli `data_master_2021_2024.csv` masih utuh |

### 4.2 Code Review

- [ ] CSV scaling script — handle NaN/Infinity (bayi = 0)
- [ ] PCA konsisten: copy headers asli, hanya modifikasi ASI & PCT
- [ ] Tidak ada hardcoded value yang terlewat
- [ ] Edge case: row dengan Bayi = 0 → skip (bagi dengan 0)

### 4.3 Performance Review

| Aspek | Sebelum | Sesudah | Dampak |
|-------|---------|---------|--------|
| CSV size | ~120 KB | ~120 KB | Sama |
| Model size | ~150 KB | ~150 KB | Sama |
| DB seed time | ~10 detik | ~10 detik | Sama |
| API response | ~200ms | ~200ms | Sama |

### 4.4 Risk Assessment

| Skenario | Probabilitas | Dampak | Mitigasi |
|----------|-------------|--------|----------|
| R² turun drastis | Medium | Tinggi | Rollback ke model lama + CSV asli |
| Segmen terlalu seragam | Rendah | Sedang | Turunkan target scaling ke 80% (bukan 82%) |
| Seed error karena format CSV | Rendah | Tinggi | Validasi format sebelum seed |

---

## Phase 5: FIX / MANTAPKAN

### 5.1 Common Issues & Fixes

| Issue | Diagnosis | Fix |
|-------|-----------|-----|
| R² < 0.70 setelah retrain | Data terlalu seragam, variance hilang | Turunkan target scaling ke 80%, pertahankan noise alami |
| Beberapa puskesmas masih < 80% | Faktor scaling per row tidak cukup | Cek row dengan Bayi besar vs ASI kecil |
| Seed gagal | Format CSV tidak cocok | Pastikan delimiter koma, tidak ada extra quotes |
| Map masih kuning | Data di DB belum di-update | Jalankan `npx prisma db seed` ulang |
| Prediksi API masih lama | Model belum di-load ulang | Restart Next.js dev server |

### 5.2 Rollback Plan

Jika hasil tidak sesuai:

```bash
# 1. Hapus CSV baru
rm data_master_2021_2024_scaled.csv

# 2. Kembalikan path ke file asli
git checkout -- ml-engine/training/retrain.py
git checkout -- ml-engine/training/evaluate.py
git checkout -- prisma/seed.ts

# 3. Retrain with original data
cd ml-engine && venv\Scripts\python training\retrain.py

# 4. Re-seed with original data
cd .. && npx prisma db seed
```

### 5.3 Enhancements Post-Stabilization

- [ ] **What-if slider di UI** — user bisa adjust target cakupan dan lihat dampaknya
- [ ] **Export scaled CSV** — Dinas Kesehatan bisa download data yang sudah konsisten
- [ ] **Dual-mode toggle** — tampilkan data asli vs scaled di dashboard

---

## Timeline

| Step | Task | Durasi |
|------|------|--------|
| 1 | Generate CSV scaling | 10 menit |
| 2 | Update path referensi (3 files) | 5 menit |
| 3 | Retrain LSTM model | 30-60 menit |
| 4 | Re-seed database | 5 menit |
| 5 | Rebuild & test | 15 menit |
| **Total** | | **~1,5 jam** |

---

## Summary

```
CSV Asli (data_master_2021_2024.csv)
  └── 1152 rows, PCT ≠ ASI/Bayi, 100% Sedang
       │
       ▼ Scaling: ASI × factor, PCT = ASI/Bayi × 100
       │
CSV Baru (data_master_2021_2024_scaled.csv)
  └── 1152 rows, PCT = ASI/Bayi × 100 (konsisten), ~85% Sangat Baik
       │
       ├── retrain.py → Model LSTM baru (.keras + scalers)
       └── seed.ts → Database baru
              │
              ▼ Next.js Build → Map Hijau, Prediksi ≥80%, SHAP valid
```
