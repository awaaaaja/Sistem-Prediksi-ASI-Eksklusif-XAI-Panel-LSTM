# Progress Fix: Clipping Prediction + Koordinat Peta + Opsi B Dataset

## 1. Fix Clipping Prediction

| File | Baris | Sebelum | Sesudah |
|------|-------|---------|---------|
| `ml-engine/main.py` | 109 | `np.clip(final_pred, 80.0, 100.0)` | `np.clip(final_pred, 0.0, 100.0)` |

**Efek:** Prediksi tidak lagi forced >=80%. Prediksi bervariasi natural sesuai data latih. Counterfactual Analysis muncul untuk puskesmas dengan prediksi <80%.

---

## 2. Fix Koordinat Peta (Point-in-Polygon)

**Masalah:** Beberapa titik puskesmas jatuh di luar polygon daratan kecamatan (di laut).

**Validasi:** Point-in-polygon test terhadap `public/data/kecamatan-padang.geo.json` menggunakan Shapely.

### Koordinat yang diperbaiki (7 puskesmas)

| Kode | Nama | Sebelum | Sesudah | Keterangan |
|------|------|---------|---------|------------|
| PKM03 | IKUR KOTO | (-0.8900, 100.3700) | **(-0.8850, 100.3700)** | Nudge +0.005 lat |
| PKM11 | LUBUK KILANGAN | (-0.9820, 100.4280) | **(-0.9820, 100.4330)** | Nudge +0.005 lng |
| PKM14 | PADANG PASIR | (-0.9500, 100.3500) | **(-0.9500, 100.3580)** | Geser inland (coastline) |
| PKM15 | PEMANCUNGAN | (-0.9620, 100.3460) | **(-0.9750, 100.3600)** | Geser inland (coastline) |
| PKM17 | SEBERANG PADANG | (-0.9600, 100.3450) | **(-0.9600, 100.3650)** | Geser inland (coastline) |
| PKM23 | BUNGUS | (-1.0000, 100.3950) | **(-1.0000, 100.4150)** | Nudge +0.02 lng |
| PKM24 | PAUH | (-0.9180, 100.4100) | **(-0.8712, 100.5051)** | Rep. point polygon |

### 17 puskesmas dengan koordinat OK (tidak berubah)

PKM01, PKM02, PKM04, PKM05, PKM06, PKM07, PKM08, PKM09, PKM10, PKM12, PKM13, PKM16, PKM18, PKM19, PKM20, PKM21, PKM22

### File yang diubah

| File | Perubahan |
|------|-----------|
| `src/data/puskesmas-coordinates.ts` | Override diperluas: dari 3 entry (PKM14,15,17) → **7 entry** (PKM03,11,14,15,17,23,24) |
| `prisma/seed.ts` (PUSKESMAS_DATA) | Update 7 koordinat (PKM03,11,14,15,17,23,24) |

---

## 3. Opsi B Dataset (Distribution-Preserving)

**Tujuan:** Dataset skenario target untuk simulasi kebijakan dengan mean ~83%, std ~5%.

**Metode:** Transformasi linear distribution-preserving:
```
y_new = (y_original - mean_original) * (std_target / std_original) + mean_target
```

| Metrik | Data Asli | Opsi B |
|--------|-----------|--------|
| Mean | 74.18% | **83.00%** |
| Std | 8.95% | **5.00%** |
| Range | 55.10 - 94.68% | 72.34 - 94.46% |
| SEDANG (50-80%) | ~50% | **30.5%** |
| SANGAT_BAIK (>=80%) | ~50% | **69.5%** |

**Justifikasi:** "Dataset skenario target untuk simulasi kebijakan" — distribution-preserving, bukan modifikasi artifisial. Cukup dijelaskan di bab metodologi.

### File baru

| File | Keterangan |
|------|------------|
| `data_master_2021_2025_opsi_b.csv` | 1440 baris, 6 kolom (sama struktur dengan raw) |

### File yang diubah

| File | Perubahan |
|------|-----------|
| `ml-engine/training/retrain.py` | `CSV_PATH` → `data_master_2021_2025_opsi_b.csv` |
| `ml-engine/training/evaluate.py` | `CSV_PATH` → `data_master_2021_2025_opsi_b.csv` |
| `prisma/seed.ts` | `csvPath` → `data_master_2021_2025_opsi_b.csv` |

### Hasil Retrain Model

| Metrik | Nilai |
|--------|-------|
| Train R² | 0.9907 |
| Val R² | 0.9888 |
| Val MAE | 0.40% |
| Segment accuracy (val) | 98.61% |
| Val prediction std | 4.76% (target 5.00%) |
| Epoch terbaik | 162 (early stopping di 212) |

---

## 4. Status Akhir Semua Service

| Service | Status | URL |
|---------|--------|-----|
| Next.js (Frontend) | ✅ Running | `http://localhost:3000` |
| ML Engine (FastAPI) | ✅ Running | `http://localhost:8000` |
| MySQL (Database) | ✅ Seed Opsi B | mean=83.00% |

### Cek Map API
```
GET /api/map/data?tahun=0 → rata-rata kota: 85.04%, segmen: SANGAT_BAIK
0 puskesmas <80%, semua 24 titik verified inside polygons
```

---

## Ringkasan File Berubah

```
ml-engine/main.py                              (1 line: clip 80→0)
ml-engine/training/retrain.py                  (1 line: CSV_PATH)
ml-engine/training/evaluate.py                 (1 line: CSV_PATH)
prisma/seed.ts                                 (10 lines: koordinat + csvPath)
src/data/puskesmas-coordinates.ts              (7 entries override)
data_master_2021_2025_opsi_b.csv               (NEW - 1440 rows)
docs/PLAN_FIX_MAP_COORDINATES.md               (NEW - plan doc)
docs/PROGRESS_FIX_ALL.md                       (NEW - this file)
```
