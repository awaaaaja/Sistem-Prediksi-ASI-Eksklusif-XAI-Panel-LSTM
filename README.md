# Sistem Prediksi ASI Eksklusif + XAI Panel LSTM

Prediksi cakupan ASI Eksklusif 24 Puskesmas dengan LSTM Panel + XAI SHAP.

## Struktur

- `src/` — Next.js 14 frontend + API routes
- `prisma/` — Database schema & seed
- `ml-engine/` — FastAPI untuk inferensi LSTM + SHAP

## Menjalankan

```bash
# Database
npx prisma generate && npx prisma db push && npx ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts

# ML Engine (port 8000)
cd ml-engine && .\venv\Scripts\python main.py

# Frontend (port 3000)
npm run dev
```

Lihat `docs/REPORT.md` untuk dokumentasi lengkap.
