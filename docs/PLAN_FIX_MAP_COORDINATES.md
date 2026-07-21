# PLAN: Fix Clipping Prediction + Map Coordinates

## Issue 1: Fix Clipping Prediction (ml-engine/main.py)

**Problem:** `np.clip(final_pred, 80.0, 100.0)` di `ml-engine/main.py:109` memaksa semua prediksi >=80%, meskipun model sudah dilatih dengan data asli (mean 74%, std 9%).

**Fix:** Ubah menjadi `np.clip(final_pred, 0.0, 100.0)` — hanya mencegah nilai negatif hasil inverse-transform, tidak mengubah distribusi natural (data asli range 55-95%).

| File | Baris | Sebelum | Sesudah |
|------|-------|---------|---------|
| `ml-engine/main.py` | 109 | `np.clip(final_pred, 80.0, 100.0)` | `np.clip(final_pred, 0.0, 100.0)` |

**Justifikasi (Opsi B — Distribution-Preserving):** Clip bawah 0.0 adalah constraint fisis (cakupan tidak mungkin negatif), bukan modifikasi distribusi. Mean dan std prediksi tetap mengikuti distribusi natural data asli.

---

## Issue 2: Fix Koordinat Peta

**Problem:** Koordinat DB seed tidak akurat — beberapa titik puskesmas jatuh di laut (terutama PKM15 PEMANCUNGAN) dan mayoritas koordinat berbeda signifikan dari data WebGIS original.

**Sumber koordinat benar:** `webgis/data/puskesmas.json` (GIS original) dan `docs/PLAN_MAP_INTEGRASI.md:182-207`.

### File yang diubah

| # | File | Perubahan |
|---|------|-----------|
| 2.1 | `src/data/puskesmas-coordinates.ts` | Ganti dari hanya 1 entry (PKM15) menjadi **24 entry** sesuai plan doc |
| 2.2 | `prisma/seed.ts` (PUSKESMAS_DATA) | Update `latitude` & `longitude` semua 24 puskesmas |
| 2.3 | `prisma/seed.ts` (KECAMATAN_DATA) | Update koordinat kecamatan agar konsisten |

### Koordinat Baru

| Kode | Nama | Kecamatan | `lat` | `lng` |
|------|------|-----------|-------|-------|
| PKM01 | AIR DINGIN | Koto Tangah | -0.965 | 100.290 |
| PKM02 | ANAK AIR | Koto Tangah | -0.9695 | 100.298 |
| PKM03 | IKUR KOTO | Koto Tangah | -0.968 | 100.295 |
| PKM04 | LB.BUAYA | Koto Tangah | -0.970 | 100.285 |
| PKM05 | TUNGGUL HITAM | Koto Tangah | -0.966 | 100.288 |
| PKM06 | AMBACANG | Kuranji | -0.950 | 100.340 |
| PKM07 | BELIMBING | Kuranji | -0.960 | 100.350 |
| PKM08 | KURANJI | Kuranji | -0.955 | 100.345 |
| PKM09 | LUBUK BEGALUNG | Lubuk Begalung | -0.880 | 100.270 |
| PKM10 | PEGAMBIRAN | Lubuk Begalung | -0.885 | 100.280 |
| PKM11 | LUBUK KILANGAN | Lubuk Kilangan | -0.930 | 100.290 |
| PKM12 | LAPAI | Nanggalo | -0.965 | 100.325 |
| PKM13 | NANGGALO | Nanggalo | -0.960 | 100.320 |
| PKM14 | PADANG PASIR | Padang Barat | -0.947 | 100.345 |
| PKM15 | PEMANCUNGAN | Padang Selatan | -0.900 | 100.320 |
| PKM16 | RAWANG | Padang Selatan | -0.899 | 100.315 |
| PKM17 | SEBERANG PADANG | Padang Selatan | -0.910 | 100.325 |
| PKM18 | ANDALAS | Padang Timur | -0.940 | 100.370 |
| PKM19 | PARAK KARAKAH | Padang Timur | -0.938 | 100.365 |
| PKM20 | AIR TAWAR | Padang Utara | -0.918 | 100.330 |
| PKM21 | ALAI | Padang Utara | -0.915 | 100.325 |
| PKM22 | ULAK KARANG | Padang Utara | -0.920 | 100.320 |
| PKM23 | BUNGUS | Bungus Teluk Kabung | -0.980 | 100.270 |
| PKM24 | PAUH | Pauh | -0.960 | 100.355 |

### Koordinat Kecamatan (Seed — centroid dari puskesmas di dalamnya)

| Kecamatan | `lat` | `lng` |
|-----------|-------|-------|
| Koto Tangah | -0.9677 | 100.290 |
| Kuranji | -0.955 | 100.345 |
| Lubuk Begalung | -0.8825 | 100.275 |
| Lubuk Kilangan | -0.930 | 100.290 |
| Nanggalo | -0.9625 | 100.3225 |
| Padang Barat | -0.947 | 100.345 |
| Padang Selatan | -0.903 | 100.320 |
| Padang Timur | -0.939 | 100.3675 |
| Padang Utara | -0.9177 | 100.325 |
| Pauh | -0.960 | 100.355 |
| Bungus Teluk Kabung | -0.980 | 100.270 |

---

## Verifikasi

1. `ml-engine` → test `/ml/predict` dengan data riwayat rendah (63-70%) → prediksi tidak forced 80%
2. Map → load peta, pastikan semua 24 titik puskesmas di atas daratan
3. Counterfactual → muncul untuk puskesmas dengan prediksi <80%

---

## Referensi

- `docs/FIX_CLIPPING_PREDICTION.md` — analisis lengkap clipping bug
- `docs/PLAN_MAP_INTEGRASI.md` — rencana integrasi map awal
- `webgis/data/puskesmas.json` — koordinat WebGIS original (22 puskesmas)
