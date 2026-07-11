# Roadmap Pembangunan Aplikasi — Panduan Prompt Bertahap

## Sistem Prediksi ASI Eksklusif + XAI Panel LSTM

---

> ** ⚠️ ATURAN WAJIB:** Setiap tahap WAJIB mengikuti siklus **[THINKING] → [BUILD] → [EKSEKUSI] → [REVIEW] → [PERBAIKI JIKA ADA SALAH DAN MANTAPKAN]** secara ketat. **AI DILARANG KERAS** melanjutkan ke tahap berikutnya sebelum fase saat ini 100% selesai, solid, terverifikasi tanpa cela, dan dimantapkan.

---

## Daftar Isi Tahapan

| Tahap | Nama | Agen Utama | Durasi |
|---|---|---|---|
| **Tahap 1** | Backend ML/XAI Engine (FastAPI + LSTM + SHAP) | MLOps + XAI Agent | 3 sesi |
| **Tahap 2** | Setup Next.js, Database MySQL, API Routes | Backend Engineer | 3 sesi |
| **Tahap 3** | Frontend Dashboard Premium (UI/UX Pro Max) | UI/UX Agent | 4 sesi |
| **Tahap 4** | Integrasi Visualisasi SHAP/XAI di Frontend | UI/UX + Backend | 2 sesi |
| **Tahap 5** | Upload File, Validasi Tanggal, Export Report | Backend + UI/UX | 3 sesi |

---

## Tahap 1: Backend ML/XAI Engine (FastAPI + LSTM + SHAP)

### Prompt untuk AI Engineer (MLOps & XAI Specialist)

```
[THINKING]
Sebelum menulis kode, analisis secara mendalam:

1. **Model LSTM Panel (.h5)**
   - File: D:\lstm2\model_lstm_panel.h5 (394 KB)
   - Asumsi input shape: (batch, timesteps, features) → identifikasi dengan
     `tf.keras.models.load_model()` lalu cetak `model.input_shape` dan `model.output_shape`.
   - Feature mapping: dari CSV diketahui kolom [Jumlah_Bayi_6_Bulan, Jumlah_ASI_Eksklusif, Persentase_Cakupan]
     → kemungkinan 3 fitur input, 1 output (Persentase_Cakupan).

2. **Scaler Objects (.pkl)**
   - scaler_X.pkl (694 bytes): scaler untuk 3 fitur input (kemungkinan MinMaxScaler atau StandardScaler)
   - scaler_Y.pkl (631 bytes): scaler untuk 1 target output
   - Load dengan joblib, inspeksi mean_, scale_, feature_names_in_ jika ada.

3. **Sliding Window Logic**
   - WINDOW_SIZE = 12 bulan
   - Input: array 2D (n_months, 3) → ambil 12 bulan terakhir → reshape ke (1, 12, 3)
   - Validasi: tolak jika length < 12, tolak jika ada NaN/Infinity.

4. **SHAP DeepExplainer untuk LSTM 3D**
   - Membutuhkan background distribution: 100 sampel random dari data training.
   - SHAP output: list of 3 arrays, masing-masing shape (1, 12, 1) untuk tiap fitur.
   - Total 12 lag × 3 fitur = 36 nilai SHAP per prediksi.
   - Pastikan additivity check: sum semua SHAP + expected_value ≈ predicted_value.

5. **Arsitektur FastAPI**
   - Satu file main.py dengan lifespan untuk model loading.
   - CORS origin: http://localhost:3000 (Next.js dev server).
   - Semua endpoint di-prefix /ml/.
   - Error handling: ValueError → 400, RuntimeError → 500.

Edge cases kritis:
- Apa yang terjadi jika .h5 file corrupt atau gagal load? → status degraded di health check.
- Bagaimana jika scaler_X.pkl memiliki n_features berbeda dengan input history? → raise ValueError clear.
- SHAP dengan model LSTM 3D: shap_values[0] untuk fitur pertama, shap_values[0][0, lag, 0] untuk nilai spesifik.
- Jika background_data.npy tidak ada: gunakan fallback random normal.

[BUILD]
Buat struktur folder ml-engine/ dan file-file berikut:

### 1. ml-engine/requirements.txt
```
fastapi==0.111.0
uvicorn[standard]==0.30.1
tensorflow==2.16.1
numpy==1.26.4
pandas==2.2.2
joblib==1.4.2
pydantic==2.7.4
shap==0.45.1
python-multipart==0.0.9
```

### 2. ml-engine/schemas.py
```python
from pydantic import BaseModel, Field
from typing import List, Optional

class PredictRequest(BaseModel):
    puskesmas_id: int = Field(..., ge=1, le=999)
    history: List[List[float]] = Field(..., min_length=12)

class PredictResponse(BaseModel):
    success: bool
    puskesmas_id: int
    predictions: List[float]
    execution_time_ms: float

class BatchPredictRequest(BaseModel):
    stations: List[dict]

class BatchPredictResponse(BaseModel):
    success: bool
    results: List[dict]
    errors: List[dict]

class ShapRequest(BaseModel):
    puskesmas_id: int = Field(..., ge=1, le=999)
    history: List[List[float]] = Field(..., min_length=12)

class ShapImpact(BaseModel):
    lag: int
    shap_value: float
    feature_name: str

class ShapFeature(BaseModel):
    feature: str
    mean_abs_impact: float
    impacts: List[ShapImpact]

class ShapResponse(BaseModel):
    success: bool
    puskesmas_id: int
    expected_value: float
    features: List[ShapFeature]

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    scaler_X_loaded: bool
    scaler_Y_loaded: bool
    tensorflow_version: str
    uptime_seconds: float
    model_input_shape: Optional[List[int]] = None
```

### 3. ml-engine/model_loader.py
```python
import os, time, logging, joblib
import tensorflow as tf

logger = logging.getLogger(__name__)
model = None
scaler_X = None
scaler_Y = None

def load_models():
    global model, scaler_X, scaler_Y
    model_path = os.getenv("MODEL_PATH", "models/model_lstm_panel.h5")
    scaler_X_path = os.getenv("SCALER_X_PATH", "models/scaler_X.pkl")
    scaler_Y_path = os.getenv("SCALER_Y_PATH", "models/scaler_Y.pkl")

    status = {"model_loaded": False, "scaler_X_loaded": False, "scaler_Y_loaded": False}
    try:
        model = tf.keras.models.load_model(model_path)
        status["model_loaded"] = True
        logger.info(f"Model loaded. Input shape: {model.input_shape}")
    except Exception as e:
        logger.error(f"Model load failed: {e}")

    try:
        scaler_X = joblib.load(scaler_X_path)
        status["scaler_X_loaded"] = True
    except Exception as e:
        logger.error(f"Scaler_X load failed: {e}")

    try:
        scaler_Y = joblib.load(scaler_Y_path)
        status["scaler_Y_loaded"] = True
    except Exception as e:
        logger.error(f"Scaler_Y load failed: {e}")

    return status
```

### 4. ml-engine/preprocess.py
```python
import numpy as np

WINDOW_SIZE = 12

def prepare_sliding_window(history: np.ndarray) -> np.ndarray:
    if len(history) < WINDOW_SIZE:
        raise ValueError(f"Minimal {WINDOW_SIZE} bulan, tersedia {len(history)}")
    if np.any(np.isnan(history)) or np.any(np.isinf(history)):
        raise ValueError("Data mengandung NaN/Infinity")
    return history[-WINDOW_SIZE:].reshape(1, WINDOW_SIZE, -1)
```

### 5. ml-engine/shap_explainer.py
```python
import shap, numpy as np, logging
from typing import List

logger = logging.getLogger(__name__)
FEATURE_NAMES = ['Jumlah_Bayi_6_Bulan', 'Jumlah_ASI_Eksklusif', 'Persentase_Cakupan']
WINDOW_SIZE = 12

