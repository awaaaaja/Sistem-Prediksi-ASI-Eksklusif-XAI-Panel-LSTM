# Session Summary — Penyesuaian SHAP, Frontend, & Riwayat Prediksi

> **Tanggal:** 19 Juli 2026
> **Tujuan:** Perbaikan SHAP interpretability, sinkronisasi frontend-backend, penambahan riwayat prediksi

---

## 1. SHAP Explainer: Perbaikan Format Output

### Masalah
`format_shap()` di `shap_explainer.py` return 500 karena indexing error:
```python
# ❌ Sebelum (salah — shap_arr belum di-index sampel)
shap_arr[feat_idx]

# ✅ Sesudah (benar — index sampel + fitur)
shap_arr[0, feat_idx]
```

### Perubahan
**File:** `ml-engine/shap_explainer.py:107`
- Indexing `shap_arr[feat_idx]` → `shap_arr[0, feat_idx]`
- Tidak ada perubahan pada struktur data (masih pakai `shap_value` + `mean_abs_impact`)

---

## 2. Schemas: Hapus `ShapImpact` (Lag)

### Masalah
`ShapFeature` di `schemas.py` masih membutuhkan field `impacts: List[ShapImpact]` (array per-lag), tapi `format_shap()` sudah tidak mengirim `impacts`. FastAPI throw `ResponseValidationError` 500.

### Perubahan
**File:** `ml-engine/schemas.py:38-41`

**Sebelum:**
```python
class ShapImpact(BaseModel):
    lag: int
    shap_value: float
    feature_name: str

class ShapFeature(BaseModel):
    feature: str
    mean_abs_impact: float
    impacts: List[ShapImpact]  # ← 8 fitur × 12 lag = 96 item
```

**Sesudah:**
```python
class ShapFeature(BaseModel):
    feature: str
    shap_value: float      # ← single value, no lag dimension
    mean_abs_impact: float
```

### Dampak
- Response SHAP sekarang flat: 1 baris per fitur (total 8), bukan 8×12=96
- Endpoint `/ml/shap` return 200 ✅

---

## 3. Frontend SHAP Components: Update ke Format Flat

### 3a. `shap-force-plot.tsx`

**Sebelum:** Menerima `impacts[]` per feature, merender banyak bar.

**Sesudah:** Menerima `shap_value` tunggal per feature. Logic:
- `totalImpact` = sum semua `shap_value`
- `finalValue` = `expectedValue + totalImpact`
- Lebar bar proporsional terhadap `|shap_value| / maxAbs`
- Warna: positif = emerald (kanan), negatif = blue (kiri)

### 3b. `shap-summary-bar.tsx`

**Sebelum:** Iterasi `impacts[]`.

**Sesudah:** Pakai `mean_abs_impact` untuk lebar bar, warna berdasarkan `shap_value` (±).

### 3c. `shap-feature-timeline.tsx`

**Sebelum:** Menampilkan 12 lag per fitur (timeline horizontal).

**Sesudah:** Single bar per fitur. Posisi bar:
- Nilai positif: anchor kiri, width = `pct%`
- Nilai negatif: anchor kanan, width = `pct%`, marginLeft = `100 - |pct|%`

---

## 4. Puskesmas Detail Page: Teks Interpretasi

**File:** `src/app/(dashboard)/puskesmas/[id]/page.tsx`

**Sebelum:**
```tsx
{f.mean_abs_impact >= 0 ? "+" : ""}{f.mean_abs_impact.toFixed(2)}%
— Lag paling berpengaruh: t-{f.impacts.reduce(...).lag}
```

**Sesudah:**
```tsx
{f.shap_value >= 0 ? "+" : ""}{f.shap_value.toFixed(2)}%
— kontribusi terhadap prediksi.
```

---

## 5. Riwayat Prediksi: Dashboard + Detail Puskesmas

### 5a. API Dashboard — Tambah `riwayatPrediksi`

**File:** `src/app/api/dashboard/route.ts:96-104`

Menambahkan field baru ke response:
```typescript
riwayatPrediksi: recentPrediksi.map((p) => ({
  id: p.id,
  kode: p.puskesmas.kode,
  nama: p.puskesmas.nama,
  nilaiPrediksi: p.nilaiPrediksi,
  createdAt: p.createdAt.toISOString(),
}))
```
Data sudah tersedia dari query `recentPrediksi` (24 prediksi terbaru, di-join dengan puskesmas), hanya belum diexpose.

