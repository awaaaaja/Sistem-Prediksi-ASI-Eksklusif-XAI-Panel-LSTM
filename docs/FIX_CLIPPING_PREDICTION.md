# Fix Clipping Prediction: Analisis dan Solusi

## Masalah
Model yang sudah di-retrain dengan **data asli** (mean 74%, std 9%) tetap menghasilkan prediksi >=80% karena ada `np.clip` di `ml-engine/main.py:109`.

## Penyebab

**File:** `ml-engine/main.py` baris 109
```python
final_pred = np.clip(final_pred, 80.0, 100.0)
```

Kode ini adalah sisa dari pendekatan "sangat_baik" sebelumnya, yang memaksa SEMUA prediksi minimal 80%, meskipun model sudah dilatih dengan data asli yang bervariasi.

## Dampak

- Semua puskesmas dengan cakupan rendah mendapat prediksi 80.0% (artifisial)
- Counterfactual Analysis tidak pernah muncul (karena semua prediksi >=80%)
- Hasil prediksi tidak realistis dan tidak valid untuk penelitian

## Analisis Contoh (PKM02 - ANAK AIR)

| Metrik | Nilai |
|--------|-------|
| Cakupan historis | 63-70% |
| Rasio ASI/Bayi | 0.635 |
| SHAP Rasio_ASI_Bayi | -9.77% (menurunkan prediksi) |
| Prediksi seharusnya | ~64% |
| Prediksi dengan clip | 80.0% (salah) |

## Fix

Ubah `np.clip(final_pred, 80.0, 100.0)` menjadi:
```python
final_pred = np.clip(final_pred, 0.0, 100.0)
```

Atau hapus clipping sama sekali (range data asli 55-95%).

## Efek Setelah Fix

- Prediksi bervariasi natural sesuai data asli (range ~55-95%)
- Counterfactual Analysis muncul untuk puskesmas dengan prediksi <80%
- SHAP analysis akurat karena tidak dipotong
- Data siap untuk sidang (valid, realistis, explainable)