explainer = None
background_data = None

def init_shap(model, bg_path="models/background_data.npy"):
    global explainer, background_data
    try:
        background_data = np.load(bg_path)
    except FileNotFoundError:
        background_data = np.random.randn(100, WINDOW_SIZE, 3).astype(np.float32)
    explainer = shap.DeepExplainer(model, background_data)
    logger.info("SHAP DeepExplainer initialized")

def compute_shap(input_tensor: np.ndarray) -> tuple:
    if explainer is None:
        raise RuntimeError("SHAP not initialized")
    sv = explainer.shap_values(input_tensor, check_additivity=True)
    ev = explainer.expected_value
    return sv, ev

def format_shap(sv: List[np.ndarray], ev: float, pid: int) -> dict:
    features = []
    for fi, fn in enumerate(FEATURE_NAMES):
        impacts = []
        for lag in range(WINDOW_SIZE):
            val = float(sv[fi][0, lag, 0])
            impacts.append({"lag": WINDOW_SIZE - lag, "shap_value": round(val, 6), "feature_name": fn})
        mean_abs = sum(abs(i["shap_value"]) for i in impacts) / len(impacts)
        features.append({"feature": fn, "mean_abs_impact": round(mean_abs, 6), "impacts": impacts})
    return {"success": True, "puskesmas_id": pid, "expected_value": round(float(ev), 6), "features": features}
```

### 6. ml-engine/main.py
```python
import os, time, logging
import numpy as np
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from model_loader import load_models, model, scaler_X, scaler_Y
from preprocess import prepare_sliding_window
from shap_explainer import init_shap, compute_shap, format_shap
from schemas import PredictRequest, PredictResponse, ShapRequest, ShapResponse, HealthResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
start_time = time.time()
model_status = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model_status
    model_status = load_models()
    if model is not None:
        init_shap(model)
    yield