### 5b. API Baru: `/api/prediksi/[id]`

**File:** `src/app/api/prediksi/[id]/route.ts` (baru)

```typescript
// GET /api/prediksi/:puskesmasId
// Return: 20 prediksi terakhir untuk puskesmas tertentu, diurutkan createdAt DESC
prisma.prediksi.findMany({
  where: { puskesmasId: Number(params.id) },
  orderBy: { createdAt: "desc" },
  take: 20,
})
```

### 5c. Dashboard — Card Riwayat Prediksi

**File:** `src/app/(dashboard)/page.tsx`

- Interface baru: `RiwayatPrediksiItem` (`id`, `kode`, `nama`, `nilaiPrediksi`, `createdAt`)
- Ditambahkan ke `DashboardData`
- Card **Riwayat Prediksi** (setelah tabel puskesmas, sebelum Aktivitas Upload)
- Tabel: Puskesmas (kode + nama), Prediksi (cyan), Waktu (locale id-ID)
- Empty state: icon Lightning + pesan "Belum ada riwayat prediksi"

### 5d. Puskesmas Detail — Card Riwayat Prediksi

**File:** `src/app/(dashboard)/puskesmas/[id]/page.tsx`

- Interface baru: `PrediksiRow` (`id`, `nilaiPrediksi`, `executionTimeMs`, `createdAt`)
- Fetch dari `/api/prediksi/${id}` bersamaan dengan data puskesmas & history
- Card **Riwayat Prediksi** (setelah SHAP section)
- Tabel: # (nomor urut DESC), Prediksi (cyan), Waktu (locale id-ID), Durasi (ms)
- Empty state: icon Lightning + pesan "Klik Prediksi Sekarang untuk memulai"

---

## 6. Clean Build

```bash
Remove-Item -Recurse -Force .next
npm run build
# ✅ Compiled successfully
# ✅ Semua route terdaftar (termasuk /api/prediksi/[id])
```

---

## 7. Daftar File yang Diubah/Dibuat

| File | Status | Keterangan |
|---|---|---|
| `ml-engine/shap_explainer.py:107` | Modified | Fix indexing `shap_arr[0, feat_idx]` |
| `ml-engine/schemas.py` | Modified | Hapus `ShapImpact`, flat `ShapFeature` |
| `src/components/xai/shap-force-plot.tsx` | Modified | Flat features, no lag |
| `src/components/xai/shap-summary-bar.tsx` | Modified | Flat features, no lag |
| `src/components/xai/shap-feature-timeline.tsx` | Modified | Single bar per feature |
| `src/app/(dashboard)/puskesmas/[id]/page.tsx` | Modified | Teks interpretasi + Riwayat Prediksi |
| `src/app/(dashboard)/page.tsx` | Modified | Riwayat Prediksi card |
| `src/app/api/dashboard/route.ts` | Modified | Tambah `riwayatPrediksi` |
| `src/app/api/prediksi/[id]/route.ts` | **New** | Endpoint riwayat per puskesmas |

---

## 8. Arsitektur Data SHAP (Final)

```
ML Engine Response (POST /ml/shap):
{
  "success": true,
  "puskesmas_id": 105,
  "expected_value": 83.19,       // base value in percentage
  "features": [
    {
      "feature": "Rasio_ASI_Bayi",
      "shap_value": 10.43,        // contribution in percentage points
      "mean_abs_impact": 10.43    // |shap_value|
    },
    // ... 7 more features
  ]
}

Verification:
  expected_value + sum(shap_values) == prediction ✅
  83.19 + 11.63 = 94.82 == 94.82 ✅
```

---

## 9. Status Akhir

| Komponen | Status |
|---|---|
| SHAP Endpoint `/ml/shap` | ✅ 200 OK, format benar |
| SHAP Frontend Components | ✅ Flat features, tanpa lag |
| Interpretasi Teks | ✅ Tanpa referensi lag |
| Dashboard — Riwayat Prediksi | ✅ Card baru, data dari API |
| Puskesmas Detail — Riwayat Prediksi | ✅ Card baru, endpoint spesifik |
| Build | ✅ Compiled, zero errors |
