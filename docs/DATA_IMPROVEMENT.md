# Data Improvement Plan — Cakupan ASI Eksklusif

## Masalah

Data awal terlalu seragam. Tahun 2023-2025 seluruh 24 puskesmas (100%) berada di segmen **Sangat Baik** (≥80%), tidak realistis karena di lapangan selalu ada variasi antar puskesmas.

### Distribusi Awal

| Tahun | Sangat Baik | Sedang | Rendah | Rata-rata |
|-------|------------|--------|--------|-----------|
| 2021  | 17         | 7      | 0      | 80.83%    |
| 2022  | 21         | 3      | 0      | 81.67%    |
| 2023  | 24         | 0      | 0      | 83.53%    |
| 2024  | 24         | 0      | 0      | 84.28%    |
| 2025  | 24         | 0      | 0      | 85.05%    |

## Target

- Rata-rata keseluruhan tetap **≥80%** (Sangat Baik)
- Variasi natural per tahun: 14–18 Sangat Baik, 6–10 Sedang, 0–2 Rendah
- Total data tetap: **1.440 baris** (24 puskesmas × 12 bulan × 5 tahun)

## Strategi

### 1. Kelompok Puskesmas

Puskesmas dibagi menjadi 3 kelompok berdasarkan pola kinerja:

| Kelompok | Jumlah | Rata-rata | Karakteristik |
|----------|--------|-----------|---------------|
| **Unggulan** | 6 PKM | 88–90% | Konsisten tinggi, jarang turun |
| **Menengah** | 12 PKM | 79–82% | Fluktuasi normal, kadang turun |
| **Underperformer** | 6 PKM | 70–74% | Sering rendah, jarang sentuh 80% |

**Daftar per Kelompok:**

| Kelompok | Kode Puskesmas |
|----------|----------------|
| Unggulan | PKM07, PKM08, PKM13, PKM15, PKM16, PKM21 |
| Menengah | PKM03, PKM04, PKM05, PKM06, PKM10, PKM11, PKM14, PKM17, PKM18, PKM19, PKM20, PKM22 |
| Underperformer | PKM01, PKM02, PKM09, PKM12, PKM23, PKM24 |

### 2. Parameter Generate Data

Setiap kelompok memiliki parameter sendiri:

| Parameter | Unggulan | Menengah | Underperformer |
|-----------|----------|----------|----------------|
| Base Avg | 88–90% | 79–82% | 70–74% |
| Annual Trend | +0.5%/thn | +0.5–1%/thn | +0.5–1%/thn |
| Amplitudo Musiman | ±4% | ±5% | ±6% |
| Noise (std dev) | 4% | 6% | 8% |
| Rentang Bulanan | 68–98% | 45–96% | 25–93% |

### 3. Pola Generate

Setiap baris data bulanan dihasilkan dengan formula:

```
persentase = baseAvg[tahun] + trend + musiman + noise + variasi_individu
```

- **Musiman**: sin((bulan−6) × π/6) — cakupan lebih rendah di Nov-Feb, lebih tinggi di Jun-Sep
- **Noise**: Gaussian random distribution
- **Variasi individu**: berdasarkan kode puskesmas (seed)

Kemudian dihitung ulang ke jumlah absolut:

```
bayi6Bulan = random(35, 170)  → rentang realistis
asiEksklusif = round(bayi6Bulan × persentase / 100)
```

### 4. Target Distribusi Akhir

| Tahun | Sangat Baik | Sedang | Rendah | Rata-rata |
|-------|------------|--------|--------|-----------|
| 2021  | 14         | 10     | 0      | 80.44%    |
| 2022  | 18         | 6      | 0      | 81.88%    |
| 2023  | 18         | 6      | 0      | 83.19%    |
| 2024  | 17         | 7      | 0      | 82.64%    |
| 2025  | 17         | 7      | 0      | 83.45%    |

## Cara Regenerate

Jika ingin mengulang generate data, jalankan:

```bash
node _generate_data.mjs
```

Script akan:
1. Menghapus semua data `data_bulanan`, `indikator_segmen`, `prediksi`, `shap_value`
2. Generate ulang 1.440 baris data bulanan (24 PKM × 12 bulan × 5 tahun)
3. Generate ulang `indikator_segmen` (24 PKM × 60 bulan)
4. Menampilkan distribusi validasi per tahun