app = FastAPI(title="LSTM Panel ML/XAI Engine", version="1.0.0", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=[
    os.getenv("NEXTJS_ORIGIN", "http://localhost:3000"),
], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/ml/health", response_model=HealthResponse)
async def health():
    import tensorflow as tf
    return HealthResponse(
        status="ok" if model_status.get("model_loaded") else "degraded",
        model_loaded=model_status.get("model_loaded", False),
        scaler_X_loaded=model_status.get("scaler_X_loaded", False),
        scaler_Y_loaded=model_status.get("scaler_Y_loaded", False),
        tensorflow_version=tf.__version__,
        uptime_seconds=time.time() - start_time,
        model_input_shape=list(model.input_shape) if model else None
    )

@app.post("/ml/predict", response_model=PredictResponse)
async def predict(req: PredictRequest):
    if model is None:
        raise HTTPException(503, "Model not loaded")
    start = time.time()
    try:
        arr = np.array(req.history, dtype=np.float32)
        tensor = prepare_sliding_window(arr)
        if scaler_X is not None:
            shape = tensor.shape
            flat = tensor.reshape(-1, tensor.shape[-1])
            tensor = scaler_X.transform(flat).reshape(shape)
        raw = model.predict(tensor, verbose=0)
        if scaler_Y is not None:
            final = scaler_Y.inverse_transform(raw).flatten()
        else:
            final = raw.flatten()
        ms = (time.time() - start) * 1000
        return PredictResponse(success=True, puskesmas_id=req.puskesmas_id,
                               predictions=final.tolist(), execution_time_ms=round(ms, 2))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error(f"Predict error: {e}", exc_info=True)
        raise HTTPException(500, str(e))

@app.post("/ml/shap", response_model=ShapResponse)
async def shap_explain(req: ShapRequest):
    if model is None:
        raise HTTPException(503, "Model not loaded")
    try:
        arr = np.array(req.history, dtype=np.float32)
        tensor = prepare_sliding_window(arr)
        if scaler_X is not None:
            shape = tensor.shape
            flat = tensor.reshape(-1, tensor.shape[-1])
            tensor = scaler_X.transform(flat).reshape(shape)
        sv, ev = compute_shap(tensor)
        return format_shap(sv, ev, req.puskesmas_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error(f"SHAP error: {e}", exc_info=True)
        raise HTTPException(500, str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("ML_ENGINE_PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
```

[EKSEKUSI]
1. Copy model files: Copy-Item "model_lstm_panel.h5" "ml-engine/models/"; Copy-Item "scaler_X.pkl" "ml-engine/models/"; Copy-Item "scaler_Y.pkl" "ml-engine/models/"
2. Install: cd ml-engine; pip install -r requirements.txt
3. Run: python main.py
4. Test health: curl http://localhost:8000/ml/health
5. Test predict: curl -X POST http://localhost:8000/ml/predict -H "Content-Type: application/json" -d '{"puskesmas_id":1,"history":[[0.5,0.4,70],[0.6,0.5,75]]*12}'  (repeat 12 baris)
6. Test SHAP: curl -X POST http://localhost:8000/ml/shap -H "Content-Type: application/json" -d '{"puskesmas_id":1,"history":[[0.5,0.4,70]]*12}'
7. Catat output model.input_shape, pastikan sesuai (None, 12, 3) atau (None, 12, 2).

[REVIEW]
Periksa:
- Apakah health check mengembalikan model_loaded: true?
- Apakah /ml/predict mengembalikan array predictions dengan nilai numerik?
- Apakah /ml/shap mengembalikan features array dengan 3 entries (masing-masing 12 lag)?
- Apakah total SHAP values + expected_value ≈ predicted_value (toleransi 0.01)?
- Apakah error handling berfungsi untuk input < 12 bulan? → harus return 400.
- Apakah waktu eksekusi predict < 2 detik dan SHAP < 5 detik?

[PERBAIKI JIKA ADA SALAH DAN MANTAPKAN]
Jika ada error:
- Model shape mismatch: sesuaikan n_features di preprocess.py dengan model.input_shape[-1].
- Scaler gagal: load scaler_X.pkl dan scaler_Y.pkl di Python interaktif untuk verifikasi fitur.
- SHAP additivity fails: kurangi background samples jadi 50, atau gunakan GradientExplainer.
- CORS error: pastikan origin Next.js (http://localhost:3000) ada di allow_origins.
- Jika input shape model adalah (None, 12, 2) bukan (None, 12, 3): sesuaikan feature list dan preprocess.

Setelah semua endpoint berjalan 100% sempurna → LANJUT TAHAP 2.
```

---

## Tahap 2: Setup Next.js, Database MySQL, API Routes

### Prompt untuk AI Engineer (Backend & Database Engineer)

```
[THINKING]
Sebelum menulis kode, analisis:

1. **Database MySQL**: pastikan MySQL 8 running. Buat database `db_asi_prediksi`.
2. **Prisma Schema**: tabel puskesmas (24 baris dari CSV), data_bulanan (historis 2021-2024),
   prediksi, shap_values, upload_log. Composite index pada (puskesmas_id, tanggal) untuk sliding window.
3. **Seeding**: parse data_master_2021_2024.csv, ekstrak 24 Puskesmas unik, insert data historis.
4. **Server Actions**: Next.js 14+ Server Actions untuk predict, SHAP, upload, export.
   - Action predict: getHistory(12 bulan) → call FastAPI /ml/predict → save ke tabel prediksi.
   - Action SHAP: call FastAPI /ml/shap → save ke tabel shap_values.
5. **Route Handlers**: API endpoints untuk interaksi client-side (fetch dari komponen React).
6. **Validasi Tanggal Cerdas**: date-fns isValid() + getDaysInMonth() untuk eliminasi tanggal cacat.

Edge cases:
- Koneksi MySQL gagal: Prisma retry + error logging.
- Data historis kurang dari 12 bulan untuk suatu Puskesmas: return error spesifik.
- Duplikasi saat seed: gunakan upsert (unique constraint puskesmas_id + tanggal).
- Fetch ke FastAPI timeout: set AbortController dengan 10 detik timeout.

[BUILD]
Buat file-file berikut:

### 1. prisma/schema.prisma
```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "mysql" url = env("DATABASE_URL") }

model Puskesmas {
  id              Int           @id @default(autoincrement())
  kode            String        @unique @db.VarChar(20)
  nama            String        @db.VarChar(200)
  kecamatan       String        @db.VarChar(100)
  puskesmas_type  String?       @db.VarChar(20)
  data_bulanan    DataBulanan[]
  prediksi        Prediksi[]
  @@map("puskesmas")
}

model DataBulanan {
  id                  Int       @id @default(autoincrement())
  puskesmas_id        Int
  tanggal             DateTime
  jumlah_bayi_6_bulan Float?
  jumlah_asi_eksklusif Float?
  persentase_cakupan  Float?
  puskesmas           Puskesmas @relation(fields: [puskesmas_id], references: [id])
  @@unique([puskesmas_id, tanggal])
  @@index([puskesmas_id, tanggal])
  @@map("data_bulanan")
}

model Prediksi {
  id              Int       @id @default(autoincrement())
  puskesmas_id    Int
  bulan_prediksi  DateTime
  nilai_prediksi  Float
  nilai_aktual    Float?
  created_at      DateTime  @default(now())
  puskesmas       Puskesmas @relation(fields: [puskesmas_id], references: [id])
  shap_values     ShapValue[]
  @@unique([puskesmas_id, bulan_prediksi])
  @@map("prediksi")
}

model ShapValue {
  id          Int      @id @default(autoincrement())
  prediksi_id Int
  fitur       String   @db.VarChar(50)
  lag         Int
  shap_value  Float
  prediksi    Prediksi @relation(fields: [prediksi_id], references: [id], onDelete: Cascade)
  @@index([prediksi_id])
  @@map("shap_values")
}

model UploadLog {
  id            Int      @id @default(autoincrement())
  filename      String   @db.VarChar(255)
  total_rows    Int      @default(0)
  rows_valid    Int      @default(0)
  rows_rejected Int      @default(0)
  status        String   @db.VarChar(20)
  detail_error  String?  @db.Text
  created_at    DateTime @default(now())
  @@map("upload_log")
}
```

### 2. src/lib/prisma.ts
```typescript
import { PrismaClient } from '@prisma/client'
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### 3. src/types/index.ts
```typescript
export interface PuskesmasDTO { id: number; kode: string; nama: string; kecamatan: string }
export interface DataBulananDTO { id: number; puskesmas_id: number; tanggal: string; jumlah_bayi_6_bulan: number | null; jumlah_asi_eksklusif: number | null; persentase_cakupan: number | null }
export interface PrediksiDTO { id: number; puskesmas_id: number; bulan_prediksi: string; nilai_prediksi: number; nilai_aktual: number | null }
export interface ShapValueDTO { id: number; prediksi_id: number; fitur: string; lag: number; shap_value: number }
export interface UploadRow { Tanggal: string; Puskesmas: string; Jumlah_Bayi_6_Bulan: number; Jumlah_ASI_Eksklusif: number; [key: string]: unknown }
export interface ApiResponse<T> { success: boolean; data?: T; error?: string; message?: string }
```

### 4. src/lib/constants.ts
```typescript
export const ML_ENGINE_URL = process.env.ML_ENGINE_URL || 'http://localhost:8000'
export const WINDOW_SIZE = 12
export const MAX_FILE_SIZE = 10 * 1024 * 1024
export const INFERENCE_TIMEOUT = 10000
export const FEATURE_KEYS = ['jumlah_bayi_6_bulan', 'jumlah_asi_eksklusif', 'persentase_cakupan']
```

### 5. src/lib/actions/predict.ts
```typescript
'use server'
import { prisma } from '@/lib/prisma'
import { ML_ENGINE_URL, WINDOW_SIZE, INFERENCE_TIMEOUT, FEATURE_KEYS } from '@/lib/constants'
import type { ApiResponse, PrediksiDTO } from '@/types'

export async function predictPuskesmas(puskesmasId: number): Promise<ApiResponse<PrediksiDTO[]>> {
  try {
    const historyData = await prisma.dataBulanan.findMany({
      where: { puskesmas_id: puskesmasId },
      orderBy: { tanggal: 'desc' },
      take: WINDOW_SIZE,
    })
    if (historyData.length < WINDOW_SIZE) {
      return { success: false, error: `Data tidak cukup: ${historyData.length}/${WINDOW_SIZE} bulan` }
    }
    const history = historyData.reverse().map(row =>
      FEATURE_KEYS.map(k => { const v = (row as any)[k]; return typeof v === 'number' ? v : 0 })
    )
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT)
    const res = await fetch(`${ML_ENGINE_URL}/ml/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ puskesmas_id: puskesmasId, history }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!res.ok) return { success: false, error: `ML Engine error: ${await res.text()}` }
    const result = await res.json()
    const lastBulan = new Date(historyData[historyData.length - 1].tanggal)
    const predictions: PrediksiDTO[] = []
    for (let i = 0; i < result.predictions.length; i++) {
      const bulanPrediksi = new Date(lastBulan)
      bulanPrediksi.setMonth(bulanPrediksi.getMonth() + i + 1)
      const saved = await prisma.prediksi.upsert({
        where: { puskesmas_id_bulan_prediksi: { puskesmas_id: puskesmasId, bulan_prediksi: bulanPrediksi } },
        update: { nilai_prediksi: result.predictions[i] },
        create: { puskesmas_id: puskesmasId, bulan_prediksi: bulanPrediksi, nilai_prediksi: result.predictions[i] },
      })
      predictions.push({ id: saved.id, puskesmas_id: saved.puskesmas_id, bulan_prediksi: saved.bulan_prediksi.toISOString(), nilai_prediksi: saved.nilai_prediksi, nilai_aktual: saved.nilai_aktual })
    }
    return { success: true, data: predictions }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function getShapForPrediction(prediksiId: number): Promise<ApiResponse<ShapValueDTO[]>> {
  const values = await prisma.shapValue.findMany({ where: { prediksi_id: prediksiId } })
  return { success: true, data: values.map(v => ({ id: v.id, prediksi_id: v.prediksi_id, fitur: v.fitur, lag: v.lag, shap_value: v.shap_value })) }
}
```

### 6. prisma/seed.ts
```typescript
import { PrismaClient } from '@prisma/client'
import { parse, isValid } from 'date-fns'
import * as fs from 'fs'

const prisma = new PrismaClient()

async function main() {
  const csv = fs.readFileSync('data_master_2021_2024.csv', 'utf-8')
  const lines = csv.trim().split('\n')
  const headers = lines[0].split(',')
  const rows = lines.slice(1).map(l => {
    const vals = l.split(',')
    const row: any = {}
    headers.forEach((h, i) => { row[h.trim()] = vals[i]?.trim() })
    return row
  })

  // Extract unique puskesmas
  const puskesmasSet = new Map<string, any>()
  for (const r of rows) {
    const key = r['Puskesmas']
    if (!puskesmasSet.has(key)) {
      puskesmasSet.set(key, { kode: key, nama: r['Puskesmas'], kecamatan: r['Kecamatan'] })
    }
  }

  // Insert puskesmas
  for (const p of puskesmasSet.values()) {
    await prisma.puskesmas.upsert({
      where: { kode: p.kode },
      update: p,
      create: p,
    })
  }
  console.log(`Seeded ${puskesmasSet.size} puskesmas`)

  // Insert data bulanan
  let count = 0
  for (const r of rows) {
    const date = parse(r['Tanggal'], 'yyyy-MM-dd', new Date())
    if (!isValid(date)) continue
    const puskesmas = await prisma.puskesmas.findUnique({ where: { kode: r['Puskesmas'] } })
    if (!puskesmas) continue
    await prisma.dataBulanan.upsert({
      where: { puskesmas_id_tanggal: { puskesmas_id: puskesmas.id, tanggal: date } },
      update: {},
      create: {
        puskesmas_id: puskesmas.id,
        tanggal: date,
        jumlah_bayi_6_bulan: parseFloat(r['Jumlah_Bayi_6_Bulan']),
        jumlah_asi_eksklusif: parseFloat(r['Jumlah_ASI_Eksklusif']),
        persentase_cakupan: parseFloat(r['Persentase_Cakupan']),
      },
    })
    count++
  }
  console.log(`Seeded ${count} data bulanan rows`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
```

### 7. src/app/api/puskesmas/route.ts
```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const puskesmas = await prisma.puskesmas.findMany({ orderBy: { nama: 'asc' } })
  return NextResponse.json({ success: true, data: puskesmas })
}
```

[EKSEKUSI]
1. Setup .env.local: DATABASE_URL="mysql://root:@localhost:3306/db_asi_prediksi"
2. npm install; npx prisma generate; npx prisma db push
3. npx tsx prisma/seed.ts
4. npm run dev → buka http://localhost:3000/api/puskesmas → harus return JSON 24 puskesmas
5. Test action predict: buat file test sederhana atau gunakan browser console.

[REVIEW]
- Apakah semua tabel terbuat di MySQL? Cek dengan npx prisma studio.
- Apakah seed berhasil mengisi data? Cek jumlah baris di tabel data_bulanan.
- Apakah API /api/puskesmas mengembalikan 24 baris?
- Apakah Server Action predict terhubung ke FastAPI? Cek log FastAPI untuk request masuk.
- Apakah validasi tanggal berfungsi? Uji dengan input "2024-02-30" → harus ditolak.

[PERBAIKI JIKA ADA SALAH DAN MANTAPKAN]
Jika ada error:
- Database connection: pastikan MySQL running, DATABASE_URL benar.
- Prisma generate: jika gagal, hapus node_modules/.prisma dan jalankan ulang.
- Seed gagal: periksa format CSV, pastikan path file benar.
- Fetch ke FastAPI: pastikan FastAPI running di port 8000.

Setelah semua berjalan 100% sempurna → LANJUT TAHAP 3.
```

---

## Tahap 3: Frontend Dashboard Premium (UI/UX Pro Max)

### Prompt untuk AI Engineer (UI/UX Frontend Agent)

```
[THINKING]
Sebelum menulis kode, analisis:

1. **Tema**: Dark mode #0a0f1e, glassmorphism (bg-white/5, backdrop-blur-xl, border-white/10),
   aksen emerald #10b981 → cyan #06b6d4 gradient, neon glow shadows.
2. **Layout**: Sidebar navigasi kiri (sempit, icon-only di mobile), header dengan search bar,
   main content area dengan padding responsif.
3. **Framer Motion**: Semua komponen wajib punya animasi entry. Page transition fade + translateY,
   card hover scale + glow, skeleton shimmer CSS, animated number count-up.
4. **Komponen Premium**: GlowCard, GradientButton, AnimatedNumber, SkeletonShimmer, DataTable,
   ModalGlass, ToastNotification — semua dengan glassmorphism.
5. **Grafik**: Recharts LineChart untuk perbandingan aktual vs prediksi.
6. **Halaman**: Dashboard (stat cards, grafik, tabel), Detail Puskesmas (id dynamic route), Laporan.
7. **Loading States**: SkeletonShimmer di setiap area saat fetching data.
8. **Error States**: ToastNotification dari provider global.

Edge cases:
- prefers-reduced-motion: gunakan useReducedMotion() dari framer-motion untuk non-aktifkan animasi.
- Responsive: grid dari 1 kolom (mobile) → 2 (tablet) → 4 (desktop).
- Data null/undefined: tampilkan fallback "-" atau "Tidak tersedia".

[BUILD]
Buat file-file berikut:

### 1. tailwind.config.ts
```typescript
import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        glass: { DEFAULT: 'rgba(255,255,255,0.05)', light: 'rgba(255,255,255,0.1)', medium: 'rgba(255,255,255,0.15)' },
        dark: { bg: '#0a0f1e', card: '#111827', surface: '#1f2937' },
        emerald: { 400: '#34d399', 500: '#10b981' },
        cyan: { 400: '#22d3ee', 500: '#06b6d4' },
      },
      boxShadow: {
        'glow-emerald': '0 0 25px rgba(16,185,129,0.2)',
        'glow-cyan': '0 0 25px rgba(6,182,212,0.2)',
      },
      animation: {
        shimmer: 'shimmer 2s linear infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        fadeIn: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
export default config
```

### 2. src/app/globals.css
```css
@tailwind base; @tailwind components; @tailwind utilities;
body { background: #0a0f1e; color: #f9fafb; font-family: 'Inter', sans-serif; }
.glass { background: rgba(255,255,255,0.05); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; }
.glass-hover:hover { background: rgba(255,255,255,0.08); border-color: rgba(16,185,129,0.3); box-shadow: 0 0 25px rgba(16,185,129,0.2); transition: all 0.2s ease; }
.skeleton { background: linear-gradient(90deg, #111827 25%, #1f2937 50%, #111827 75%); background-size: 200% 100%; animation: shimmer 2s linear infinite; border-radius: 8px; }
@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
```

### 3. src/components/ui/GlowCard.tsx
```typescript
'use client'
import { motion } from 'framer-motion'
import { ReactNode } from 'react'

export default function GlowCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, transition: { type: 'spring', stiffness: 300 } }}
      className={`glass glass-hover p-6 transition-all duration-200 ${className}`}>
      {children}
    </motion.div>
  )
}
```

### 4. src/components/ui/AnimatedNumber.tsx
```typescript
'use client'
import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform, useInView } from 'framer-motion'

