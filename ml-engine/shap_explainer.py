import os
import logging

import numpy as np
import shap

logger = logging.getLogger(__name__)

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))

FEATURE_NAMES = ["Jumlah_Bayi_6_Bulan", "Jumlah_ASI_Eksklusif"]
WINDOW_SIZE = 12
N_FEATURES = 2

explainer = None
background_data = None


def init_shap(model, bg_path=None):
    bg_path = bg_path or os.path.join(_BASE_DIR, "models", "background_data.npy")
    global explainer, background_data

    try:
        background_data = np.load(bg_path)
        logger.info(f"Background data loaded from {bg_path}, shape: {background_data.shape}")
    except FileNotFoundError:
        background_data = np.random.randn(100, WINDOW_SIZE, N_FEATURES).astype(np.float32)
        logger.warning(f"Background file not found, using random data shape {background_data.shape}")

    explainer = shap.GradientExplainer(model, background_data)
    logger.info("SHAP GradientExplainer initialized successfully")


def compute_shap(input_tensor: np.ndarray, model=None) -> tuple:
    global explainer, background_data
    if explainer is None:
        raise RuntimeError("SHAP Explainer belum diinisialisasi. Panggil init_shap() terlebih dahulu.")

    shap_values = explainer.shap_values(input_tensor)

    if isinstance(shap_values, list):
        shap_arr = shap_values[0]
    else:
        shap_arr = shap_values

    ev = 0.0
    if model is not None:
        try:
            preds = model.predict(background_data[:50], verbose=0)
            ev = float(np.mean(preds))
        except Exception as e:
            logger.warning(f"Expected value computation failed: {e}")

    return shap_arr, ev


def format_shap(shap_arr, expected_value, puskesmas_id: int) -> dict:
    features = []

    for feat_idx, feature_name in enumerate(FEATURE_NAMES):
        impacts = []
        for lag in range(WINDOW_SIZE):
            if shap_arr.ndim == 4:
                val = float(shap_arr[0, lag, feat_idx, 0])
            elif shap_arr.ndim == 3:
                val = float(shap_arr[lag, feat_idx, 0])
            else:
                val = float(shap_arr[lag, feat_idx])
            impacts.append({
                "lag": WINDOW_SIZE - lag,
                "shap_value": round(val, 6),
                "feature_name": feature_name,
            })

        mean_abs = sum(abs(i["shap_value"]) for i in impacts) / len(impacts)

        features.append({
            "feature": feature_name,
            "mean_abs_impact": round(mean_abs, 6),
            "impacts": impacts,
        })

    return {
        "success": True,
        "puskesmas_id": puskesmas_id,
        "expected_value": round(expected_value, 6),
        "features": features,
    }
