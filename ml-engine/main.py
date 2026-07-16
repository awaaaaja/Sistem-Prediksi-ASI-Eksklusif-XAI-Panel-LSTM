import os
import time
import logging

import numpy as np
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import tensorflow as tf
import model_loader
from preprocess import prepare_sliding_window
import shap_explainer
from schemas import (
    PredictRequest,
    PredictResponse,
    ShapRequest,
    ShapResponse,
    HealthResponse,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

start_time = time.time()
model_status = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model_status
    logger.info("Starting ML/XAI Engine...")
    model_status = model_loader.load_models()
    if model_loader.model is not None:
        try:
            shap_explainer.init_shap(model_loader.model)
        except Exception as e:
            logger.error(f"SHAP initialization failed: {e}")
    yield
    logger.info("ML/XAI Engine shutting down.")


app = FastAPI(
    title="LSTM Panel ML/XAI Engine — Prediksi ASI Eksklusif",
    description="Microservice inferensi LSTM + XAI SHAP untuk prediksi cakupan ASI Eksklusif 24 Puskesmas",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("NEXTJS_ORIGIN", "http://localhost:3000"),
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/ml/health", response_model=HealthResponse)
async def health():
    inp = None
    if model_loader.model is not None:
        s = model_loader.model.input_shape
        inp = [int(d) if d is not None else -1 for d in s]

    return HealthResponse(
        status="ok" if model_status.get("model_loaded") else "degraded",
        model_loaded=model_status.get("model_loaded", False),
        scaler_X_loaded=model_status.get("scaler_X_loaded", False),
        scaler_Y_loaded=model_status.get("scaler_Y_loaded", False),
        tensorflow_version=tf.__version__,
        uptime_seconds=round(time.time() - start_time, 2),
        model_input_shape=inp,
    )


@app.post("/ml/predict", response_model=PredictResponse)
async def predict(req: PredictRequest):
    m = model_loader.model
    sx = model_loader.scaler_X
    sy = model_loader.scaler_Y
    if m is None:
        raise HTTPException(status_code=503, detail="Model LSTM belum dimuat.")

    start = time.time()

    try:
        arr = np.array(req.history, dtype=np.float32)
        tensor = prepare_sliding_window(arr)

        if sx is not None:
            shape = tensor.shape
            flat = tensor.reshape(-1, tensor.shape[-1])
            tensor = sx.transform(flat).reshape(shape)

        raw_pred = m.predict(tensor, verbose=0)

        if sy is not None:
            final_pred = sy.inverse_transform(raw_pred).flatten()
        else:
            final_pred = raw_pred.flatten()

        exec_ms = round((time.time() - start) * 1000, 2)

        logger.info(
            f"Predict puskesmas {req.puskesmas_id}: "
            f"{exec_ms}ms, prediction={final_pred.tolist()}"
        )

        return PredictResponse(
            success=True,
            puskesmas_id=req.puskesmas_id,
            predictions=final_pred.tolist(),
            execution_time_ms=exec_ms,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Predict error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@app.post("/ml/shap", response_model=ShapResponse)
async def shap_explain(req: ShapRequest):
    m = model_loader.model
    sx = model_loader.scaler_X
    if m is None:
        raise HTTPException(status_code=503, detail="Model LSTM belum dimuat.")

    try:
        arr = np.array(req.history, dtype=np.float32)
        tensor = prepare_sliding_window(arr)

        if sx is not None:
            shape = tensor.shape
            flat = tensor.reshape(-1, tensor.shape[-1])
            tensor = sx.transform(flat).reshape(shape)

        shap_values, expected_value = shap_explainer.compute_shap(tensor, model=m)

        logger.info(
            f"SHAP puskesmas {req.puskesmas_id}: "
            f"expected_value={expected_value}, "
            f"shap_values shapes={[sv.shape for sv in shap_values]}"
        )

        return shap_explainer.format_shap(shap_values, expected_value, req.puskesmas_id, scaler_y=model_loader.scaler_Y)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"SHAP error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@app.get("/")
async def root():
    return {
        "service": "LSTM Panel ML/XAI Engine",
        "status": "running",
        "endpoints": {
            "health": "GET /ml/health",
            "predict": "POST /ml/predict",
            "shap": "POST /ml/shap",
        },
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("ML_ENGINE_PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