export default function AnimatedNumber({ value, decimals = 2, suffix = '', className = '' }: { value: number; decimals?: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { damping: 30, stiffness: 100 })
  const display = useTransform(spring, (v) => `${v.toFixed(decimals)}${suffix}`)
  useEffect(() => { if (isInView) mv.set(value) }, [isInView, value, mv])
  return <motion.span ref={ref} className={className}>{display}</motion.span>
}
```

### 5. src/components/ui/SkeletonShimmer.tsx
```typescript
export default function SkeletonShimmer({ className = 'h-4 w-full', count = 1 }: { className?: string; count?: number }) {
  return <>{Array.from({ length: count }).map((_, i) => <div key={i} className={`skeleton ${className}`} style={{ animationDelay: `${i * 0.1}s` }} />)}</>
}
```

### 6. src/components/ui/GradientButton.tsx
```typescript
'use client'
import { motion } from 'framer-motion'
import { ReactNode } from 'react'

export default function GradientButton({ children, onClick, disabled, className = '' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <motion.button whileHover={disabled ? {} : { scale: 1.03, boxShadow: '0 0 20px rgba(16,185,129,0.3)' }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      onClick={onClick} disabled={disabled}
      className={`bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-medium rounded-lg px-5 py-2.5 transition-all disabled:opacity-50 ${className}`}>
      {children}
    </motion.button>
  )
}
```

### 7. src/app/(dashboard)/page.tsx
```typescript
'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import GlowCard from '@/components/ui/GlowCard'
import AnimatedNumber from '@/components/ui/AnimatedNumber'
import SkeletonShimmer from '@/components/ui/SkeletonShimmer'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [puskesmas, setPuskesmas] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/puskesmas')
        const json = await res.json()
        setPuskesmas(json.data || [])
        setStats({
          total: json.data?.length || 24,
          rata_rata: 67.5,
          tertinggi: { nama: 'Puskesmas A', nilai: 89.2 },
          terendah: { nama: 'Puskesmas X', nilai: 42.1 },
        })
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Dashboard Prediksi ASI Eksklusif</h1>
      <p className="text-sm text-gray-500">Monitoring cakupan ASI Eksklusif 24 Puskesmas + XAI Insights</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass p-6"><SkeletonShimmer className="h-3 w-24 mb-3" /><SkeletonShimmer className="h-8 w-32" /></div>
        )) : (
          <>
            <GlowCard>
              <p className="text-sm text-gray-400 mb-1">Rata-rata Cakupan</p>
              <AnimatedNumber value={stats.rata_rata} suffix="%" className="text-3xl font-bold neon-text-emerald" />
              <p className="text-xs text-gray-500 mt-1">{stats.total} Puskesmas</p>
            </GlowCard>
            <GlowCard>
              <p className="text-sm text-gray-400 mb-1">Tertinggi</p>
              <AnimatedNumber value={stats.tertinggi.nilai} suffix="%" className="text-3xl font-bold text-emerald-400" />
              <p className="text-xs text-gray-500 mt-1">{stats.tertinggi.nama}</p>
            </GlowCard>
            <GlowCard>
              <p className="text-sm text-gray-400 mb-1">Terendah</p>
              <AnimatedNumber value={stats.terendah.nilai} suffix="%" className="text-3xl font-bold text-cyan-400" />
              <p className="text-xs text-gray-500 mt-1">{stats.terendah.nama}</p>
            </GlowCard>
            <GlowCard>
              <p className="text-sm text-gray-400 mb-1">Total</p>
              <AnimatedNumber value={stats.total} decimals={0} className="text-3xl font-bold text-white" />
              <p className="text-xs text-gray-500 mt-1">Puskesmas</p>
            </GlowCard>
          </>
        )}
      </div>

      <GlowCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-white/5"><h3 className="text-sm font-medium">Daftar Puskesmas</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs text-gray-500">Kode</th>
              <th className="px-4 py-3 text-left text-xs text-gray-500">Nama</th>
              <th className="px-4 py-3 text-left text-xs text-gray-500">Kecamatan</th>
              <th className="px-4 py-3 text-right text-xs text-gray-500">Aksi</th>
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={4} className="px-4 py-3"><SkeletonShimmer className="h-4 w-full" /></td></tr>
              )) : puskesmas.map((p, i) => (
                <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-400">{p.kode}</td>
                  <td className="px-4 py-3 text-sm text-gray-200">{p.nama}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{p.kecamatan}</td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/puskesmas/${p.id}`} className="text-xs text-emerald-400 hover:text-emerald-300">Detail</a>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlowCard>
    </motion.div>
  )
}
```

### 8. src/app/(dashboard)/puskesmas/[id]/page.tsx
```typescript
'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import GlowCard from '@/components/ui/GlowCard'
import GradientButton from '@/components/ui/GradientButton'
import SkeletonShimmer from '@/components/ui/SkeletonShimmer'

export default function DetailPuskesmasPage() {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [puskesmas, setPuskesmas] = useState<any>(null)
  const [predictions, setPredictions] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      await new Promise(r => setTimeout(r, 800))
      setPuskesmas({ id, nama: 'Puskesmas A', kecamatan: 'Kecamatan A' })
      setPredictions([{ bulan: '2025-01', nilai: 72.5 }, { bulan: '2025-02', nilai: 74.1 }])
      setLoading(false)
    }
    load()
  }, [id])

  const handlePredict = async () => {
    // Panggil Server Action predictPuskesmas(Number(id))
    // const res = await predictPuskesmas(Number(id))
    // if (res.success) showToast('success', 'Prediksi berhasil')
    alert('Prediksi akan diintegrasikan dengan Server Action')
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{loading ? <SkeletonShimmer className="h-8 w-48" /> : puskesmas?.nama}</h1>
          <p className="text-sm text-gray-500">{puskesmas?.kecamatan}</p>
        </div>
        <GradientButton onClick={handlePredict}>Prediksi Sekarang</GradientButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlowCard>
          <h3 className="text-sm font-medium mb-4">Riwayat & Prediksi</h3>
          {loading ? <SkeletonShimmer className="h-[200px] w-full" /> : (
            <div className="space-y-2">
              {predictions.map((p, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-white/5 last:border-0">
                  <span className="text-sm text-gray-400">{p.bulan}</span>
                  <span className="text-sm font-medium text-emerald-400">{p.nilai.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          )}
        </GlowCard>

        <GlowCard>
          <h3 className="text-sm font-medium mb-4">XAI Insights (SHAP)</h3>
          <p className="text-sm text-gray-500">Fitur ini akan menampilkan kontribusi Jumlah_Bayi_6_Bulan dan Jumlah_ASI_Eksklusif per lag waktu. Tekan "Prediksi Sekarang" untuk mengaktifkan.</p>
        </GlowCard>
      </div>
    </motion.div>
  )
}
```

[EKSEKUSI]
1. npm run dev → buka http://localhost:3000
2. Periksa: animasi fade-in, glassmorphism cards, skeleton shimmer saat loading, count-up numbers.
3. Klik tombol "Detail" di tabel → navigasi ke /puskesmas/1
4. Klik "Prediksi Sekarang" → alert muncul (sementara, sebelum integrasi Server Action).
5. Uji responsif: Chrome DevTools 375px, 768px, 1440px.

[REVIEW]
- Apakah semua animasi Framer Motion smooth di 60fps?
- Apakah skeleton shimmer muncul saat data loading?
- Apakah glassmorphism konsisten di semua card dan modal?
- Apakah mobile responsive? Navbar sidebar collapse di mobile?
- Apakah prefers-reduced-motion dihormati?

[PERBAIKI JIKA ADA SALAH DAN MANTAPKAN]
- Animasi lag: gunakan will-change: transform, kurangi jumlah elemen yang dianimasi bersamaan.
- Layout shift: pastikan skeleton memiliki dimensi yang sama dengan konten asli.
- Glassmorphism tidak tampil di Firefox: pastikan -webkit-backdrop-filter prefix.
- Warna glow: sesuaikan opacity di box-shadow (0.2 → 0.3 jika terlalu redup).
- Jika ada error TypeScript: jalankan npm run lint dan npx tsc --noEmit.

Setelah semua halaman berjalan 100% sempurna → LANJUT TAHAP 4.
```

---

## Tahap 4: Integrasi Visualisasi SHAP/XAI di Frontend

### Prompt untuk AI Engineer (UI/UX + Backend Agent)

```
[THINKING]
Sebelum menulis kode, analisis:

1. **Data SHAP**: Dari endpoint /ml/shap, kita dapatkan format:
   ```json
   { "features": [{ "feature": "Jumlah_Bayi_6_Bulan", "mean_abs_impact": 0.05, "impacts": [{ "lag": 12, "shap_value": 0.02, "feature_name": "..." }, ...] }], "expected_value": 65.0 }
   ```
2. **SHAP Force Plot**: Visualisasi yang menunjukkan kontribusi setiap fitur per lag.
   - Bar horizontal: warna merah (#ef4444) untuk kontribusi positif, biru (#3b82f6) untuk negatif.
   - Base value (expected_value) ditampilkan sebagai garis vertikal referensi.
   - Output akhir: base_value + sum(contributions) = prediction.
3. **SHAP Summary Bar**: Rata-rata |SHAP| per fitur — fitur mana paling berpengaruh.
4. **Feature Timeline**: Line chart kecil per fitur — bagaimana kontribusi berubah dari t-12 ke t-1.
5. **Interpretation Card**: Narasi otomatis seperti "Jumlah_ASI_Eksklusif pada 3 bulan terakhir meningkatkan prediksi sebesar X%".
6. **Animasi Framer Motion**: Bar SHAP muncul staggered dengan spring bounce.

Edge cases:
- SHAP values semua 0: model mungkin linear sempurna atau input seragam.
- Nilai SHAP sangat besar: tampilkan dengan notasi ilmiah atau skala log.
- Data tidak tersedia (belum predict): tampilkan placeholder "Lakukan prediksi terlebih dahulu".

[BUILD]
Buat file-file berikut:

### 1. src/types/shap.ts
```typescript
export interface ShapImpact { lag: number; shap_value: number; feature_name: string }
export interface ShapFeature { feature: string; mean_abs_impact: number; impacts: ShapImpact[] }
export interface ShapResponse { success: boolean; puskesmas_id: number; expected_value: number; features: ShapFeature[] }
```

### 2. src/components/xai/ShapForcePlot.tsx
```typescript
'use client'
import { motion } from 'framer-motion'
import type { ShapFeature } from '@/types/shap'

interface Props {
  expectedValue: number
  features: ShapFeature[]
  prediction: number
  loading?: boolean
}

export default function ShapForcePlot({ expectedValue, features, prediction, loading }: Props) {
  if (loading) return <div className="skeleton h-[300px] w-full rounded-lg" />
  if (!features?.length) return <p className="text-sm text-gray-500">Belum ada data SHAP. Lakukan prediksi terlebih dahulu.</p>

  // Ambil 2 fitur pertama (Jumlah_Bayi_6_Bulan, Jumlah_ASI_Eksklusif)
  const impacts = features.flatMap(f => f.impacts.map(i => ({ ...i, feature: f.feature, abs: Math.abs(i.shap_value) })))
  const maxAbs = Math.max(...impacts.map(i => i.abs), 0.001)
  const diff = prediction - expectedValue

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">Base: {expectedValue.toFixed(2)}%</span>
        <span className="text-emerald-400 font-medium">Prediksi: {prediction.toFixed(2)}%</span>
        <span className={diff >= 0 ? 'text-red-400' : 'text-blue-400'}>
          Δ {diff >= 0 ? '+' : ''}{diff.toFixed(2)}%
        </span>
      </div>

      {/* Force Plot Bars */}
      <div className="space-y-1.5">
        {impacts.map((imp, i) => (
          <motion.div key={`${imp.feature}-${imp.lag}`}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ delay: i * 0.04, type: 'spring', stiffness: 200 }}
            className="origin-left flex items-center gap-2"
          >
            <div className="w-32 text-right text-xs text-gray-500 truncate flex-shrink-0">
              {imp.feature === 'Jumlah_Bayi_6_Bulan' ? 'Bayi 6B' : 'ASI Eksklusif'} t-{imp.lag}
            </div>
            <div className="flex-1 h-5 rounded relative overflow-hidden bg-white/5"
              style={{ direction: imp.shap_value >= 0 ? 'ltr' : 'rtl' }}>
              <motion.div
                className={`h-full rounded ${imp.shap_value >= 0 ? 'bg-red-500/70' : 'bg-blue-500/70'}`}
                style={{ width: `${(imp.abs / maxAbs) * 100}%` }}
              />
            </div>
            <div className="w-20 text-xs font-mono text-right flex-shrink-0">
              <span className={imp.shap_value >= 0 ? 'text-red-400' : 'text-blue-400'}>
                {imp.shap_value >= 0 ? '+' : ''}{imp.shap_value.toFixed(4)}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex items-center gap-4 text-xs pt-2 border-t border-white/5">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500" /> Positif (↑ prediksi)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-500" /> Negatif (↓ prediksi)</span>
      </div>
    </div>
  )
}
```

### 3. src/components/xai/ShapSummaryBar.tsx
```typescript
'use client'
import { motion } from 'framer-motion'
import type { ShapFeature } from '@/types/shap'

export default function ShapSummaryBar({ features, loading }: { features?: ShapFeature[]; loading?: boolean }) {
  if (loading) return <div className="skeleton h-[150px] w-full rounded-lg" />
  if (!features?.length) return <p className="text-sm text-gray-500">Data SHAP belum tersedia.</p>

  const maxMean = Math.max(...features.map(f => f.mean_abs_impact), 0.001)

  return (
    <div className="space-y-3">
      {features.map((f, i) => (
        <motion.div key={f.feature} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">{f.feature}</span>
            <span className="text-gray-500">{f.mean_abs_impact.toFixed(4)}</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full origin-left"
              style={{ width: `${(f.mean_abs_impact / maxMean) * 100}%` }} />
          </div>
        </motion.div>
      ))}
    </div>
  )
}
```

### 4. src/components/xai/InterpretationCard.tsx
```typescript
'use client'
import type { ShapFeature } from '@/types/shap'

export default function InterpretationCard({ features, expectedValue, prediction }: { features?: ShapFeature[]; expectedValue: number; prediction: number }) {
  if (!features?.length) return null

  const positive = features.flatMap(f => f.impacts.filter(i => i.shap_value > 0))
  const negative = features.flatMap(f => f.impacts.filter(i => i.shap_value < 0))
  const topPositive = positive.sort((a, b) => b.shap_value - a.shap_value).slice(0, 2)
  const topNegative = negative.sort((a, b) => a.shap_value - b.shap_value).slice(0, 2)

  return (
    <div className="space-y-3 text-sm">
      <p className="text-gray-300 leading-relaxed">
        Model memprediksi cakupan ASI sebesar <span className="text-emerald-400 font-semibold">{prediction.toFixed(2)}%</span>
        , dengan baseline rata-rata {expectedValue.toFixed(2)}%.
      </p>
      {topPositive.length > 0 && (
        <p className="text-gray-300">
          <span className="text-red-400 font-medium">Faktor peningkatan:</span>{' '}
          {topPositive.map((t, i) => (
            <span key={i}> &quot;{t.feature_name}&quot; pada lag t-{t.lag} (kontribusi +{t.shap_value.toFixed(2)}){i < topPositive.length - 1 ? ', ' : ''}</span>
          ))}
        </p>
      )}
      {topNegative.length > 0 && (
        <p className="text-gray-300">
          <span className="text-blue-400 font-medium">Faktor penurunan:</span>{' '}
          {topNegative.map((t, i) => (
            <span key={i}> &quot;{t.feature_name}&quot; pada lag t-{t.lag} (kontribusi {t.shap_value.toFixed(2)}){i < topNegative.length - 1 ? ', ' : ''}</span>
          ))}
        </p>
      )}
    </div>
  )
}
```

### 5. Integrasi ke Halaman Detail Puskesmas
Tambahkan di file `app/(dashboard)/puskesmas/[id]/page.tsx`:
```typescript
import ShapForcePlot from '@/components/xai/ShapForcePlot'
import ShapSummaryBar from '@/components/xai/ShapSummaryBar'
import InterpretationCard from '@/components/xai/InterpretationCard'

// Tambahkan state:
const [shapData, setShapData] = useState<any>(null)
const [shapLoading, setShapLoading] = useState(false)

// Handler predict diperbarui:
const handlePredict = async () => {
  setShapLoading(true)
  const res = await fetch('/api/predict/shap?puskesmas_id=' + id)
  const json = await res.json()
  if (json.success) setShapData(json.data)
  setShapLoading(false)
}

// Render XAI panel setelah grafik:
<GlowCard>
  <h3 className="text-sm font-medium mb-4">XAI — SHAP Force Plot</h3>
  <ShapForcePlot
    expectedValue={shapData?.shap?.expected_value ?? 65}
    features={shapData?.shap?.features ?? []}
    prediction={shapData?.prediction ?? 0}
    loading={shapLoading}
  />
</GlowCard>
<GlowCard>
  <h3 className="text-sm font-medium mb-4">Ringkasan Kontribusi Fitur</h3>
  <ShapSummaryBar features={shapData?.shap?.features} loading={shapLoading} />
</GlowCard>
<GlowCard>
  <h3 className="text-sm font-medium mb-4">Interpretasi Otomatis</h3>
  <InterpretationCard features={shapData?.shap?.features} expectedValue={shapData?.shap?.expected_value ?? 0} prediction={shapData?.prediction ?? 0} />
</GlowCard>
```

[EKSEKUSI]
1. Pastikan FastAPI dan Next.js running.
2. Buka halaman detail Puskesmas → http://localhost:3000/puskesmas/1
3. Klik "Prediksi Sekarang" → loading state → data SHAP muncul.
4. Periksa: force plot, summary bar, interpretation card.
5. Uji dengan berbagai nilai SHAP (positif dan negatif).

[REVIEW]
- Apakah force plot menampilkan bar dengan warna merah (positif) dan biru (negatif)?
- Apakah animasi staggered spring bekerja saat bar muncul?
- Apakah interpretation card menghasilkan narasi yang masuk akal secara bahasa?
- Apakah base value + sum SHAP ≈ prediction?

[PERBAIKI JIKA ADA SALAH DAN MANTAPKAN]
- Warna bar tidak sesuai: periksa kondisi `shap_value >= 0` → merah, else → biru.
- Narasi tidak masuk akal: perbaiki logika pemilihan topPositive/topNegative.
- Bar tidak muncul: periksa format data dari API, pastikan impacts array tidak kosong.
- Animasi terlalu lambat: kurangi delay stagger dari 0.04 ke 0.02.

Setelah semua visualisasi SHAP berjalan 100% sempurna → LANJUT TAHAP 5.
```

---

## Tahap 5: Upload File, Validasi Tanggal, Export Report

### Prompt untuk AI Engineer (Backend + UI/UX Agent)

```
[THINKING]
Sebelum menulis kode, analisis:

1. **DropZone**: Komponen dengan drag & drop, accept .csv dan .xlsx, preview 10 baris.
2. **Validasi Tanggal Cerdas**: Loop setiap baris, parse dengan date-fns, cek isValid(),
   cek getDaysInMonth() untuk eliminasi 30/31 Februari, 31 April, 31 Juni, 31 September, 31 November.
3. **Append Data**: Transaction Prisma untuk insert/update data_bulanan.
   Cek duplikasi dengan unique constraint (puskesmas_id, tanggal).
4. **Export Excel**: Gunakan ExcelJS (atau xlsx library). Buat multiple sheets:
   - Sheet 1: "Data Historis" — tanggal, puskesmas, aktual
   - Sheet 2: "Prediksi" — tanggal, puskesmas, prediksi, aktual (jika ada)
   - Sheet 3: "SHAP Values" — prediksi_id, fitur, lag, nilai
5. **Export CSV**: Flat file dengan header lengkap termasuk kolom SHAP.

Edge cases:
- File .xlsx dengan multiple sheets: baca sheet pertama saja.
- Encoding non-UTF8: deteksi dan konversi.
- File kosong: tolak dengan error.
- Export filter menghasilkan 0 baris: return "Tidak ada data".
- Ukuran file > 10MB: tolak sebelum diproses.

[BUILD]
Buat file-file berikut:

### 1. src/components/upload/DropZone.tsx
```typescript
'use client'
import { useState, useRef } from 'react'
import { motion } from 'framer-motion'

export default function DropZone({ onFile, accept = '.csv,.xlsx', maxSize = 10 * 1024 * 1024 }: { onFile: (f: File) => void; accept?: string; maxSize?: number }) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validate = (file: File) => {
    setError(null)
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!accept.split(',').map(a => a.trim()).includes(ext)) { setError(`Format harus ${accept}`); return false }
    if (file.size > maxSize) { setError(`Maksimal ${maxSize / 1024 / 1024} MB`); return false }
    if (file.size === 0) { setError('File kosong'); return false }
    return true
  }

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f && validate(f)) onFile(f) }
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f && validate(f)) onFile(f) }

  return (
    <div>
      <motion.div onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`glass border-2 border-dashed p-8 text-center cursor-pointer ${dragging ? 'border-emerald-500 bg-emerald-500/5' : 'border-white/10 hover:border-emerald-500/30'}`}>
        <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />
        <p className="text-sm text-gray-300">{dragging ? 'Lepaskan file...' : 'Seret file atau klik untuk pilih'}</p>
        <p className="text-xs text-gray-500 mt-1">CSV / XLSX, maks {maxSize / 1024 / 1024}MB</p>
      </motion.div>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </div>
  )
}
```

### 2. src/lib/actions/upload.ts (Validasi Tanggal Cerdas)
```typescript
'use server'
import { prisma } from '@/lib/prisma'
import { parse, isValid, getDate, getMonth, getDaysInMonth } from 'date-fns'
import type { ApiResponse, UploadRow } from '@/types'
import { MAX_FILE_SIZE } from '@/lib/constants'

function validateDate(str: string): { valid: boolean; error?: string; date?: Date } {
  const date = parse(str, 'yyyy-MM-dd', new Date())
  if (!isValid(date)) return { valid: false, error: `"${str}" format harus YYYY-MM-DD` }
  const day = getDate(date), month = getMonth(date) + 1, maxDay = getDaysInMonth(date)
  if (day > maxDay) return { valid: false, error: `"${str}" tidak valid: bulan ${month} maksimal ${maxDay} hari` }
  return { valid: true, date }
}

function parseCSV(text: string): UploadRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim())
    const row: any = {}
    headers.forEach((h, i) => { const n = Number(vals[i]); row[h] = isNaN(n) ? vals[i] : n })
    return row as UploadRow
  })
}

export async function validateUpload(formData: FormData): Promise<ApiResponse<{ preview: UploadRow[]; total: number; errors: string[] }>> {
  const file = formData.get('file') as File | null
  if (!file) return { success: false, error: 'Tidak ada file' }
  if (file.size > MAX_FILE_SIZE) return { success: false, error: 'File terlalu besar' }

  const text = await file.text()
  const rows = text.includes('\r') ? parseCSV(text.replace(/\r/g, '')) : parseCSV(text)
  const errors: string[] = []
  const valid: UploadRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], lineNum = i + 2
    const dv = validateDate(String(r['Tanggal'] || ''))
    if (!dv.valid) { errors.push(`Baris ${lineNum}: ${dv.error}`); continue }
    if (!r['Puskesmas']) { errors.push(`Baris ${lineNum}: Puskesmas kosong`); continue }
    if (typeof r['Jumlah_Bayi_6_Bulan'] !== 'number') { errors.push(`Baris ${lineNum}: Jumlah_Bayi_6_Bulan harus angka`); continue }
    if (typeof r['Jumlah_ASI_Eksklusif'] !== 'number') { errors.push(`Baris ${lineNum}: Jumlah_ASI_Eksklusif harus angka`); continue }
    valid.push(r)
  }

  return {
    success: errors.length === 0,
    data: { preview: valid.slice(0, 10), total: valid.length, errors },
    message: `${valid.length} valid, ${errors.length} ditolak`,
  }
}

export async function appendData(formData: FormData): Promise<ApiResponse<any>> {
  const file = formData.get('file') as File | null
  if (!file) return { success: false, error: 'Tidak ada file' }
  const text = await file.text()
  const rows = parseCSV(text)
  let success = 0, fail = 0

  for (const row of rows) {
    const dv = validateDate(String(row['Tanggal']))
    if (!dv.valid || !dv.date) { fail++; continue }
    const puskesmas = await prisma.puskesmas.findFirst({ where: { nama: String(row['Puskesmas']) } })
    if (!puskesmas) { fail++; continue }
    await prisma.dataBulanan.upsert({
      where: { puskesmas_id_tanggal: { puskesmas_id: puskesmas.id, tanggal: dv.date } },
      update: { jumlah_bayi_6_bulan: row['Jumlah_Bayi_6_Bulan'] as number, jumlah_asi_eksklusif: row['Jumlah_ASI_Eksklusif'] as number },
      create: { puskesmas_id: puskesmas.id, tanggal: dv.date, jumlah_bayi_6_bulan: row['Jumlah_Bayi_6_Bulan'] as number, jumlah_asi_eksklusif: row['Jumlah_ASI_Eksklusif'] as number },
    })
    success++
  }

  await prisma.uploadLog.create({
    data: { filename: file.name, total_rows: rows.length, rows_valid: success, rows_rejected: fail, status: fail > 0 ? 'PARTIAL' : 'SUCCESS', detail_error: fail > 0 ? `${fail} baris ditolak` : null }
  })

  return { success: true, data: { total: rows.length, valid: success, rejected: fail }, message: `${success} baris ditambahkan` }
}
```

### 3. src/app/(dashboard)/upload/page.tsx
```typescript
'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import DropZone from '@/components/upload/DropZone'
import GradientButton from '@/components/ui/GradientButton'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [preview, setPreview] = useState<any[]>([])

  const handleFile = async (f: File) => {
    setFile(f); setLoading(true); setResult(null)
    const fd = new FormData(); fd.append('file', f)
    const res = await fetch('/api/data/upload', { method: 'POST', body: fd })
    const json = await res.json()
    setPreview(json.data?.preview || [])
    setResult(json)
    setLoading(false)
  }

  const handleAppend = async () => {
    if (!file) return; setLoading(true)
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/data/append', { method: 'POST', body: fd })
    const json = await res.json()
    setResult(json)
    if (json.success) setFile(null)
    setLoading(false)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Upload Data Tahunan</h1>
      <DropZone onFile={handleFile} />

      {loading && <div className="skeleton h-20 rounded-lg" />}

      {result && !loading && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass p-6 space-y-4">
          <h3 className="text-sm font-medium">Ringkasan Validasi</h3>
          <div className="flex gap-4 text-center">
            <div className="flex-1"><p className="text-2xl font-bold text-white">{result.data?.total || 0}</p><p className="text-xs text-gray-500">Total</p></div>
            <div className="flex-1"><p className="text-2xl font-bold text-emerald-400">{result.data?.total || 0}</p><p className="text-xs text-gray-500">Valid</p></div>
            <div className="flex-1"><p className="text-2xl font-bold text-red-400">{result.data?.errors?.length || 0}</p><p className="text-xs text-gray-500">Error</p></div>
          </div>

          {preview.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/5">
                  <th className="px-3 py-2 text-left text-xs text-gray-500">Tanggal</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-500">Puskesmas</th>
                  <th className="px-3 py-2 text-right text-xs text-gray-500">Bayi 6B</th>
                  <th className="px-3 py-2 text-right text-xs text-gray-500">ASI Eksklusif</th>
                </tr></thead>
                <tbody>{preview.map((r, i) => (
                  <tr key={i} className="border-b border-white/5"><td className="px-3 py-2 text-gray-300">{r.Tanggal}</td><td className="px-3 py-2 text-gray-300">{r.Puskesmas}</td><td className="px-3 py-2 text-right text-gray-300">{typeof r.Jumlah_Bayi_6_Bulan === 'number' ? r.Jumlah_Bayi_6_Bulan.toFixed(4) : '-'}</td><td className="px-3 py-2 text-right text-gray-300">{typeof r.Jumlah_ASI_Eksklusif === 'number' ? r.Jumlah_ASI_Eksklusif.toFixed(4) : '-'}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {result.data?.errors?.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 max-h-32 overflow-y-auto">
              {result.data.errors.map((e: string, i: number) => <p key={i} className="text-xs text-red-300">{e}</p>)}
            </div>
          )}

          <div className="flex gap-3">
            <GradientButton onClick={() => { setFile(null); setResult(null); setPreview([]) }}>Upload Ulang</GradientButton>
            {file && <GradientButton onClick={handleAppend} disabled={result.data?.total === 0}>Append {result.data?.total || 0} Baris</GradientButton>}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
```

### 4. src/app/(dashboard)/laporan/page.tsx
```typescript
'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import GlowCard from '@/components/ui/GlowCard'
import GradientButton from '@/components/ui/GradientButton'

export default function LaporanPage() {
  const [puskesmasId, setPuskesmasId] = useState('')
  const [loading, setLoading] = useState(false)

  const handleExport = async (format: 'csv' | 'excel') => {
    setLoading(true)
    const params = new URLSearchParams()
    if (puskesmasId) params.set('puskesmas_id', puskesmasId)
    const res = await fetch(`/api/export/${format}?${params}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `laporan_asi.${format}`; a.click()
    URL.revokeObjectURL(url)
    setLoading(false)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Export Laporan</h1>
      <GlowCard className="space-y-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Filter Puskesmas (opsional)</label>
          <input value={puskesmasId} onChange={e => setPuskesmasId(e.target.value)} placeholder="Kosongi untuk semua" className="w-full bg-dark-surface border border-white/10 rounded-lg px-4 py-2 text-sm text-gray-200 focus:border-emerald-500/50" />
        </div>
        <div className="flex gap-3">
          <GradientButton onClick={() => handleExport('csv')} disabled={loading}>Download CSV</GradientButton>
          <GradientButton onClick={() => handleExport('excel')} disabled={loading}>Download Excel</GradientButton>
        </div>
      </GlowCard>
    </motion.div>
  )
}
```

[EKSEKUSI]
1. Upload file CSV dengan data valid (5-10 baris) → validasi harus lolos.
2. Upload file dengan tanggal "2024-02-30" → harus ditolak dengan error spesifik.
3. Upload file XLSX → pastikan parsing berhasil (gunakan library xlsx jika CSV parsing gagal).
4. Klik Append → data masuk ke database.
5. Buka halaman Laporan → klik Download CSV/Excel → file terunduh.
6. Buka file Excel: periksa formatting, header, dan data.

[REVIEW]
- Apakah DropZone menerima drag & drop?
- Apakah validasi tanggal cacat berfungsi? Uji: 2024-02-30 (tidak valid), 2024-02-29 (valid, tahun kabisat).
- Apakah preview menampilkan 10 baris pertama?
- Apakah append sukses menyimpan data ke database?
- Apakah log upload tercatat di tabel upload_log?
- Apakah file CSV yang didownload bisa dibuka di Excel?
- Apakah file Excel memiliki multiple sheets?

[PERBAIKI JIKA ADA SALAH DAN MANTAPKAN]
- Validasi tanggal tidak akurat: uji dengan date-fns di console untuk berbagai input.
- XLSX tidak terbaca: install npm install xlsx dan gunakan XLSX.utils.sheet_to_json().
- Export error: periksa Route Handler /api/export/[...format].
- Excel tidak memiliki formatting: tambahkan styling di ExcelJS (header bold, auto column width).
- Jika ada baris duplikat: gunakan upsert, bukan insert biasa.

Setelah semua fitur berjalan 100% sempurna → **APLIKASI SIAP DIGUNAKAN**.
```

---

## Penutup

Setelah kelima tahap selesai dengan **100% sukses dan terverifikasi**, aplikasi **"Sistem Prediksi ASI Eksklusif + XAI Panel LSTM"** siap dijalankan secara penuh dengan fitur:

- ✅ Inferensi LSTM Panel 24 Puskesmas
- ✅ Visualisasi SHAP (Force Plot, Summary Bar, Interpretation Card)
- ✅ Dashboard Premium dengan Framer Motion & Glassmorphism
- ✅ Upload & Validasi Tanggal Cerdas
- ✅ Export Report CSV/Excel dengan data SHAP
- ✅ Database MySQL dengan Prisma ORM

**Selamat! Aplikasi Anda telah selesai dibangun.** 🚀
