# Sistem Prediksi ASI Eksklusif + XAI Panel LSTM

**Kota Padang, Sumatera Barat** — 11 Kecamatan, 24 Puskesmas

Prediksi cakupan ASI Eksklusif dengan LSTM Panel + XAI SHAP.

## Data

- 11 Kecamatan real: Koto Tangah, Padang Utara, Kuranji, dll
- 24 Puskesmas real: AIR DINGIN, ANAK AIR, IKUR KOTO, dll
- 48 bulan historis (2021-2024) dari `data_master_2021_2024.csv`

## Struktur

- `src/` — Next.js 14 frontend + API routes
- `prisma/` — Database schema & seed
- `ml-engine/` — FastAPI untuk inferensi LSTM + SHAP

## Menjalankan

```bash
# Database
npx prisma generate && npx prisma db push --accept-data-loss && npx tsx prisma/seed.ts

# ML Engine (port 8000)
cd ml-engine && .\venv\Scripts\python main.py

# Frontend (port 3000)
npm run dev
```

Lihat `docs/RENCANA_IMPLEMENTASI.md` untuk rencana pengembangan selanjutnya.
